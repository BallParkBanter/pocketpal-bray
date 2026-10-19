import type {TalentEngine, TalentResult, ToolDefinition} from '../types';
import {askApproval} from './approval';
import {errorResult, shellErrorResult, truncate} from './common';
import {runShell} from './shell';

/**
 * Commands that could cut the tablet off the network (it is Wi-Fi only) or
 * wreck it. Rejected outright, without even asking Bo.
 */
export const BLOCKLIST =
  /svc wifi|cmd wifi|reboot|settings put global airplane|pm uninstall|rm -rf \//i;
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
