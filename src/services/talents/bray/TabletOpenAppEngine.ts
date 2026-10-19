import type {
  SystemPromptContext,
  TalentEngine,
  TalentResult,
  ToolDefinition,
} from '../types';
import {
  errorResult,
  shellErrorResult,
  shQuote,
  tabletFragment,
  truncate,
} from './common';
import {holdModelWhileAway, releaseHold} from './holdModel';
import {
  LaunchableApp,
  listApps,
  runShell,
  ShizukuNotRunningError,
  ShizukuPermissionError,
} from './shell';

const QUERY_CMD =
  'cmd package query-activities -a android.intent.action.MAIN -c android.intent.category.LAUNCHER';
/** Typo budget: at most 3 edits, and at most a third of what was typed. */
export function maxDistance(query: string): number {
  return Math.min(3, Math.floor(query.length / 3));
}
const HOLD = 'tablet-open-app';

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Fallback when the service can't give labels: query-activities only prints
 * a label when it is not a resource (nonLocalizedLabel); otherwise use the
 * package name's last segment.
 */
export function parseQueryActivities(out: string): LaunchableApp[] {
  const apps: LaunchableApp[] = [];
  const seen = new Set<string>();
  for (const block of out.split(/Activity #\d+:/).slice(1)) {
    const pkg = /packageName=(\S+)/.exec(block)?.[1];
    if (!pkg || seen.has(pkg)) {
      continue;
    }
    seen.add(pkg);
    const label = /nonLocalizedLabel=(.*?)\s+icon=/.exec(block)?.[1];
    apps.push({
      label: label && label !== 'null' ? label : pkg.split('.').pop()!,
      package: pkg,
    });
  }
  return apps;
}

export interface Resolution {
  app: LaunchableApp | null;
  nearest: string[];
}

/** Exact label/package (case-insensitive), else closest label within 3 edits. */
export function resolveApp(name: string, apps: LaunchableApp[]): Resolution {
  const q = name.trim().toLowerCase();
  const exact = apps.find(
    a => a.label.toLowerCase() === q || a.package.toLowerCase() === q,
  );
  if (exact) {
    return {app: exact, nearest: [exact.label]};
  }
  const scored = apps
    .map(a => ({
      a,
      d: Math.min(
        levenshtein(q, a.label.toLowerCase()),
        levenshtein(q, a.package.split('.').pop()!.toLowerCase()),
      ),
    }))
    .sort((x, y) => x.d - y.d);
  const best = scored[0];
  return {
    app: best && best.d <= maxDistance(q) ? best.a : null,
    nearest: scored.slice(0, 3).map(s => s.a.label),
  };
}

/** tablet_open_app — opening an app changes nothing, so no approval. */
export class TabletOpenAppEngine implements TalentEngine {
  readonly name = 'tablet_open_app';

  private async apps(): Promise<LaunchableApp[]> {
    try {
      const apps = await listApps();
      if (apps.length) {
        return apps;
      }
    } catch (e) {
      if (
        e instanceof ShizukuNotRunningError ||
        e instanceof ShizukuPermissionError
      ) {
        throw e;
      }
    }
    return parseQueryActivities((await runShell(QUERY_CMD)).stdout);
  }

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const name = typeof args?.name === 'string' ? args.name.trim() : '';
    if (!name) {
      return errorResult(
        'tablet_open_app: give the app name, e.g. {"name": "LibreTube"}',
      );
    }
    try {
      const {app, nearest} = resolveApp(name, await this.apps());
      if (!app) {
        return errorResult(
          truncate(`No app called "${name}". Closest: ${nearest.join(', ')}`),
        );
      }
      // The launched app takes the foreground; keep the model loaded so the
      // reply to this tool call still gets written.
      holdModelWhileAway(HOLD);
      const r = await runShell(
        `monkey -p ${shQuote(app.package)} -c android.intent.category.LAUNCHER 1`,
      ).catch(e => {
        releaseHold(HOLD);
        throw e;
      });
      if (!/Events injected: [1-9]/.test(r.stdout)) {
        releaseHold(HOLD);
        return errorResult(
          truncate(
            `Could not open ${app.label}: ${(r.stdout + r.stderr).trim()}`,
          ),
        );
      }
      return {
        type: 'text',
        summary: `Opened ${app.label} (${app.package}). It is now on screen.`,
      };
    } catch (e) {
      return shellErrorResult(this.name, e);
    }
  }

  systemPromptFragment(ctx: SystemPromptContext): string | null {
    return tabletFragment(this.name, ctx.activeTalents);
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: 'Open (launch) an app on this tablet by its name.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description:
                'App name as shown on the home screen, e.g. "LibreTube".',
            },
          },
          required: ['name'],
        },
      },
    };
  }
}
