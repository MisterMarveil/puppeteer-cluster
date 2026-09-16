 
#!/usr/bin/env bash
set -euo pipefail

LOCK_FILE="/var/lock/puppeteer_recycle_stack.lock"
LOG_DIR="/var/log/puppeteer-maintenance"
LOG_FILE="$LOG_DIR/recycle_$(date +'%Y-%m-%d_%H-%M-%S').log"

STOP_SCRIPT="/home/marveil/puppeteer-cluster/stop_puppeteer_stack.sh"
REBUILD_SCRIPT="/home/marveil/puppeteer-cluster/rebuild_puppeteer.sh"

mkdir -p "$LOG_DIR"

echo "Nettoyage des anciens logs"
find "$LOG_DIR" -type f -name "recycle_*.log" -mtime +14 -delete 2>/dev/null || true
echo "Nettoyage des anciens logs terminé"

exec >> "$LOG_FILE" 2>&1

echo "============================================================"
echo "Puppeteer recycle started at $(date)"
echo "Host: $(hostname)"
echo "============================================================"

(
  flock -n 200 || {
    echo "Another puppeteer recycle is already running. Exiting."
    exit 0
  }

  echo ""
  echo "=== 1) Killing old google-chrome headless processes older than 30 minutes ==="

  OLD_CHROME_PIDS="$(ps -eo pid,etimes,cmd | awk '/google-chrome/ && /headless/ && $2 > 1800 {print $1}' || true)"

  if [ -n "$OLD_CHROME_PIDS" ]; then
    echo "$OLD_CHROME_PIDS" | xargs -r kill -TERM
    echo "Sent TERM to old Chrome PIDs:"
    echo "$OLD_CHROME_PIDS"

    sleep 10

    REMAINING_CHROME_PIDS="$(ps -eo pid,etimes,cmd | awk '/google-chrome/ && /headless/ && $2 > 1810 {print $1}' || true)"

    if [ -n "$REMAINING_CHROME_PIDS" ]; then
      echo "$REMAINING_CHROME_PIDS" | xargs -r kill -KILL
      echo "Sent KILL to remaining Chrome PIDs:"
      echo "$REMAINING_CHROME_PIDS"
    else
      echo "No remaining old Chrome process after TERM."
    fi
  else
    echo "No old Chrome headless process found."
  fi

  echo ""
  echo "=== 2) Cleaning old Puppeteer temporary profiles ==="
  rm -rf /tmp/puppeteer_dev_chrome_profile-* 2>/dev/null || true

  echo ""
  echo "=== 3) Running stop_puppeteer_stack.sh ==="

  if [ ! -x "$STOP_SCRIPT" ]; then
    echo "ERROR: STOP_SCRIPT is not executable or not found: $STOP_SCRIPT"
    exit 1
  fi

  bash "$STOP_SCRIPT"

  echo ""
  echo "=== 4) Waiting before rebuild ==="
  sleep 5

  echo ""
  echo "=== 5) Running rebuild_puppeteer.sh ==="

  if [ ! -x "$REBUILD_SCRIPT" ]; then
    echo "ERROR: REBUILD_SCRIPT is not executable or not found: $REBUILD_SCRIPT"
    exit 1
  fi

  bash "$REBUILD_SCRIPT"

  echo ""
  echo "=== 6) Final status ==="
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "puppeteer|NAMES" || true

  echo ""
  echo "=== 7) CPU check ==="
  mpstat -P ALL 1 3 2>/dev/null || true

  echo ""
  echo "Puppeteer recycle completed successfully at $(date)"

) 200>"$LOCK_FILE"