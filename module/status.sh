#!/bin/sh

MODDIR="/data/adb/modules/KPatch-Next"
KPNDIR="/data/adb/kp-next"
PATH="$MODDIR/bin:$PATH"

PROP_FILE="$MODDIR/module.prop"
PROP_BAK="$PROP_FILE.bak"
LANG_FILE="$KPNDIR/language"

set_prop() {
    local prop="$1"
    local value="$2"
    local file="$3"

    if ! grep -q "^$prop=" "$file"; then
        echo "$prop=$value" >> "$file"
        return
    fi
    # 用 @ 作 sed 分隔符，避免 value 里的 | 与 / 冲突
    sed "s@^$prop=.*@$prop=$value@" "$file" > "$file.tmp"
    cat "$file.tmp" > "$file"
    rm -f "$file.tmp"
}

restore_prop_if_needed() {
    grep -q "^id=" "$PROP_FILE" && return
    [ -f "$PROP_BAK" ] && cat "$PROP_BAK" > "$PROP_FILE"
}

# --- Language detection ---
# Priority: WebUI-selected language > system locale > English fallback
detect_lang() {
    if [ -f "$LANG_FILE" ]; then
        saved="$(cat "$LANG_FILE" 2>/dev/null | tr -d '[:space:]')"
        case "$saved" in
            ""|"default") ;;
            *) echo "$saved"; return ;;
        esac
    fi

    sys_locale="$(getprop persist.sys.locale)"
    [ -z "$sys_locale" ] && sys_locale="$(getprop ro.product.locale)"
    if [ -n "$sys_locale" ]; then
        echo "$sys_locale"; return
    fi

    echo "en"
}

LANG_CODE="$(detect_lang | tr '[:upper:]' '[:lower:]' | cut -d'-' -f1)"

# --- Localized strings ---
case "$LANG_CODE" in
    zh)
        active="状态：已激活 😊"
        inactive="状态：未激活 😕"
        info="信息：内核尚未修补 ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    ja)
        active="状態：有効 😊"
        inactive="状態：無効 😕"
        info="情報：カーネル未パッチ ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    ko)
        active="상태: 활성 😊"
        inactive="상태: 비활성 😕"
        info="정보: 커널이 아직 패치되지 않음 ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    ru)
        active="Статус: активен 😊"
        inactive="Статус: неактивен 😕"
        info="Инфо: ядро ещё не пропатчено ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    de)
        active="Status: aktiv 😊"
        inactive="Status: inaktiv 😕"
        info="Info: Kernel noch nicht gepatcht ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    fr)
        active="Statut : actif 😊"
        inactive="Statut : inactif 😕"
        info="Info : noyau pas encore patché ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    it)
        active="Stato: attivo 😊"
        inactive="Stato: inattivo 😕"
        info="Info: kernel non ancora patchato ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    id)
        active="Status: aktif 😊"
        inactive="Status: tidak aktif 😕"
        info="Info: kernel belum dipatch ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    tr)
        active="Durum: etkin 😊"
        inactive="Durum: etkin değil 😕"
        info="Bilgi: çekirdek henüz yamalanmadı ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    uk)
        active="Статус: активний 😊"
        inactive="Статус: неактивний 😕"
        info="Інфо: ядро ще не пропатчено ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    ar)
        active="الحالة: نشط 😊"
        inactive="الحالة: غير نشط 😕"
        info="معلومة: لم يتم ترقيع النواة بعد ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    bn)
        active="স্ট্যাটাস: সক্রিয় 😊"
        inactive="স্ট্যাটাস: নিষ্ক্রিয় 😕"
        info="তথ্য: কার্নেল এখনো প্যাচ করা হয়নি ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    pt)
        active="Status: ativo 😊"
        inactive="Status: inativo 😕"
        info="Info: kernel ainda não foi patchado ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
    *)
        active="Status: active 😊"
        inactive="Status: inactive 😕"
        info="info: kernel not patched yet ❌"
        fmt_active="$active | kpmodule: %s 💉 | rehook: %s 🪝"
        ;;
esac

string="$inactive | $info"

# self cleanup if module removed improperly
if [ ! -d "$MODDIR" ]; then
    rm -f "$(realpath "$0")"
    exit 0
fi

until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 1
done

if [ -n "$(kpatch hello)" ]; then
    KPM_COUNT="$(kpatch kpm num 2>/dev/null || echo 0)"
    [ -z "$KPM_COUNT" ] && KPM_COUNT=0

    REHOOK_MODE="$(kpatch rehook_status 2>/dev/null | awk '{print $NF}')"
    [ -z "$REHOOK_MODE" ] && REHOOK_MODE="enabled"

    string="$(printf "$fmt_active" "$KPM_COUNT" "$REHOOK_MODE")"
fi

restore_prop_if_needed

set_prop "description" "$string" "$PROP_FILE"