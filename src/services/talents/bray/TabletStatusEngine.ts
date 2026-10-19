import type {
  SystemPromptContext,
  TalentEngine,
  TalentResult,
  ToolDefinition,
} from '../types';
import {shellErrorResult, tabletFragment} from './common';
import {runShell} from './shell';

const GIB = 1024 * 1024 * 1024;

export function parseBattery(out: string): string {
  const level = /^\s*level:\s*(\d+)/m.exec(out);
  const scale = /^\s*scale:\s*(\d+)/m.exec(out);
  const status = /^\s*status:\s*(\d+)/m.exec(out);
  if (!level) {
    return 'Battery ?';
  }
  const pct = Math.round(
    (Number(level[1]) * 100) / (scale ? Number(scale[1]) || 100 : 100),
  );
  // BatteryManager.BATTERY_STATUS_*: 2 charging, 5 full.
  const st = status ? Number(status[1]) : 0;
  const state = st === 2 ? 'charging' : st === 5 ? 'full' : 'not charging';
  return `Battery ${pct}% (${state})`;
}

export function parseWifi(out: string): string {
  const m = /SSID:\s*(?:"([^"]*)"|([^,\s][^,]*))/.exec(out);
  const ssid = m ? (m[1] ?? m[2] ?? '').trim() : '';
  if (!ssid || ssid === '<unknown ssid>' || /DISCONNECTED/.test(out)) {
    return 'Wi-Fi not connected';
  }
  return `Wi-Fi ${ssid}`;
}

export function parseStorage(out: string): string {
  const lines = out.trim().split('\n');
  const row = lines.find(l => /\s\/data\s*$/.test(l)) ?? lines[1];
  const cols = row ? row.trim().split(/\s+/) : [];
  const availKb = Number(cols[3]);
  if (!Number.isFinite(availKb) || cols.length < 4) {
    return 'Storage free ?';
  }
  return `Storage free ${Math.round((availKb * 1024) / GIB)} GB`;
}

export function parseRam(out: string): string {
  const m = /^MemAvailable:\s*(\d+)\s*kB/m.exec(out);
  if (!m) {
    return 'RAM free ?';
  }
  return `RAM free ${((Number(m[1]) * 1024) / GIB).toFixed(1)} GB`;
}

export function parseBrightness(out: string): string {
  const n = Number(out.trim());
  if (!out.trim() || !Number.isFinite(n)) {
    return 'Brightness ?';
  }
  return `Brightness ${Math.round((n * 100) / 255)}%`;
}

const SOURCES: Array<[string, (out: string) => string]> = [
  ['dumpsys battery', parseBattery],
  ['dumpsys wifi | grep -m1 mWifiInfo', parseWifi],
  ['df /data', parseStorage],
  ['cat /proc/meminfo', parseRam],
  ['settings get system screen_brightness', parseBrightness],
];

/** tablet_status — battery, Wi-Fi, storage, RAM, brightness. Read-only. */
export class TabletStatusEngine implements TalentEngine {
  readonly name = 'tablet_status';

  async execute(_args: Record<string, any> = {}): Promise<TalentResult> {
    const parts: string[] = [];
    try {
      for (const [cmd, parse] of SOURCES) {
        const r = await runShell(cmd);
        parts.push(parse(r.stdout));
      }
    } catch (e) {
      return shellErrorResult(this.name, e);
    }
    return {type: 'text', summary: parts.join(' · ')};
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
          "Read this tablet's current status: battery level and charging, Wi-Fi network, free storage, free RAM, screen brightness.",
        parameters: {type: 'object', properties: {}},
      },
    };
  }
}
