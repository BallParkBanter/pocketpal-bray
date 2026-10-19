import {TabletStatusEngine} from '../TabletStatusEngine';
import {
  runShell,
  ShizukuNotRunningError,
  ShizukuPermissionError,
} from '../shell';

jest.mock('../shell', () => {
  const actual = jest.requireActual('../shell');
  return {...actual, runShell: jest.fn()};
});

const mockRun = runShell as jest.Mock;

const BATTERY = `Current Battery Service state:
  AC powered: true
  USB powered: false
  Wireless powered: false
  Max charging current: 3000000
  status: 2
  health: 2
  present: true
  level: 74
  scale: 100
  voltage: 4120
  temperature: 290
`;
const WIFI = `mWifiInfo SSID: "BrayFarm", BSSID: 70:a7:41:00:00:01, MAC: 02:00:00:00:00:00, IP: /192.168.1.8, Security type: 2, Supplicant state: COMPLETED, Wi-Fi standard: 11ax, RSSI: -48, Link speed: 864Mbps
`;
const DF = `Filesystem       1K-blocks     Used Available Use% Mounted on
/dev/block/dm-48 236897616 110021248 126876368  47% /data
`;
const MEMINFO = `MemTotal:        7656576 kB
MemFree:          312000 kB
MemAvailable:    2936012 kB
Buffers:            4096 kB
`;

function shell(stdout: string, exitCode = 0) {
  return {exitCode, stdout, stderr: '', timedOut: false};
}

function route(overrides: Record<string, string> = {}) {
  const table: Record<string, string> = {
    'dumpsys battery': BATTERY,
    'dumpsys wifi': WIFI,
    'df /data': DF,
    '/proc/meminfo': MEMINFO,
    screen_brightness: '247\n',
    ...overrides,
  };
  mockRun.mockImplementation(async (cmd: string) => {
    const key = Object.keys(table).find(k => cmd.includes(k));
    if (key === undefined) {
      throw new Error('unexpected command ' + cmd);
    }
    return shell(table[key]);
  });
}

describe('TabletStatusEngine', () => {
  const engine = new TabletStatusEngine();
  beforeEach(() => mockRun.mockReset());

  it('builds the exact one-line summary from the five sources', async () => {
    route();
    const r = await engine.execute({});
    expect(r).toEqual({
      type: 'text',
      summary:
        'Battery 74% (charging) · Wi-Fi BrayFarm · Storage free 121 GB · RAM free 2.8 GB · Brightness 97%',
    });
  });

  it('reports not charging and a missing Wi-Fi network', async () => {
    route({
      'dumpsys battery': BATTERY.replace('status: 2', 'status: 3').replace(
        'level: 74',
        'level: 31',
      ),
      'dumpsys wifi':
        'mWifiInfo SSID: <unknown ssid>, BSSID: <none>, Supplicant state: DISCONNECTED\n',
    });
    const r = await engine.execute({});
    expect(r.summary).toMatch(
      /^Battery 31% \(not charging\) · Wi-Fi not connected · /,
    );
  });

  it('reports full', async () => {
    route({'dumpsys battery': BATTERY.replace('status: 2', 'status: 5')});
    expect((await engine.execute({})).summary).toMatch(/^Battery 74% \(full\)/);
  });

  it('marks one unreadable item with ? instead of failing', async () => {
    route({screen_brightness: 'null\n'});
    expect((await engine.execute({})).summary).toMatch(/Brightness \?$/);
  });

  it('returns the plain-English error when Shizuku is not running', async () => {
    mockRun.mockRejectedValue(new ShizukuNotRunningError());
    const r = await engine.execute({});
    expect(r.type).toBe('error');
    expect(r.summary).toBe(
      "Shizuku isn't running — open Shizuku and tap Start",
    );
  });

  it('explains a missing Shizuku permission', async () => {
    mockRun.mockRejectedValue(new ShizukuPermissionError());
    const r = await engine.execute({});
    expect(r.type).toBe('error');
    expect(r.summary).toMatch(/permission/i);
  });

  it('exposes a no-argument tool definition', () => {
    const def = engine.toToolDefinition();
    expect(def.function.name).toBe('tablet_status');
    expect(def.function.parameters.properties).toEqual({});
  });
});
