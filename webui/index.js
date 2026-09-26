import '@material/web/all.js';
import { exec, toast } from 'kernelsu-alt';
import { setupRoute, navigateToHome } from './route.js';
import { getString, loadTranslations } from './language.js';
import * as patchModule from './page/patch.js';
import * as kpmModule from './page/kpm.js';
import * as excludeModule from './page/exclude.js';

export const modDir = '/data/adb/modules/KPatch-Next';
export const persistDir = '/data/adb/kp-next';

export let MAX_CHUNK_SIZE = 96 * 1024;

async function checkRecoveryMarker() {
    const result = await exec('cat /data/adb/kp-next/recovered 2>/dev/null');
    if (result.errno !== 0 || !result.stdout.trim()) return null;

    const info = {};
    result.stdout.trim().split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key) info[key] = val.join('=');
    });
    return info;
}

async function updateStatus() {
    // ---- 检查恢复标记 ----
    const recovery = await checkRecoveryMarker();

    const version = await patchModule.getInstalledVersion();
    const versionText = document.getElementById('version');
    const notInstalled = document.getElementById('not-installed');
    const working = document.getElementById('working');
    const workingTitle = document.getElementById('working-title');
    const workingIconOk = document.getElementById('working-icon-ok');
    const workingIconRecovered = document.getElementById('working-icon-recovered');
    const workingDetail = document.getElementById('working-recovery-detail');
    const uninstallBtn = document.getElementById('uninstall');
    const installedOnly = document.querySelectorAll('.installed-only');

    if (version) {
        versionText.textContent = version;
        kpmModule.refreshKpmList();
        initRehook();
        installedOnly.forEach(el => el.removeAttribute('hidden'));
    } else {
        installedOnly.forEach(el => el.setAttribute('hidden', ''));
    }

    notInstalled.classList.toggle('hidden', version);
    working.classList.toggle('hidden', !version);

    // ---- 恢复状态 → 改 working 卡片显示 ----
    if (recovery) {
        working.classList.add('recovered-state');
        workingTitle.textContent = getString('msg_recovery_title');
        workingIconOk.classList.add('hidden');
        workingIconRecovered.classList.remove('hidden');

        const lines = [
            `${getString('msg_recovery_reason')}: ${recovery.reason || 'unknown'}`,
            `${getString('msg_recovery_count')}: ${recovery.count || '?'}`,
            `${getString('msg_recovery_kernel')}: ${recovery.kernel_before || 'unknown'}`,
        ];
        workingDetail.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
        workingDetail.classList.remove('hidden');

        // 恢复态下隐藏 version 和 uninstall
        versionText.classList.add('hidden');
        if (uninstallBtn) uninstallBtn.classList.add('hidden');
    } else {
        working.classList.remove('recovered-state');
        workingTitle.textContent = getString('status_working');
        workingIconOk.classList.remove('hidden');
        workingIconRecovered.classList.add('hidden');
        workingDetail.classList.add('hidden');
        workingDetail.innerHTML = '';

        versionText.classList.remove('hidden');
        if (uninstallBtn) uninstallBtn.classList.remove('hidden');
    }
}

