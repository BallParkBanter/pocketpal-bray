import type {
  SystemPromptContext,
  TalentEngine,
  TalentResult,
  ToolDefinition,
} from '../types';
import {
  errorResult,
  shQuote,
  shellErrorResult,
  tabletFragment,
  truncate,
} from './common';
import {runShell} from './shell';

const DEFAULT_PATH = '/sdcard/Download';

/**
 * Model-supplied path -> absolute path under /sdcard or /storage, or null.
 * Relative paths are taken from /sdcard ("Documents" -> /sdcard/Documents).
 */
export function resolveListPath(path: unknown): string | null {
  if (path === undefined || path === null || path === '') {
    return DEFAULT_PATH;
  }
  if (typeof path !== 'string') {
    return null;
  }
  let p = path.trim();
  if (!p.startsWith('/')) {
    p = '/sdcard/' + p;
  }
  p = p.replace(/\/+/g, '/').replace(/\/$/, '');
  if (p.split('/').some(seg => seg === '..' || seg === '.')) {
    return null;
  }
  return /^\/(sdcard|storage)(\/|$)/.test(p) ? p : null;
}

function humanSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return i === 0 ? `${v} B` : `${v.toFixed(1)} ${units[i]}`;
}

/** One `ls -la` line -> "YYYY-MM-DD HH:MM  size  name", or null to skip. */
function formatLine(line: string): string | null {
  const m =
    /^([dlcbsp-])\S*\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\d{4}-\d\d-\d\d \d\d:\d\d)\s+(.+)$/.exec(
      line.trim(),
    );
  if (!m) {
    return null;
  }
  const [, kind, size, when, rawName] = m;
  const name = kind === 'l' ? rawName.split(' -> ')[0] : rawName;
  if (name === '.' || name === '..') {
    return null;
  }
  return kind === 'd'
    ? `${when}  folder  ${name}/`
    : `${when}  ${humanSize(Number(size))}  ${name}`;
}

/** tablet_list_files — read-only listing under /sdcard or /storage. */
export class TabletListFilesEngine implements TalentEngine {
  readonly name = 'tablet_list_files';

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const path = resolveListPath(args?.path);
    if (path === null) {
      return errorResult(
        `tablet_list_files: can only list folders under /sdcard/ or /storage/ (got ${JSON.stringify(
          args?.path,
        )})`,
      );
    }
    try {
      // Trailing slash: /sdcard itself is a symlink; list its target.
      const r = await runShell(`ls -la -t ${shQuote(path + '/')}`);
      if (r.exitCode !== 0) {
        return errorResult(
          truncate(`tablet_list_files: ${(r.stderr || r.stdout).trim()}`),
        );
      }
      const lines = r.stdout
        .split('\n')
        .map(formatLine)
        .filter((l): l is string => l !== null);
      if (!lines.length) {
        return {type: 'text', summary: `${path} is empty.`};
      }
      return {
        type: 'text',
        summary: truncate(
          [`Files in ${path} (newest first):`, ...lines].join('\n'),
        ),
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
        description:
          "List the files in a folder on this tablet's storage, newest first. Defaults to the Downloads folder.",
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description:
                'Folder under /sdcard/ or /storage/ (default /sdcard/Download).',
            },
          },
        },
      },
    };
  }
}
