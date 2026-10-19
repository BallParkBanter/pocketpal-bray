import type {
  SystemPromptContext,
  TalentEngine,
  TalentResult,
  ToolDefinition,
} from '../types';
import {askApproval} from './approval';
import {
  errorResult,
  shellErrorResult,
  tabletFragment,
  truncate,
} from './common';
import {runShell} from './shell';

const WORDS: Record<string, number> = {
  max: 100,
  maximum: 100,
  full: 100,
  highest: 100,
  brightest: 100,
  high: 80,
  medium: 50,
  half: 50,
  mid: 50,
  low: 20,
  dim: 20,
  min: 0,
  minimum: 0,
  lowest: 0,
};

/** Model-supplied level -> integer 0-100, or null if unusable. */
export function coerceBrightness(level: unknown): number | null {
  let n: number;
  if (typeof level === 'number') {
    n = level;
  } else if (typeof level === 'string') {
    const s = level.trim().toLowerCase();
    if (s in WORDS) {
      return WORDS[s];
    }
    const m = /^(-?\d+(?:\.\d+)?)\s*%?$/.exec(s);
    if (!m) {
      return null;
    }
    n = Number(m[1]);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.round(Math.min(100, Math.max(0, n)));
}

/** tablet_set_brightness — changes a setting, so it asks Bo first. */
export class TabletBrightnessEngine implements TalentEngine {
  readonly name = 'tablet_set_brightness';

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const pct = coerceBrightness(args?.level);
    if (pct === null) {
      return errorResult(
        `tablet_set_brightness: level must be a number 0-100 (or "low", "medium", "high", "max"); got ${JSON.stringify(
          args?.level ?? null,
        )}`,
      );
    }
    const action = `set brightness to ${pct}%`;
    if (
      !(await askApproval(
        'Set brightness',
        `Set the screen brightness to ${pct}%?`,
      ))
    ) {
      return errorResult(`Bo declined: ${action}`);
    }
    const raw = Math.round((pct * 255) / 100);
    let before = '';
    try {
      const r = await runShell(
        `settings get system screen_brightness; settings put system screen_brightness_mode 0; settings put system screen_brightness ${raw}`,
      );
      if (r.exitCode !== 0) {
        return errorResult(
          truncate(`tablet_set_brightness failed: ${r.stderr || r.stdout}`),
        );
      }
      const old = Number(r.stdout.trim().split('\n')[0]);
      if (r.stdout.trim() && Number.isFinite(old)) {
        before = ` (it was ${Math.round((old * 100) / 255)}%)`;
      }
    } catch (e) {
      return shellErrorResult(this.name, e);
    }
    // A bare "set to N%" made the small model end its turn with no reply;
    // a full sentence gives it something to pass on.
    return {
      type: 'text',
      summary: `Done: the screen brightness is now ${pct}%${before}. Auto-brightness is off.`,
    };
  }

  systemPromptFragment(ctx: SystemPromptContext): string | null {
    return tabletFragment(this.name, ctx.activeTalents);
  }

  toToolDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description:
          "Set this tablet's screen brightness. Bo is asked to approve first.",
        parameters: {
          type: 'object',
          properties: {
            level: {
              type: 'number',
              description: 'Brightness percent, 0-100 (e.g. 40 for 40%).',
            },
          },
          required: ['level'],
        },
      },
    };
  }
}
