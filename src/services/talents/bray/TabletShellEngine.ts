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
 * wreck it. Rejected outright, without even asking Bo.
 */
// The brief's list (svc wifi, cmd wifi, reboot, airplane, pm uninstall,
// rm -rf /) plus what Gemma actually tried on the tablet for "Turn off wifi":
// `settings put global wifi_enabled 0`. Also the other ways to drop the
// network or the device: wifi_on, airplane via cmd connectivity, interface
// down, shutdown, svc power, disabling packages (e.g. Tailscale).
export const BLOCKLIST =
  /svc wifi|cmd wifi|wifi_enabled|wifi_on|reboot|shutdown|svc power|airplane|cmd connectivity|settings put global (wifi|airplane)|pm uninstall|pm disable|rm -rf \/|ip link set\b.*\bdown|ifconfig\b.*\bdown/i;
export const BLOCKED_MSG = 'Blocked: this could cut the tablet off the network';

export function isBlocked(command: string): boolean {
  return BLOCKLIST.test(command.replace(/\s+/g, ' '));
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
    if (!(await askApproval('Run a shell command', command))) {
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
