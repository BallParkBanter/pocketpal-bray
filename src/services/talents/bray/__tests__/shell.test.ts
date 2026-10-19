import NativeShizukuShell from '../../../../specs/NativeShizukuShell';
import {
  runShell,
  ShizukuNotRunningError,
  ShizukuPermissionError,
} from '../shell';

jest.mock('../../../../specs/NativeShizukuShell', () => ({
  __esModule: true,
  default: {
    isRunning: jest.fn(),
    hasPermission: jest.fn(),
    requestPermission: jest.fn(),
    exec: jest.fn(),
  },
}));

const native = NativeShizukuShell as unknown as {
  isRunning: jest.Mock;
  hasPermission: jest.Mock;
  requestPermission: jest.Mock;
  exec: jest.Mock;
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
    expect(r.stdout).toBe('hi\n');
  });

  it('throws ShizukuPermissionError when permission is refused', async () => {
    native.hasPermission.mockResolvedValue(false);
    native.requestPermission.mockResolvedValue(false);
    await expect(runShell('echo hi')).rejects.toBeInstanceOf(
      ShizukuPermissionError,
    );
    expect(native.exec).not.toHaveBeenCalled();
  });
});
