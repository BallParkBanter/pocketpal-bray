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

/**
 * Commands that could cut the tablet off the network (it is Wi-Fi only) or
 * wreck it. Rejected outright, without even asking Bo. Over-blocking is fine:
 * this is a tripwire in front of the approval dialog, not the only guard.
 * Patterns are matched against normalize(command), never the raw text.
 */
export const BLOCK_PATTERNS: RegExp[] = [
  // Whole words anywhere (wifi_enabled, airplane_mode_on, wlan0 included).
  /\b(svc|wifi\w*|wlan\d*|airplane\w*|connectivity|reboot|shutdown|uninstall)\b/i,
  /\bpm\s+(disable|uninstall|hide|suspend)/i,
  /\brm\s+-\w*[rf]\w*\s+\/(\s|$)/i,
  // Any rm aimed at / or /* whatever the flags (rm -r -f /, rm -rf /*).
  /\brm\b[^;]*\s\/\*?(\s|;|$)/i,
  // Recursive rm of a top-level path (/sdcard, /storage/, /data ...).
  /\brm\s+-\w*r\w*[^;]*\s\/[^/\s;]*\/?\*?(\s|;|$)/i,
  /force-stop\s+com\.tailscale/i,
  /\bip\s+(link|route|addr)/i,
  /\bifconfig\b/i,
  /\bsettings\s+put\s+global\b/i,
];
export const BLOCKED_MSG = 'Blocked: this could cut the tablet off the network';
export const MULTILINE_MSG =
  'Refused: send one single-line command (multi-line commands are not allowed)';

/**
 * Undo the cheap disguises before matching: quotes and backslashes go
 * (`svc "wifi"`, `w\ifi`), and newlines / ; & | become separators.
 */
export function normalize(command: string): string {
  return command
    .replace(/['"`\\]/g, '')
    .replace(/[\r\n;&|]+/g, ' ; ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isBlocked(command: string): boolean {
  const n = normalize(command);
  return BLOCK_PATTERNS.some(rx => rx.test(n));
}

/** What the dialog shows: every space and odd character made visible. */
export function visibleWhitespace(command: string): string {
  return Array.from(command)
    .map(ch => {
      if (ch === ' ') {
        return '·';
      }
      if (ch === '\t') {
        return '⇥';
      }
      const code = ch.codePointAt(0)!;
      if (/\s/.test(ch) || code < 0x20 || code === 0x7f) {
        return `\\u{${code.toString(16)}}`;
      }
      return ch;
    })
    .join('');
}

/** tablet_shell — any shell command, always approved by Bo first. */
export class TabletShellEngine implements TalentEngine {
  readonly name = 'tablet_shell';

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const command =
      typeof args?.command === 'string' ? args.command.trim() : '';
    if (!command) {
      return errorResult(
        'tablet_shell: give the command, e.g. {"command": "uptime"}',
      );
    }
    if (isBlocked(command)) {
      return errorResult(BLOCKED_MSG);
    }
    // A dialog can hide extra lines; only single-line commands are offered.
    if (/[\r\n\u2028\u2029]/.test(command)) {
      return errorResult(MULTILINE_MSG);
    }
    if (
      !(await askApproval('Run a shell command', visibleWhitespace(command)))
    ) {
      return errorResult(`Bo declined: run "${command}"`);
    }
    try {
      const r = await runShell(command);
      const parts = [r.timedOut ? 'timed out (killed)' : `exit ${r.exitCode}`];
      if (r.stderr.trim()) {
        parts.push(`stderr: ${r.stderr.trim()}`);
      }
      parts.push(r.stdout.trim() || '(no output)');
      return {type: 'text', summary: truncate(parts.join('\n'))};
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
          'Run a shell command on this tablet (adb shell user). Bo approves every command first. Use it when no other tablet tool fits.',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The exact shell command, e.g. "uptime".',
            },
          },
          required: ['command'],
        },
      },
    };
  }
}
