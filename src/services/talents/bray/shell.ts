import NativeShizukuShell from '../../../specs/NativeShizukuShell';

export interface ShellResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Shizuku's server is not running (it stops after every reboot). */
export class ShizukuNotRunningError extends Error {
  constructor() {
    super("Shizuku isn't running");
    this.name = 'ShizukuNotRunningError';
  }
}

/** Bo refused (or never answered) Shizuku's permission dialog. */
export class ShizukuPermissionError extends Error {
  constructor() {
    super('Shizuku permission was not granted to PocketPal Bray');
    this.name = 'ShizukuPermissionError';
  }
}

/**
 * Run `sh -c cmd` on the tablet as the shell uid via Shizuku.
 * The first call shows Shizuku's own permission dialog if needed.
 */
export async function runShell(
  cmd: string,
  timeoutMs = 8000,
): Promise<ShellResult> {
  const mod = NativeShizukuShell;
  if (!mod || !(await mod.isRunning())) {
    throw new ShizukuNotRunningError();
  }
  if (!(await mod.hasPermission())) {
    if (!(await mod.requestPermission())) {
      throw new ShizukuPermissionError();
    }
  }
  const raw = await mod.exec(cmd, timeoutMs);
  const parsed = JSON.parse(raw);
  return {
    exitCode: Number(parsed.exitCode),
    stdout: String(parsed.stdout ?? ''),
    stderr: String(parsed.stderr ?? ''),
    timedOut: Boolean(parsed.timedOut),
  };
}

export interface LaunchableApp {
  label: string;
  package: string;
}

/** Launcher apps with their user-visible labels (via the Shizuku service). */
export async function listApps(): Promise<LaunchableApp[]> {
  const mod = NativeShizukuShell;
  if (!mod || !(await mod.isRunning())) {
    throw new ShizukuNotRunningError();
  }
  if (!(await mod.hasPermission())) {
    if (!(await mod.requestPermission())) {
      throw new ShizukuPermissionError();
    }
  }
  const parsed = JSON.parse(await mod.listApps());
  return (Array.isArray(parsed) ? parsed : [])
    .filter(a => a && typeof a.package === 'string')
    .map(a => ({label: String(a.label ?? a.package), package: a.package}));
}
