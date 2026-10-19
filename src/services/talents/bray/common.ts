import type {TalentResult} from '../types';
import {ShizukuNotRunningError, ShizukuPermissionError} from './shell';

/** Tool results fed to the model stay under this, so they fit n_ctx=2048. */
export const MAX_TOOL_CHARS = 1200;
export const TRUNCATION_MARKER = '…(truncated)';

export const SHIZUKU_NOT_RUNNING_MSG =
  "Shizuku isn't running — open Shizuku and tap Start";
export const SHIZUKU_NO_PERMISSION_MSG =
  "PocketPal Bray doesn't have Shizuku permission — open Shizuku and allow PocketPal Bray";

/** Cut `text` so the result (marker included) is at most `max` chars. */
export function truncate(text: string, max = MAX_TOOL_CHARS): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max - TRUNCATION_MARKER.length) + TRUNCATION_MARKER;
}

export function errorResult(
  summary: string,
  errorMessage = summary,
): TalentResult {
  return {type: 'error', summary, errorMessage};
}

/** Turn anything runShell can throw into a plain-English tool error. */
export function shellErrorResult(tool: string, e: unknown): TalentResult {
  if (e instanceof ShizukuNotRunningError) {
    return errorResult(SHIZUKU_NOT_RUNNING_MSG);
  }
  if (e instanceof ShizukuPermissionError) {
    return errorResult(SHIZUKU_NO_PERMISSION_MSG);
  }
  const msg = e instanceof Error ? e.message : String(e);
  return errorResult(truncate(`${tool}: ${msg}`), msg);
}

/** Single-quote for sh -c. */
export function shQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}
