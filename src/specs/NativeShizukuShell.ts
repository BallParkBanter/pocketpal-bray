import type {TurboModule} from 'react-native';
import {Platform, TurboModuleRegistry} from 'react-native';

/**
 * Runs shell commands as the `shell` uid through Shizuku (PocketPal Bray).
 * Android only; `null` elsewhere (and in jest unless mocked).
 */
export interface Spec extends TurboModule {
  /** Shizuku server is running and its binder reached this app. */
  isRunning(): Promise<boolean>;
  /** Shizuku permission already granted to this app. */
  hasPermission(): Promise<boolean>;
  /** Shows Shizuku's permission dialog when needed; resolves with the outcome. */
  requestPermission(): Promise<boolean>;
  /**
   * Runs `sh -c command` as the shell uid. Resolves with JSON
   * `{"exitCode":number,"stdout":string,"stderr":string,"timedOut":boolean}`.
   */
  exec(command: string, timeoutMs: number): Promise<string>;
  /**
   * Launcher apps with their user-visible labels (resolved by the shell-uid
   * service's PackageManager). JSON `[{"label":string,"package":string}]`.
   */
  listApps(): Promise<string>;
}

export default (Platform.OS === 'android'
  ? TurboModuleRegistry.get<Spec>('ShizukuShell')
  : null) as Spec | null;