export function escapeShell(cmd) {
    if (cmd === '' || cmd === null || cmd === undefined) return '""';
    return '"' + cmd.replace(/[\\"$`'[\]]/g, '\\$&') + '"';
}

export async function initInfo() {
    const result = await exec('uname -r && getprop ro.build.version.release && getprop ro.build.fingerprint && getenforce');
    if (import.meta.env.DEV) { // vite debug
        result.stdout = '6.18.2-linux\n16\nLinuxPC\nEnforcing';
    }
    const info = result.stdout.trim().split('\n');
    document.getElementById('kernel-release').textContent = info[0];
    document.getElementById('system').textContent = info[1];
    document.getElementById('fingerprint').textContent = info[2];
    document.getElementById('selinux').textContent = info[3];
}

async function reboot(reason = "") {
    if (reason === "recovery") {
        // KEYCODE_POWER = 26, hide incorrect "Factory data reset" message
        await exec("/system/bin/input keyevent 26");
    }
    exec(`/system/bin/svc power reboot ${reason} || /system/bin/reboot ${reason}`);
}

async function initRehook() {
    const rehook = document.getElementById('rehook');
    const rehookRipple = rehook.querySelector('md-ripple');
    const rehookSwitch = rehook.querySelector('md-switch');
    const isEnabled = await updateRehookStatus();
    if (isEnabled === null) {
        rehookRipple.disabled = true;
        rehookSwitch.disabled = true;
        return;
    }
    rehookSwitch.addEventListener('change', () => {
        setRehookMode(rehookSwitch.selected);
    });
}

async function updateRehookStatus() {
    const rehook = document.getElementById('rehook');
    const rehookSwitch = rehook.querySelector('md-switch');

    let isEnabled = null;

    const result = await exec(`kpatch rehook_status`, { env: { PATH: `${modDir}/bin` } });
    if (result.errno === 0) {
        const mode = result.stdout.split(':')[1].trim();
        if (mode === 'enabled') {
            isEnabled = true;
        } else if (mode === 'disabled') {
            isEnabled = false;
        }
        rehookSwitch.selected = isEnabled;
    }

    return isEnabled;
}

function setRehookMode(isEnable) {
    const mode = isEnable ? "enable" : "disable";
    exec(`
        kpatch rehook ${mode} && echo ${mode} > ${persistDir}/rehook && sh "${modDir}/status.sh"`,
        { env: { PATH: `${modDir}/bin:$PATH` } }
    ).then((result) => {
        if (result.errno !== 0) {
            toast(getString('msg_error', result.stderr));
            return;
        }
        updateRehookStatus();
    })
}

function getMaxChunkSize() {
    exec('getconf ARG_MAX').then((result) => {
        try {
            const max_arg = parseInt(result.stdout.trim());
            if (!isNaN(max_arg)) {
                // max_arg * 0.75 (base64 size increase) - command length
                MAX_CHUNK_SIZE = Math.floor(max_arg * 0.75) - 1024;
            }
        } catch (e) { }
    });
}

export function linkRedirect(link) {
    toast(getString('msg_redirecting_to', link));
    setTimeout(() => {
        exec(`am start -a android.intent.action.VIEW -d ${link}`)
            .then(({ errno }) => {
                if (errno !== 0) {
                    toast(getString('msg_failed_open_link'));
                    window.open(link, "_blank");
                }
            });
    }, 100);
}

// ---- Debug panel ----
async function readFile(path) {
    const result = await exec(`cat ${path} 2>/dev/null`);
    return result.errno === 0 ? result.stdout : null;
}

async function refreshDebugPanel() {
    const kpndir = '/data/adb/kp-next';

    const count = await readFile(`${kpndir}/boot_count`);
    document.getElementById('debug-boot-count').textContent = count ? count.trim() : '(missing)';

    const disable = await exec(`test -f ${kpndir}/disable && echo yes || echo no`);
    document.getElementById('debug-disable').textContent = disable.stdout.trim();

    const recovered = await readFile(`${kpndir}/recovered`);
    document.getElementById('debug-recovered').textContent = recovered ? '(exists)' : '(missing)';

    const slot = await readFile(`${kpndir}/backup/slot`);
    document.getElementById('debug-slot').textContent = slot ? slot.trim() || '(empty)' : '(missing)';

    const lsBackup = await exec(`ls ${kpndir}/backup/ 2>/dev/null`);
    document.getElementById('debug-backup').textContent = lsBackup.stdout.trim() || '(empty)';

    const all = await exec(`echo "=== boot_count ==="; cat ${kpndir}/boot_count 2>/dev/null; echo ""; echo "=== disable ==="; test -f ${kpndir}/disable && echo yes || echo no; echo ""; echo "=== recovered ==="; cat ${kpndir}/recovered 2>/dev/null; echo ""; echo "=== ls backup ==="; ls -la ${kpndir}/backup/ 2>/dev/null`);
    document.getElementById('debug-output').textContent = all.stdout || '(empty)';
}

async function initDebugPanel() {
    const item = document.getElementById('debug');
    const dialog = document.getElementById('debug-dialog');
    if (!item || !dialog) return;

    item.onclick = () => {
        dialog.show();
        refreshDebugPanel();
    };

    dialog.querySelector('.cancel').onclick = () => dialog.close();

    document.getElementById('debug-refresh').onclick = () => refreshDebugPanel();

    document.getElementById('debug-make-recovered').onclick = async () => {
        const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const content = [
            `recovered_at=${date}`,
            'reason=boot_count_exceeded',
            'count=3',
            'slot=_a',
            'backup=/data/adb/kp-next/backup/boot_a.img',
            'kernel_before=5.10.198-android13',
        ].join('\\n');
        await exec(`printf '${content}\\n' > /data/adb/kp-next/recovered`);
        await refreshDebugPanel();
    };

    document.getElementById('debug-clear-recovered').onclick = async () => {
        await exec('rm -f /data/adb/kp-next/recovered');
        await refreshDebugPanel();
    };

    document.getElementById('debug-set-count3').onclick = async () => {
        await exec('echo 3 > /data/adb/kp-next/boot_count');
        await refreshDebugPanel();
    };

    document.getElementById('debug-set-count0').onclick = async () => {
        await exec('echo 0 > /data/adb/kp-next/boot_count');
        await refreshDebugPanel();
    };

    document.getElementById('debug-toggle-disable').onclick = async () => {
        const r = await exec('test -f /data/adb/kp-next/disable && echo yes || echo no');
        if (r.stdout.trim() === 'yes') {
            await exec('rm -f /data/adb/kp-next/disable');
        } else {
            await exec('touch /data/adb/kp-next/disable');
        }
        await refreshDebugPanel();
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('[unresolved]').forEach(el => el.removeAttribute('unresolved'));
    const splash = document.getElementById('splash');
    if (splash) setTimeout(() => splash.querySelector('.splash-icon').classList.add('show'), 20);

    setupRoute();

    // language
    const language = document.getElementById('language');
    const languageDialog = document.getElementById('language-dialog');
    language.onclick = () => languageDialog.show();
    languageDialog.querySelector('.cancel').onclick = () => languageDialog.close();

    // patch/unpatch
    document.getElementById('embed').onclick = patchModule.embedKPM;
    document.getElementById('start').onclick = () => {
        document.querySelector('.trailing-btn').style.display = 'none';
        patchModule.patch("patch");
    }
    document.getElementById('unpatch').onclick = () => {
        document.querySelector('.trailing-btn').style.display = 'none';
        patchModule.patch("unpatch");
    }

    // reboot
    const rebootMenu = document.getElementById('reboot-menu');
    document.getElementById('reboot-btn').onclick = () => {
        rebootMenu.open = !rebootMenu.open;
    }
    rebootMenu.querySelectorAll('md-menu-item').forEach(item => {
        item.onclick = () => {
            reboot(item.getAttribute('data-reason'));
        }
    });
    document.getElementById('reboot-fab').onclick = () => reboot();
    
    // refresh fab
    document.getElementById('refresh-fab').onclick = async () => {
        await initInfo();
        await updateStatus();
    };

    getMaxChunkSize();

    // debug panel
    initDebugPanel();

    await loadTranslations();
    await Promise.all([updateStatus(), initInfo()]);

    excludeModule.initExcludePage();
    kpmModule.initKPMPage();

    // splash screen
    if (splash) {
        setTimeout(() => splash.classList.add('exit'), 50);
        setTimeout(() => splash.remove(), 400);
    }
});

// Overwrite default dialog animation
document.querySelectorAll('md-dialog').forEach(dialog => {
    const defaultOpenAnim = dialog.getOpenAnimation;
    const defaultCloseAnim = dialog.getCloseAnimation;

    dialog.getOpenAnimation = () => {
        const defaultAnim = defaultOpenAnim.call(dialog);
        const customAnim = {};
        Object.keys(defaultAnim).forEach(key => customAnim[key] = defaultAnim[key]);

        customAnim.dialog = [
            [
                [{ opacity: 0, transform: 'translateY(50px)' }, { opacity: 1, transform: 'translateY(0)' }],
                { duration: 300, easing: 'ease' }
            ]
        ];
        customAnim.scrim = [
            [
                [{ 'opacity': 0 }, { 'opacity': 0.32 }],
                { duration: 300, easing: 'linear' },
            ],
        ];
        customAnim.container = [];

        return customAnim;
    };

    dialog.getCloseAnimation = () => {
        const defaultAnim = defaultCloseAnim.call(dialog);
        const customAnim = {};
        Object.keys(defaultAnim).forEach(key => customAnim[key] = defaultAnim[key]);

        customAnim.dialog = [
            [
                [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-50px)' }],
                { duration: 300, easing: 'ease' }
            ]
        ];
        customAnim.scrim = [
            [
                [{ 'opacity': 0.32 }, { 'opacity': 0 }],
                { duration: 300, easing: 'linear' },
            ],
        ];
        customAnim.container = [];

        return customAnim;
    };
});