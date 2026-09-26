#!/system/bin/sh
#######################################################################################
# APatch Boot Image Unpatcher (hardened for KPatch-Next)
#######################################################################################

MODPATH=${0%/*}
ARCH=$(getprop ro.product.cpu.abi)

# Load utility functions
. "$MODPATH/util_functions.sh"

BOOTIMAGE=$1

[ -e "$BOOTIMAGE" ] || { echo "- $BOOTIMAGE does not exist!"; exit 1; }

echo "- Target image: $BOOTIMAGE"

# Check for dependencies
command -v magiskboot >/dev/null 2>&1 || { echo "- Command magiskboot not found!"; exit 1; }
command -v kptools >/dev/null 2>&1 || { echo "- Command kptools not found!"; exit 1; }

# ---- Preferred path: restore from persistent stock backup ----
KPNDIR="/data/adb/kp-next"
BACKUP_DIR="$KPNDIR/backup"

SLOT=$(cat "$BACKUP_DIR/slot" 2>/dev/null)
[ -z "$SLOT" ] && SLOT=$(getprop ro.boot.slot_suffix)

BACKUP_IMG="$BACKUP_DIR/boot${SLOT}.img"

if [ -f "$BACKUP_IMG" ] && [ -b "$BOOTIMAGE" ]; then
  echo "- Restoring stock boot from $BACKUP_IMG"
  dd if="$BACKUP_IMG" of="$BOOTIMAGE" bs=4096 2>/dev/null
  rc=$?
  sync
  if [ $rc -eq 0 ]; then
    echo "- Restore successful"
    echo "0" > "$KPNDIR/boot_count"
    rm -f "$KPNDIR/disable"
    exit 0
  else
    >&2 echo "! dd restore failed (rc=$rc), falling back to kptools unpatch"
  fi
fi

# ---- Fallback: unpack + kptools -u + repack ----
if [ ! -f kernel ]; then
  echo "- Unpacking boot image"
  magiskboot unpack "$BOOTIMAGE" >/dev/null 2>&1
  if [ $? -ne 0 ]; then
    >&2 echo "! Unpack error: $?"
    exit 1
  fi
fi

if [ -z "$(kptools -i kernel -l 2>/dev/null | grep patched=false)" ]; then
  echo "- Kernel has been patched, unpatching"
  mv kernel kernel.ori
  kptools -u --image kernel.ori --out kernel
  if [ $? -ne 0 ]; then
    >&2 echo "! Unpatch error: $?"
    exit 1
  fi
  echo "- Repacking boot image"
  magiskboot repack "$BOOTIMAGE" >/dev/null 2>&1
  if [ $? -ne 0 ]; then
    >&2 echo "! Repack error: $?"
    exit 1
  fi

  if [ -f "new-boot.img" ]; then
    echo "- Flashing boot image"
    flash_image new-boot.img "$BOOTIMAGE"
    if [ $? -ne 0 ]; then
      >&2 echo "! Flash error: $?"
      save_image_to_storage "new-boot.img"
      exit 1
    fi
  fi
else
  echo "- Kernel is not patched, nothing to do"
fi

echo "- Unpatch successful"
true