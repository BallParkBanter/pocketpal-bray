#!/usr/bin/env bash
# Offline test: a daemon started under dev_locked must not inherit the lock fd.
# Simulates `tablet status` spawning `ssh -f -N -L 5599:…` with `sleep 30 &`.
set -uo pipefail
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=../lib.sh
source "$HERE/../lib.sh"
export BRAY_LOCK; BRAY_LOCK="$(mktemp)"
fail=0
pids=()

spawn_daemon() { sleep 30 & echo $! >"$BRAY_LOCK.pid"; }   # what the tunnel does

# 1. Child spawns a background process under the lock; after we return the
#    lock must be free immediately, while the "tunnel" is still alive.
dev_locked spawn_daemon
pids+=("$(cat "$BRAY_LOCK.pid")")
if kill -0 "${pids[0]}" 2>/dev/null && flock -n "$BRAY_LOCK" true; then
  echo "PASS 1: lock free after return; background child ${pids[0]} still running"
else
  echo "FAIL 1: lock still held after return (fd leaked to the background child)"; fail=1
fi

# 2. Same through an exec'd script (like the real `tablet` script).
dev_locked bash -c 'sleep 30 & echo $! >"$0"' "$BRAY_LOCK.pid"
pids+=("$(cat "$BRAY_LOCK.pid")")
if flock -n "$BRAY_LOCK" true; then echo "PASS 2: exec'd script's daemon does not hold the lock"
else echo "FAIL 2: exec'd script's daemon holds the lock"; fail=1; fi

# 3. The lock IS held while the locked command runs (and is re-entrant).
inner() { flock -n "$BRAY_LOCK" true && echo held=no || echo held=yes; dev_locked echo reentrant=ok; }
out="$(dev_locked inner)"
if [[ "$out" == $'held=yes\nreentrant=ok' ]]; then echo "PASS 3: lock held during the call, re-entrant"
else echo "FAIL 3: got: $out"; fail=1; fi

# 4. Timeout returns BRAY_LOCK_TIMEOUT_RC.
flock "$BRAY_LOCK" sleep 4 & holder=$!
sleep 0.5
BRAY_LOCK_WAIT=1 dev_locked true 2>/dev/null; rc=$?
if [[ $rc == "$BRAY_LOCK_TIMEOUT_RC" ]]; then echo "PASS 4: timeout -> rc $rc"
else echo "FAIL 4: timeout rc=$rc"; fail=1; fi
wait "$holder"

kill "${pids[@]}" 2>/dev/null
rm -f "$BRAY_LOCK" "$BRAY_LOCK.pid"
exit $fail
