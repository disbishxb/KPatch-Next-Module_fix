# KPatch-Next v0.0.1-fix

> 📦 [Releases 页面 / Releases page](https://github.com/disbishxb/KPatch-Next-Module_fix/releases/tag/v0.0.1-fix)

> 基于官方 KPatch-Next，加固内核修补安全性，修复语言回退问题。
> Hardened boot patching + i18n fix, based on upstream KPatch-Next.

---

## 🇨🇳 中文

### 修复内容

**内核修补安全**
- patch 前自动备份原厂 boot 到 `/data/adb/kp-next/backup/`
- patch 后校验内核和 new-boot.img 完整性
- 分区大小检查，避免写入截断
- unpatch 优先从备份 dd 恢复原厂 boot

**自动恢复**
- 连续 3 次启动失败后，自动还原原厂 boot
- 恢复后在 WebUI 显示"上次启动失败，已自动恢复"
- 恢复详情：原因、失败次数、恢复前内核版本

**语言修复**
- 修复 `zh-cn`（小写）无法匹配 `zh-CN` 的问题
- 模块卡片状态文字跟随 WebUI 选的语言

**WebUI**
- Home 卡片在恢复态显示红色警告
- Home / KPM 页左下角刷新按钮
- Settings 内置 Debug Panel（测试用）

### ⚠️ 首次使用必读

如果你**之前已用旧版 patch 过内核**：

1. 打开 WebUI → 点 **Unpatch**
2. 重启设备
3. 再点 **Patch**
4. 这次会自动创建原厂 boot 备份

**没有这一步，自动恢复机制不会生效**（因为找不到原厂 boot 备份）。

### 安装

1. 在 KernelSU / APatch / Magisk 管理器里安装 zip
2. 重启设备
3. 打开 KPatch-Next WebUI

---

## 🇬🇧 English

### Fixes

**Boot patching safety**
- Auto-backup stock boot to `/data/adb/kp-next/backup/` before patching
- Post-patch sanity check for both kernel and new-boot.img
- Partition size guard to prevent truncated writes
- Unpatch prefers dd restore from stock backup

**Auto-recovery**
- Automatically restores stock boot after 3 consecutive boot failures
- WebUI shows "Last boot failed, auto-recovered" on recovery
- Recovery details: reason, failed count, previous kernel version

**i18n fix**
- Case-insensitive language matching (`zh-cn` → `zh-CN`)
- Module card status follows the language selected in WebUI

**WebUI**
- Home card turns red when recovery state detected
- Refresh FAB on Home / KPM tabs
- Debug Panel in Settings (for testing)

### ⚠️ First-time users

If you have **already patched with an older version**:

1. Open WebUI → click **Unpatch**
2. Reboot
3. Click **Patch** again
4. This time it will create the stock boot backup

**Without this step, auto-recovery won't work** (no backup to restore from).

### Installation

1. Install the zip via KernelSU / APatch / Magisk manager
2. Reboot
3. Open KPatch-Next WebUI

---

## 📦 Changelog / 完整改动

- Harden boot patch flow (backup + double sanity check + size guard)
- Auto-recovery watchdog (boot_count >= 3 triggers rollback)
- Case-insensitive language matching
- WebUI recovery state display + refresh button
- Debug Panel in Settings

- 加固 boot patch 流程（备份 + 双重校验 + 大小检查）
- 自动恢复 watchdog（boot_count >= 3 触发回滚）
- 语言大小写无关匹配
- WebUI 恢复状态显示 + 刷新按钮
- Settings 内置 Debug Panel

---

## 🔧 Compatibility / 兼容性

- arm64 devices / arm64 设备
- KernelSU / Magisk

---

## 📄 License / 许可

Same as upstream KPatch-Next. See [LICENSE](LICENSE).

与上游 KPatch-Next 保持一致，见 [LICENSE](LICENSE) 文件。

---

<sub>🤖 README AI-generated / README 由 AI 生成。已人工审核，如有疑问以实际代码为准。</sub>