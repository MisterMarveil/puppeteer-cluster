#!/usr/bin/env bash
set -euo pipefail

# Containers to process in order
containers=( "puppeteer-lb" )
for i in {1..7}; do
  containers+=( "puppeteer-$i" )
done

# Tuning
MAX_KILL_LOOPS=6         # how many times we re-check/re-kill PID before removing
SLEEP_BETWEEN=0.6        # seconds
FORCE_KILL_AFTER=3       # after N loops, escalate to -KILL if still alive

inspect_state() {
  local c="$1"
  # Output: Status=<...> Pid=<...> Error=<...>
  sudo docker inspect -f 'Status={{.State.Status}} Pid={{.State.Pid}} Error={{.State.Error}}' "$c" 2>/dev/null || return 1
}

get_pid() {
  local c="$1"
  # Print just PID number (or empty)
  sudo docker inspect -f '{{.State.Pid}}' "$c" 2>/dev/null || true
}

container_exists() {
  local c="$1"
  sudo docker inspect "$c" >/dev/null 2>&1
}

kill_pid_once() {
  local pid="$1"
  local sig="$2"
  if [[ -n "${pid}" && "${pid}" != "0" ]]; then
    # check if process exists
    if sudo kill -0 "$pid" 2>/dev/null; then
      echo "    -> killing host PID=$pid with -$sig"
      sudo kill "-$sig" "$pid" 2>/dev/null || true
      return 0
    fi
  fi
  return 1
}

echo "== Stopping Puppeteer stack containers =="
for c in "${containers[@]}"; do
  echo ""
  echo ">> $c"

  if ! container_exists "$c"; then
    echo "    (skip) container not found"
    continue
  fi

  # Show initial state
  if st="$(inspect_state "$c")"; then
    echo "    state: $st"
  fi

  loop=1
  while (( loop <= MAX_KILL_LOOPS )); do
    pid="$(get_pid "$c")"

    # If pid empty/0, container likely stopped or in weird state; break to rm -f
    if [[ -z "${pid}" || "${pid}" == "0" ]]; then
      echo "    no host PID (Pid=$pid)."
      break
    fi

    # Decide signal
    sig="TERM"
    if (( loop > FORCE_KILL_AFTER )); then
      sig="KILL"
    fi

    # Try to kill (if process exists)
    if kill_pid_once "$pid" "$sig"; then
      sleep "$SLEEP_BETWEEN"
    else
      # PID not alive; wait a bit and re-check (in case container respawned)
      echo "    PID=$pid not alive; re-checking..."
      sleep "$SLEEP_BETWEEN"
    fi

    # Re-check container PID; if changed, loop continues (handles the "another pid exists" case)
    new_pid="$(get_pid "$c")"
    if [[ -z "${new_pid}" || "${new_pid}" == "0" ]]; then
      echo "    PID cleared (container likely stopped)."
      break
    fi

    if [[ "${new_pid}" != "${pid}" ]]; then
      echo "    PID changed: old=$pid new=$new_pid (will continue loop)"
    else
      echo "    PID still present: $new_pid (loop $loop/$MAX_KILL_LOOPS)"
    fi

    ((loop++))
  done

  echo "    -> removing container (rm -f) $c"
  sudo docker rm -f "$c" >/dev/null 2>&1 || true

  # Verify
  if container_exists "$c"; then
    echo "    WARN: container still exists after rm -f"
  else
    echo "    OK: removed"
  fi
done

echo ""
echo "== Done =="