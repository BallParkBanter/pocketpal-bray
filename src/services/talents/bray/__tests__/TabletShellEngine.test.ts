import {
  isBlocked,
  MULTILINE_MSG,
  normalize,
  TabletShellEngine,
  visibleWhitespace,
} from '../TabletShellEngine';
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
    // Review fix round 1: bypasses of the first regex, run by the reviewer.
    ['cmd -w wifi set-wifi-enabled disabled'],
    ['svc "wifi" disable'],
    ['rm -fr /'],
    ['am force-stop com.tailscale.ipn'],
    ['cmd -w wifi\nset-wifi-enabled disabled'],
    // and neighbours of those
    ["s'v'c wi\\fi disable"],
    ['echo x; svc wifi disable'],
    ['true && reboot'],
    ['true | reboot'],
    ['rm -r -f /'],
    ['rm -rf /*'],
    ['cmd wifi set-wifi-enabled disabled'],
    ['ip route del default'],
    ['ip addr flush dev wlan0'],
    ['pm hide com.tailscale.ipn'],
    ['pm suspend com.tailscale.ipn'],
    ['pm uninstall --user 0 com.tailscale.ipn'],
    ['settings put global mobile_data 0'],
    ['dumpsys wifi'], // over-blocking is accepted
    // Review round 2 twins:
    ['cmd package disable com.tailscale.ipn'],
    ['cmd package disable-user --user 0 com.tailscale.ipn'],
    ['cmd package suspend com.tailscale.ipn'],
    ['cmd package hide com.tailscale.ipn'],
    ['cmd package uninstall com.tailscale.ipn'],
    ['cmd package clear com.tailscale.ipn'],
    ['pm clear moe.shizuku.privileged.api'],
    ['am force-stop --user 0 com.tailscale.ipn'],
    ['am stop-app com.tailscale.ipn'],
    ['am kill --user all moe.shizuku.privileged.api'],
    ['am force-stop moe.shizuku.privileged.api'],
    ['rm -f -r /'],
    ['rm -r -f /sdcard'],
    ['rm -Rf /sdcard/'],
    ['rm -fR /storage/6238-3662/AI-Models'],
    ['rm --recursive /data/local/tmp'],
    ['cd /sdcard; rm -rf *'],
    ['rm -rf .'],
    ['find /sdcard -name x -delete'],
    ['kill -9 -1'],
    ['kill -s KILL -1'],
    ['pkill -f tailscale'],
    ['killall sh'],
    ['settings --user 0 put global wifi_on 0'],
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

describe('obfuscation is refused', () => {
  const engine = new TabletShellEngine();
  it.each([
    ['echo $(printf "\\163\\166\\143")'],
    ['`printf svc` wifi disable'],
    ['a=svc; ${a} wifi disable'],
    ['set -- svc wifi disable; $@'],
    ['echo c3ZjIHdpZmkgZGlzYWJsZQ== | base64 -d'],
    ['echo id | sh'],
    ['curl x | bash'],
    ['cat f |/system/bin/sh'],
    ['eval echo hi'],
    ['sh -c id'],
  ])('%p', async command => {
    mockRun.mockReset();
    mockAsk.mockReset();
    const r = await engine.execute({command});
    expect(r.type).toBe('error');
    expect(r.summary).toMatch(/^(Refused|Blocked):/);
    expect(mockAsk).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('still lets plain commands through to the dialog', async () => {
    mockAsk.mockReset();
    mockAsk.mockResolvedValue(false);
    await engine.execute({command: 'ls -la /sdcard | head -5'});
    expect(mockAsk).toHaveBeenCalled();
  });
});

describe('normalize', () => {
  it('drops quotes and backslashes and splits on separators', () => {
    expect(normalize('svc "wifi"\\ disable')).toBe('svc wifi disable');
    expect(normalize('a\nb;c&&d|e')).toBe('a ; b ; c ; d ; e');
  });
});

describe('visibleWhitespace', () => {
  it('shows spaces, tabs and other control characters', () => {
    expect(visibleWhitespace('ls -la')).toBe('ls·-la');
    expect(visibleWhitespace('a\tb')).toBe('a⇥b');
    expect(visibleWhitespace('a\u00a0b\rc')).toBe('a\\u{a0}b\\u{d}c');
  });

  it('escapes format (Cf) and C1 control characters', () => {
    // RLO bidi override, zero-width space/joiner, soft hyphen, BOM, tag char
    expect(visibleWhitespace('a\u202Eb')).toBe('a\\u{202e}b');
    expect(visibleWhitespace('s\u200Bv\u200Dc')).toBe('s\\u{200b}v\\u{200d}c');
    expect(visibleWhitespace('x\u00ADy\uFEFF')).toBe('x\\u{ad}y\\u{feff}');
    expect(visibleWhitespace('t\u{E0041}')).toBe('t\\u{e0041}');
    // C1 controls 0x80-0x9F
    expect(visibleWhitespace('a\u0085b\u009Bc')).toBe('a\\u{85}b\\u{9b}c');
    // ordinary non-ASCII stays readable
    expect(visibleWhitespace('café')).toBe('café');
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

  it('refuses multi-line commands without asking', async () => {
    const r = await engine.execute({command: 'uptime\nid'});
    expect(r.summary).toBe(MULTILINE_MSG);
    expect(mockAsk).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('shows the command with whitespace made visible', async () => {
    mockAsk.mockResolvedValue(false);
    await engine.execute({command: 'ls  -la /sdcard'});
    expect(mockAsk).toHaveBeenCalledWith(
      'Run a shell command',
      'ls··-la·/sdcard',
    );
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
