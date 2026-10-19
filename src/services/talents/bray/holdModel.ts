import {AppState, NativeEventSubscription} from 'react-native';

const holds = new Map<string, NativeEventSubscription>();

function store() {
  // Lazy: the store graph is heavy and must not load with the talent modules.
  return require('../../../store/ModelStore').modelStore as {
    disableAutoRelease: (reason: string) => void;
    enableAutoRelease: (reason: string) => void;
  };
}

/**
 * Keep the model loaded while another app is in front (a tool launched it,
 * or Shizuku's permission dialog is up). PocketPal auto-releases the model
 * when it goes to the background, which kills the agent's reply mid-run.
 * Auto-release comes back the next time PocketPal is active again.
 */
export function holdModelWhileAway(reason: string): void {
  releaseHold(reason);
  store().disableAutoRelease(reason);
  let left = false;
  const sub = AppState.addEventListener('change', state => {
    if (state !== 'active') {
      left = true;
    } else if (left) {
      releaseHold(reason);
    }
  });
  holds.set(reason, sub);
}

/** End a hold now (e.g. the launch failed, so the app never left). */
export function releaseHold(reason: string): void {
  const sub = holds.get(reason);
  if (sub) {
    sub.remove();
    holds.delete(reason);
    store().enableAutoRelease(reason);
  }
}
