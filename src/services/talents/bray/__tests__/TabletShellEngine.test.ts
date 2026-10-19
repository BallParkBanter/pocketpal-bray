import {isBlocked, TabletShellEngine} from '../TabletShellEngine';
import {askApproval} from '../approval';
import {MAX_TOOL_CHARS} from '../common';
import {runShell, ShizukuNotRunningError} from '../shell';

// runShell is ALWAYS mocked here: nothing in this file can reach a real shell.
jest.mock('../shell', () => {
  const actual = jest.requireActual('../shell');
  return {...actual, runShell: jest.fn()};
});
jest.mock('../approval', () => ({askApproval: jest.fn()}));

const mockRun = runShell as jest.Mock;
const mockAsk = askApproval as jest.Mock;
const BLOCKED = 'Blocked: this could cut the tablet off the network';

describe('isBlocked', () => {
  it.each([
    ['svc wifi disable'],
    ['SVC  WIFI disable'],
    ['cmd wifi set-wifi-enabled disabled'],
    ['reboot'],
    ['sleep 1; reboot -p'],
    ['settings put global airplane_mode_on 1'],
    ['pm uninstall com.tailscale.ipn'],
    ['rm -rf /'],
    ['rm  -rf   /sdcard'],
    // What Gemma really sent for "Turn off wifi" on 2026-10-19:
    ['settings put global wifi_enabled 0'],
    ['settings put global wifi_on 0'],
    ['cmd connectivity airplane-mode enable'],
    ['ip link set wlan0 down'],
    ['ifconfig wlan0 down'],
    ['svc power shutdown'],
    ['pm disable-user com.tailscale.ipn'],
  ])('blocks %p', cmd => {
    expect(isBlocked(cmd)).toBe(true);
  });

  it.each([
    ['uptime'],
    ['ls /sdcard'],
    ['dumpsys battery'],
    ['rm /sdcard/x.txt'],
  ])('allows %p', cmd => {
    expect(isBlocked(cmd)).toBe(false);
  });
});

describe('TabletShellEngine', () => {
  const engine = new TabletShellEngine();
  beforeEach(() => {
    mockRun.mockReset();
    mockAsk.mockReset();
  });

  it.each([['svc wifi disable'], ['settings put global wifi_enabled 0']])(
    'rejects %p with the network message, no dialog, nothing run',
    async command => {
      const r = await engine.execute({command});
      expect(r).toEqual(
        expect.objectContaining({type: 'error', summary: BLOCKED}),
      );
      expect(mockAsk).not.toHaveBeenCalled();
      expect(mockRun).not.toHaveBeenCalled();
    },
  );

  it('rejects "svc wifi disable" without asking and without running', async () => {
    const r = await engine.execute({command: 'svc wifi disable'});
    expect(r.type).toBe('error');
    expect(r.summary).toBe(BLOCKED);
    expect(mockAsk).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('always asks, showing the exact command', async () => {
    mockAsk.mockResolvedValue(true);
    mockRun.mockResolvedValue({
      exitCode: 0,
      stdout:
        ' 10:01:02 up 3 days,  2:04,  0 users,  load average: 1.2, 1.1, 1.0\n',
      stderr: '',
      timedOut: false,
    });
    const r = await engine.execute({command: 'uptime'});
    expect(mockAsk).toHaveBeenCalledWith('Run a shell command', 'uptime');
    expect(mockRun).toHaveBeenCalledWith('uptime');
    expect(r.type).toBe('text');
    expect(r.summary).toMatch(/^exit 0\n.*up 3 days/s);
  });

  it('on Deny returns the declined error and runs nothing', async () => {
    mockAsk.mockResolvedValue(false);
    const r = await engine.execute({command: 'uptime'});
    expect(r.type).toBe('error');
    expect(r.summary).toBe('Bo declined: run "uptime"');
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('includes stderr and truncates long output', async () => {
    mockAsk.mockResolvedValue(true);
    mockRun.mockResolvedValue({
      exitCode: 2,
      stdout: 'x'.repeat(5000),
      stderr: 'oops',
      timedOut: false,
    });
    const r = await engine.execute({command: 'cat big'});
    expect(r.summary.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    expect(r.summary).toMatch(/^exit 2\nstderr: oops\n/);
    expect(r.summary.endsWith('…(truncated)')).toBe(true);
  });

  it('notes a timeout', async () => {
    mockAsk.mockResolvedValue(true);
    mockRun.mockResolvedValue({
      exitCode: -1,
      stdout: '',
      stderr: '',
      timedOut: true,
    });
    const r = await engine.execute({command: 'sleep 99'});
    expect(r.summary).toMatch(/timed out/);
  });

  it('requires a command', async () => {
    const r = await engine.execute({});
    expect(r.type).toBe('error');
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('reports Shizuku not running', async () => {
    mockAsk.mockResolvedValue(true);
    mockRun.mockRejectedValue(new ShizukuNotRunningError());
    const r = await engine.execute({command: 'uptime'});
    expect(r.summary).toBe(
      "Shizuku isn't running — open Shizuku and tap Start",
    );
  });
});
