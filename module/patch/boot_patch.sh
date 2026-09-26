#!/system/bin/sh
#######################################################################################
# APatch Boot Image Patcher (hardened for KPatch-Next)
# Based on https://github.com/bmax121/APatch
#######################################################################################

MODPATH=${0%/*}
ARCH=$(getprop ro.product.cpu.abi)

# Load utility functions
. "$MODPATH/util_functions.sh"

BOOTIMAGE=$1
FLASH_TO_DEVICE=$2
shift 2

[ -e "$BOOTIMAGE" ] || { >&2 echo "! $BOOTIMAGE does not exist"; exit 1; }

# Check for dependencies
command -v magiskboot >/dev/null 2>&1 || { >&2 echo "! Command magiskboot not found"; exit 1; }
command -v kptools >/dev/null 2>&1 || { >&2 echo "! Command kptools not found"; exit 1; }

# ---- Persistent backup ----
KPNDIR="/data/adb/kp-next"
BACKUP_DIR="$KPNDIR/backup"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null

# Get slot reliably: prefer getprop, fallback to /proc/cmdline
SLOT=$(getprop ro.boot.slot_suffix)
if [ -z "$SLOT" ]; then
  SLOT=$(grep -o 'androidboot.slot_suffix=[^ ]*' /proc/cmdline 2>/dev/null | cut -d= -f2)
fi

# Record slot for later use by service.sh / boot_unpatch.sh
echo "$SLOT" > "$BACKUP_DIR/slot"

BACKUP_IMG="$BACKUP_DIR/boot${SLOT}.img"

# Save stock boot image ONCE (never overwrite if exists)
if [ ! -f "$BACKUP_IMG" ]; then
  echo "- Backing up stock boot to $BACKUP_IMG"
  dd if="$BOOTIMAGE" of="$BACKUP_IMG" bs=4096 2>/dev/null
  sync
  chmod 600 "$BACKUP_IMG" 2>/dev/null
fi
if [ ! -f "$BACKUP_IMG" ]; then
  >&2 echo "! Failed to create stock boot backup"
  exit 1
fi

# ---- Unpack ----
if [ ! -f kernel ]; then
  echo "- Unpacking boot image"
  magiskboot unpack "$BOOTIMAGE" >/dev/null 2>&1
  if [ $? -ne 0 ]; then
    >&2 echo "! Unpack error: $?"
    exit 1
  fi
fi

# ---- Save unpacked stock kernel (for manual recovery) ----
if [ ! -f "$BACKUP_DIR/kernel_stock" ] && [ -f kernel ]; then
  cp kernel "$BACKUP_DIR/kernel_stock"
  chmod 600 "$BACKUP_DIR/kernel_stock" 2>/dev/null
  sync
fi

# ---- Pre-checks ----
if [ -z "$(kptools -i kernel -f 2>/dev/null | grep CONFIG_KALLSYMS=y)" ]; then
  >&2 echo "! Patcher aborted: CONFIG_KALLSYMS is not enabled in kernel"
  exit 1
fi

if [ -z "$(kptools -i kernel -f 2>/dev/null | grep CONFIG_KALLSYMS_ALL=y)" ]; then
  >&2 echo "! WARNING: CONFIG_KALLSYMS_ALL not set."
  >&2 echo "! KernelPatch may fail to resolve some symbols."
  >&2 echo "! Continuing anyway — original boot is safely backed up."
fi

mv kernel kernel.ori

echo "- Patching kernel"
kptools -p -i kernel.ori -k kpimg -o kernel "$@"
patch_rc=$?

if [ $patch_rc -ne 0 ]; then
  >&2 echo "! Patch kernel error: $patch_rc"
  exit 1
fi

# ---- Sanity check: patched kernel must be parseable ----
if [ -z "$(kptools -i kernel -l 2>/dev/null | grep patched=true)" ]; then
  >&2 echo "! Post-patch sanity check failed: kernel is not marked as patched"
  exit 1
fi

# ---- Repack ----
echo "- Repacking boot image"
magiskboot repack "$BOOTIMAGE" >/dev/null 2>&1
if [ $? -ne 0 ]; then
  >&2 echo "! Repack error: $?"
  exit 1
fi

# ---- Post-repack sanity check ----
if [ ! -f new-boot.img ]; then
  >&2 echo "! new-boot.img was not created"
  exit 1
fi
magiskboot unpack new-boot.img >/dev/null 2>&1
if [ $? -ne 0 ]; then
  >&2 echo "! new-boot.img is corrupt (cannot unpack)"
  exit 1
fi

# ---- Guard against size overflow ----
if [ -b "$BOOTIMAGE" ]; then
  img_sz=$(stat -c '%s' new-boot.img 2>/dev/null)
  blk_sz=$(blockdev --getsize64 "$BOOTIMAGE" 2>/dev/null)
  if [ -n "$img_sz" ] && [ -n "$blk_sz" ] && [ "$img_sz" -gt "$blk_sz" ]; then
    >&2 echo "! new-boot.img ($img_sz bytes) larger than partition ($blk_sz bytes)"
    exit 1
  fi
fi

# ---- Flash or save ----
if [ "$FLASH_TO_DEVICE" = "true" ]; then
  if { [ -b "$BOOTIMAGE" ] || [ -c "$BOOTIMAGE" ]; } && [ -f "new-boot.img" ]; then
    echo "- Flashing new boot image"
    flash_image new-boot.img "$BOOTIMAGE"
    if [ $? -ne 0 ]; then
      >&2 echo "! Flash error: $?"
      save_image_to_storage "new-boot.img"
      exit 1
    fi
    # Initialize boot counter for watchdog
    echo "1" > "$KPNDIR/boot_count"
  fi
  echo "- Successfully Flashed!"
else
  save_image_to_storage "new-boot.img"
  echo "- Successfully Patched!"
fi