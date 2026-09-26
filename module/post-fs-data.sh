#!/system/bin/sh

MODDIR=${0%/*}
KPNDIR="/data/adb/kp-next"
SERVICE_D="/data/adb/service.d"
STATUS_SH="$SERVICE_D/kp-next.sh"

# ---- Watchdog: 只累加计数（恢复逻辑在 service.sh 里做） ----
COUNT_FILE="$KPNDIR/boot_count"
COUNT=0
[ -f "$COUNT_FILE" ] && COUNT=$(cat "$COUNT_FILE" 2>/dev/null)
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNT_FILE"

# ---- 如果模块被标记 disable，跳过所有操作 ----
[ -f "$KPNDIR/disable" ] && exit 0

mkdir -p "$SERVICE_D"
cp "$MODDIR/status.sh" "$STATUS_SH"
chmod 755 "$STATUS_SH"