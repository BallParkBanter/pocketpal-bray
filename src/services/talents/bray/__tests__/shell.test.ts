import NativeShizukuShell from '../../../../specs/NativeShizukuShell';
import {holdModelWhileAway, releaseHold} from '../holdModel';
import {
  PERMISSION_TIMEOUT_MS,
  listApps,
  runShell,
  ShizukuNotRunningError,
  ShizukuPermissionError,
} from '../shell';

jest.mock('../holdModel', () => ({
  holdModelWhileAway: jest.fn(),
  releaseHold: jest.fn(),
}));

jest.mock('../../../../specs/NativeShizukuShell', () => ({
  __esModule: true,
  default: {
    isRunning: jest.fn(),
    hasPermission: jest.fn(),
    requestPermission: jest.fn(),
    exec: jest.fn(),
    listApps: jest.fn(),
  },
}));

const native = NativeShizukuShell as unknown as {
  isRunning: jest.Mock;
  hasPermission: jest.Mock;
  requestPermission: jest.Mock;
  exec: jest.Mock;
  listApps: jest.Mock;
};

describe('runShell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    native.isRunning.mockResolvedValue(true);
    native.hasPermission.mockResolvedValue(true);
    native.requestPermission.mockResolvedValue(true);
    native.exec.mockResolvedValue(
      JSON.stringify({
        exitCode: 0,
        stdout: 'hi\n',
        stderr: '',
        timedOut: false,
      }),
    );
  });

  it('runs a command and parses the JSON result', async () => {
    const r = await runShell('echo hi');
    expect(r).toEqual({
      exitCode: 0,
      stdout: 'hi\n',
      stderr: '',
      timedOut: false,
    });
    expect(native.exec).toHaveBeenCalledWith('echo hi', 8000);
  });

  it('passes a custom timeout', async () => {
    await runShell('sleep 1', 2500);
    expect(native.exec).toHaveBeenCalledWith('sleep 1', 2500);
  });

  it('throws ShizukuNotRunningError when Shizuku is not running', async () => {
    native.isRunning.mockResolvedValue(false);
    await expect(runShell('echo hi')).rejects.toBeInstanceOf(
      ShizukuNotRunningError,
    );
    expect(native.exec).not.toHaveBeenCalled();
  });

  it('asks for permission when missing, then runs', async () => {
    native.hasPermission.mockResolvedValue(false);
    const r = await runShell('echo hi');
    expect(native.requestPermission).toHaveBeenCalledTimes(1);
    expect(holdModelWhileAway).toHaveBeenCalledWith('shizuku-permission');
    expect(r.stdout).toBe('hi\n');
  });

  it('gives up on an unanswered permission dialog after 30 s', async () => {
    // Fire only the 30 s permission timer at once; leave other timers alone.
    const realSetTimeout = global.setTimeout;
    const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((
      fn: () => void,
      ms?: number,
    ) => {
      if (ms === PERMISSION_TIMEOUT_MS) {
        fn();
        return 0;
      }
      return realSetTimeout(fn, ms);
    }) as any);
    try {
      native.hasPermission.mockResolvedValue(false);
      native.requestPermission.mockReturnValue(new Promise(() => {}));
      await expect(runShell('echo hi')).rejects.toBeInstanceOf(
        ShizukuPermissionError,
      );
      expect(PERMISSION_TIMEOUT_MS).toBe(30000);
      expect(releaseHold).toHaveBeenCalledWith('shizuku-permission');
      expect(native.exec).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('throws ShizukuPermissionError when permission is refused', async () => {
    native.hasPermission.mockResolvedValue(false);
    native.requestPermission.mockResolvedValue(false);
    await expect(runShell('echo hi')).rejects.toBeInstanceOf(
      ShizukuPermissionError,
    );
    expect(releaseHold).toHaveBeenCalledWith('shizuku-permission');
    expect(native.exec).not.toHaveBeenCalled();
  });
});

describe('listApps', () => {
  beforeEach(() => {
    native.isRunning.mockResolvedValue(true);
    native.hasPermission.mockResolvedValue(true);
  });

  it('parses the label list and drops malformed entries', async () => {
    native.listApps.mockResolvedValue(
      JSON.stringify([
        {label: 'LibreTube', package: 'com.github.libretube'},
        {label: 'x'},
        {package: 'com.example.nolabel'},
      ]),
    );
    await expect(listApps()).resolves.toEqual([
      {label: 'LibreTube', package: 'com.github.libretube'},
      {label: 'com.example.nolabel', package: 'com.example.nolabel'},
    ]);
  });

  it('throws ShizukuNotRunningError when Shizuku is down', async () => {
    native.isRunning.mockResolvedValue(false);
    await expect(listApps()).rejects.toBeInstanceOf(ShizukuNotRunningError);
  });
});
