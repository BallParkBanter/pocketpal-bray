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
  // Review round 2 twins:
  /\bpm\s+clear\b/i,
  /\bcmd\s+package\s+(disable|disable-user|suspend|hide|uninstall|clear)\b/i,
  // Stopping/killing Tailscale or Shizuku, any flags in between.
  /\bam\s+(force-stop|stop-app|kill)\b[^;]*\b(com\.tailscale\.ipn|moe\.shizuku\.privileged\.api)\b/i,
  /\bfind\b[^;]*\s-delete\b/i,
  /\bkill\b[^;]*\s-1(\s|;|$)/i,
  /\b(pkill|killall)\b/i,
  /\bsettings\b[^;]*\bput\s+global\b/i,
];

/**
 * Text that hides what will really run: command substitution, variable
 * expansion, encoded payloads, piping into a shell. Checked on the RAW
 * command (normalize() would strip the backticks). Over-blocking is fine.
 */
export const OBFUSCATION =
  /\$\(|`|\$\{|\$@|base64|\|\s*\S*\b(sh|bash|ash|zsh|dash|mksh|toybox|busybox)\b|\beval\b|\bsh\s+-c\b/i;
export const OBFUSCATED_MSG =
  'Refused: no command substitution, variables, encoded text or piping into a shell';

/** Recursive rm (flags in any order) aimed at /, /sdcard, /storage/…, /data…, * or . */
export function isDangerousRm(normalized: string): boolean {
  return normalized.split(' ; ').some(segment => {
    const t = segment.trim().split(' ');
    const i = t.findIndex(w => /(^|\/)rm$/.test(w));
    if (i < 0) {
      return false;
    }
    const args = t.slice(i + 1);
    const recursive = args.some(
      a => /^-[a-z]*r/i.test(a) || a === '--recursive',
    );
    const target = args.some(a =>
      /^(\/|\/\*|\*|\.|\.\/|\.\/\*|\/sdcard\/?\*?|\/storage(\/.*)?|\/data(\/.*)?)$/.test(
        a,
      ),
    );
    return recursive && target;
  });
}
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
  return BLOCK_PATTERNS.some(rx => rx.test(n)) || isDangerousRm(n);
}

// Unicode category Cf (format: bidi overrides, zero-width, soft hyphen ...),
// as code point ranges: Hermes can't be trusted with \p{Cf}.
const CF_RANGES: Array<[number, number]> = [
  [0xad, 0xad],
  [0x600, 0x605],
  [0x61c, 0x61c],
  [0x6dd, 0x6dd],
  [0x70f, 0x70f],
  [0x890, 0x891],
  [0x8e2, 0x8e2],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x206f],
  [0xfeff, 0xfeff],
  [0xfff9, 0xfffb],
  [0x110bd, 0x110bd],
  [0x110cd, 0x110cd],
  [0x13430, 0x1343f],
  [0x1bca0, 0x1bca3],
  [0x1d173, 0x1d17a],
  [0xe0001, 0xe0001],
  [0xe0020, 0xe007f],
];

export function isFormatChar(code: number): boolean {
  return CF_RANGES.some(([a, b]) => code >= a && code <= b);
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
      if (
        /\s/.test(ch) ||
        code < 0x20 ||
        (code >= 0x7f && code <= 0x9f) ||
        isFormatChar(code)
      ) {
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
    if (OBFUSCATION.test(command)) {
      return errorResult(OBFUSCATED_MSG);
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
