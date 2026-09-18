# 桌面端功能梳理 + 增强/增删建议报告

> 生成时间：2026-09-17 · 对象：D:\Timer\dcm\backup（FocusFlow，Next.js 16 + Electron 41）
> 方法：逐文件读码取证（electron/、components/、lib/），与既有 M8 报告（audit-reports/M8-desktop-mobile.md）交叉复核，标注 M8 之后的变化。
> 本轮同时**落地**了「番茄钟全屏严格模式」（第二节）。

---

## 一、桌面端能力现状清单（读码实证）

### 1.1 窗口与生命周期（electron/main.js）

| 能力 | 实现位置 | 备注 |
|---|---|---|
| 单实例锁 + 二次启动唤起主窗口 | main.js:29-45 | |
| 主窗口：无边框自绘标题栏、1000×700 最小尺寸、`backgroundThrottling:false` | main.js:126-184 | |
| 关闭主窗口→隐藏到托盘（常驻） | main.js:166-176 | 本次增加严格模式拦截分支 |
| 全屏切换（含 web 端 requestFullscreen 兜底） | main.js:603-623、preload.js:46-52 | |
| 桌面小组件窗口 340×560 / 番茄浮窗 320×120（置顶、透明、跳过任务栏） | main.js:187-269 | |
| **全屏严格模式 kiosk 锁定**（新增） | main.js:24-78、603-660 | kiosk + screen-saver 级置顶 + 拦截 Esc/关闭/失焦拉回 |
| **托盘紧急解锁 + 锁定态菜单项**（新增） | main.js:299-311 | 渲染层卡死时的兜底出口 |

### 1.2 系统集成

| 能力 | 位置 | 状态 |
|---|---|---|
| 托盘（tooltip 显示今日待办与番茄状态、双击唤起、右键菜单） | main.js:271-352 | ✅ |
| 开机自启 `openAtLogin + openAsHidden` | main.js:319-339、655-662 | ✅（Windows 下 openAsHidden 不生效，仍会弹窗） |
| 全局快捷键 Ctrl+Shift+F/N/P | main.js:523-537 | ⚠️ 未检查 `register()` 返回值，冲突无提示 |
| 系统原生通知（含点击回主窗口） | main.js:409-428 | ⚠️ `silent:false` 硬编码，无动作按钮 |
| 剪贴板监听（2s 轮询，仅识别 URL） | main.js:430-458 | ⚠️ 非 URL 文本不触发 |
| 前台应用采样（仅 Windows，30s，PowerShell + Win32） | main.js:459-519 | ✅ 仅本地存储 |
| 电源监控 suspend/resume/lock-screen/unlock-screen | main.js:539-556 | ✅ 挂起即暂停番茄钟 |
| **阻止系统休眠**（新增，powerSaveBlocker） | main.js:1、58-64 | 本次随严格模式引入 |
| 自动更新（electron-updater，手动下载） | main.js:554-579 | ❌ 发布地址仍是 example.com 占位 |
| PDF 导出（隐藏窗口 + 保存对话框，2MB 上限） | main.js:717-752 | ✅ |
| 凭据保险库（safeStorage，拒绝明文降级） | main.js:754-790 | ✅ |
| 屏蔽调度器（主进程定时窗口 + 崩溃重放） | shield-scheduler.js、main.js:792-815 | ✅ |

### 1.3 系统级专注屏蔽（electron/system-shield.js）

- hosts 写入（IPv4/IPv6 + www 变体）、备份 `~/.focusflow/hosts.backup`、标记块启停、flushdns：:106-284
- **UAC 提权回退**（普通权限 EACCES/EPERM → 提权 PowerShell 写 hosts，以文件内容比对判定成败）：:185-233 ← M8 写作「无提权流程」，此项已修复
- 应用查杀：立即 taskkill + 每 3s tasklist CSV 精确进程名扫描：:287-321（仅 Windows）
- 白名单模式：默认干扰清单减白名单求差集：:26-94
- 注入防护：域名/进程名正则校验，spawn 全走 argv 数组：:59-79

### 1.4 渲染层桌面体验

自绘标题栏（title-bar.tsx）、桌面小组件（desktop-widget.tsx）、番茄浮窗（timer-float.tsx）、剪贴板建任务与拖放批量建任务（desktop-app.tsx:124-266）、命令面板、全局搜索、跨窗番茄状态同步。

---

## 二、本次落地：番茄钟全屏严格模式

### 2.1 产品决策（已确认）

| 维度 | 选择 |
|---|---|
| 锁定强度 | **强锁定**：kiosk 全屏 + 置顶 + 拦截 Esc/关闭 + 失焦自动拉回 |
| 退出策略 | **长按 3 秒放弃** → 二次确认 → 记放弃会话 + 树木枯萎 → 解锁退出 |
| 系统联动 | 自动开启专注屏蔽 ✅ / 阻止休眠 ✅ / 静默其他通知 ✅ |

### 2.2 实现清单

| 层 | 文件 | 改动 |
|---|---|---|
| 主进程 | `electron/main.js` | 新增 `applyStrictLock()` / `pullBackToStrictLock()`；`strict-lock-set`、`strict-lock-status` IPC；拦截 close / leave-full-screen / blur；powerSaveBlocker；托盘紧急解锁；before-quit 与 will-quit 解锁 |
| 桥 | `electron/preload.js` | `setStrictLock` / `getStrictLockStatus` / `onStrictLockViolation` / `onStrictLockChanged` |
| 类型 | `lib/types.ts`、`lib/types/electron.d.ts` | `PomodoroStrictMode` 增加 5 个可选字段；ElectronAPI 补全 |
| 状态 | `lib/store/slices/pomodoro-slice.ts` | 严格模式默认值（含全屏相关项） |
| 逻辑 | `lib/use-strict-fullscreen.ts`（新增） | 锁定生命周期、屏蔽联动、防休眠、通知静默、违规计数、配置兜底解析 |
| UI | `components/focus/immersive-timer.tsx` | 锁定徽章、隐藏重置/跳过与时长设置、长按放弃按钮（conic-gradient 进度环）、离开尝试提示、Esc 拦截与全屏拉回 |
| 串联 | `components/focus/pomodoro-timer.tsx` | 进全屏自动开始（受每日上限约束）、长按放弃确认流程、退出保护、设置面板接线 |
| 设置 | `components/focus/timer-settings-dialog.tsx` | 严格模式分区（总开关 + 每日上限 + 锁定到本轮结束 + 全屏严格模式及其 4 个子项 + 非 Electron 降级提示） |
| 快捷键 | `lib/shortcuts.ts` | 锁定期间禁用全部应用快捷键（含 F 退出全屏） |
| 通知 | `lib/use-auto-notifications.ts` | 锁定期间静默到期提醒 |
| 屏蔽 | `lib/dnd.ts` | 导出 `getUserShieldConfig()` 供严格模式复用同一套规则 |

### 2.3 安全兜底

kiosk 属于高风险能力，做了三层出口：① 全屏内长按放弃（正常路径，且需二次确认）；② 托盘「🔓 解除严格模式锁定」（渲染层异常时）；③ 应用退出（before-quit）强制解锁。失焦拉回有 2s 节流，避免 kiosk 自身切换造成的抖动风暴。

### 2.4 已知限制

- kiosk 依赖 Electron/系统窗口管理器，不能被绕过但也不是内核级封锁（任务管理器仍可结束进程）。
- 浏览器/PWA 环境无系统级锁定，自动降级为「界面锁定 + 放弃确认」并在设置里明确提示。
- 暂停状态不解除锁定，但会解除系统屏蔽（复用 `useAutoShield` 的运行态判定）。

---

## 三、需要增强的功能

| 优先级 | 事项 | 现状与风险 | 建议 | 落点 |
|---|---|---|---|---|
| **P0** ✅ 已修复<br/>(2026-09-18) | hosts 写入失败无 UI 反馈 | ~~提权被拒/杀软拦截时仅 `console.error`，界面仍显示「已开启」→ 屏蔽静默失效~~ **已解决** | 主进程记录原因码（`uac_declined` / `write_failed` / `reverted` / `exception`），并在写入后**回读 hosts 自检**（写入成功 ≠ 生效）；新增 `shield-verify` IPC 作重试入口；屏蔽页展示具体原因 + 重试按钮，未生效时顶部徽章由绿色「运行中」变红为「未生效」，生效时显示回读校验通过 | system-shield.js、preload.js、lib/types/electron.d.ts、focus-shield.tsx、dnd.ts |
| **P0** | 自动更新不可用（已污染发布物） | `package.json:28`、`scripts/build-electron.js:8`、`server/package.json:28` 均为 example.com 占位；**已打包产物** `dist-app/win-unpacked/resources/app-update.yml:2` 同样写死该地址 | 落地真实发布地址 + 代码签名；**重新打包前必须清掉 dist-app 里的 app-update.yml**；帮助菜单加「检查更新」 | package.json、scripts/build-electron.js、dist-app、title-bar.tsx |
| **P0** | 浏览器 DoH 绕过屏蔽 | 仅 hosts 层，Chrome/Edge 开安全 DNS 即失效 | 检测并提示；中远期做浏览器扩展或本地代理过滤 | system-shield.js |
| **P1** | 窗口状态不记忆 | 每次启动回到默认 1400×900 居中，最大化/位置不保留 | 启动时恢复 bounds 与 maximized 到 userData | main.js:126-184 |
| **P1** | 全局快捷键不可配置 | 3 个固定组合，注册失败无提示（main.js:523-537） | 可配置面板 + 注册失败 toast；补充 macOS Cmd 约定 | main.js、settings-view.tsx |
| **P1** | 托盘信息密度低 | tooltip 只有「今日待办 N 项｜专注中」，无剩余时间 | tooltip 补 `24:31 · 专注中`，菜单加「今日专注 3 个 / 120 分钟」 | main.js:271-317、desktop-app.tsx:156-187 |
| **P1** | 小组件「置顶」按钮空实现 | 仅本地 useState，无 IPC，窗口始终置顶 | 补 `setAlwaysOnTop` IPC 并持久化，或直接移除该按钮 | desktop-widget.tsx、main.js、preload.js |
| **P1** | 防休眠仅限严格模式 | 普通专注时息屏仍会拖慢计时体感 | 设置项「专注时保持屏幕常亮」复用现有 powerSaveBlocker 通道 | use-strict-fullscreen.ts、timer-settings-dialog.tsx |
| **P2** | 引擎只跑在主窗口 | 主窗口 webContents 崩溃 → 小组件/托盘控制全部失效 | 主进程持轻量计时兜底或崩溃后提示重启 | pomodoro-engine.ts、main.js |
| **P2** | 严格模式违规未持久化 | 会话内的离开次数刷新即失忆 | 会话记录增加 `escapeAttempts`，统计页展示放弃率 | lib/types.ts、pomodoro-completion.ts、analytics-view.tsx |
| **P2** | 端口占用误判 | 健康检查只问「3000 端口有 HTTP 响应」，被其他服务占用时会加载到陌生内容 | 启动时探测端口并校验自定义响应头，或改用随机端口 | main.js:354-400 |
| **P2** | 通知能力单薄 | 无 `requireInteraction`、无动作按钮 | 透传参数；番茄完成通知加「继续下一轮/休息」 | main.js:409-428、lib/browser-notifications.ts |

---

## 四、建议删除 / 收敛的项

| 项 | 证据 | 建议 |
|---|---|---|
| `lib/white-noise-context.tsx`（376 行） | 挂在 `app/layout.tsx:5/:67`，但 `useWhiteNoiseContext` 零消费方（V4 报告 Top1，至今未清理） | **删除**，减少每个页面的无效加载与维护成本 |
| 第二个 Electron 壳 | `android-app/electron/main.cjs`（420×820 手机壳，无托盘/快捷键/更新） | 从发布物排除或文档化为「仅预览」 |
| `ProductivityInsight` 类型 | `lib/types.ts:384` 标 `@deprecated 未使用`，全仓无引用 | **删除** |
| 快捷键与浏览器保留键冲突 | `lib/shortcuts.ts:40-76` 使用 Ctrl+T/P/D/G/A/S（浏览器为新建标签页等） | 收敛为 Ctrl+Shift 变体，或改为可配置 |
| 严格模式锁定判定三处重复 | `pomodoro-timer.tsx:114`、`usePomodoroControls.ts:61`、`pomodoro-engine.ts:216` 各写一遍 `isLocked` | 收敛为 `lib/strict-mode.ts` 单一函数（本轮已抽出配置解析 `resolveStrictFullscreen`，判定逻辑待合并） |
| 剪贴板仅识别 URL | main.js:437 只放行 `^(https?://|www\.)` | 非 URL 文本直接进快速捕获，与 web 端打通 |

---

## 五、建议新增的功能（按性价比排序）

1. **屏蔽生效自检 UI**（配合 P0 第一条，成本最低、收益最高）
2. **番茄钟托盘倒计时**（tooltip + 菜单，桌面端高频诉求）
3. **专注会话崩溃恢复**：引擎心跳落盘，重启后提示「上次有 1 个未完成的番茄，是否补记」
4. **快捷键可配置**（顺带解决保留键冲突）
5. **窗口布局记忆**（bounds + maximized）
6. **严格模式统计**：放弃率、平均违规次数纳入统计页，形成行为闭环

---

## 六、上线前必须实测的清单（严格模式）

- [ ] Esc / Alt+F4 / Alt+Tab / Win 键 / 切换虚拟桌面 是否均被拦截并回到专注
- [ ] 长按 3 秒放弃：进度环、二次确认、放弃记录、树木枯萎、解锁退出
- [ ] 屏蔽联动：进入即写 hosts，解锁后 hosts 还原（`~/.focusflow/hosts.backup` 可用）
- [ ] 防休眠：锁定期间不熄屏；解锁后恢复系统原有电源策略
- [ ] 托盘紧急解锁与 Ctrl+Shift+Alt+U 兜底
- [ ] 非 Electron（浏览器）打开时的降级提示与行为
- [ ] 开发态注意：打开 DevTools 会触发 blur 拉回（已 2s 节流，仅开发时干扰）

---

## 七、建议执行顺序

| 批次 | 内容 | 理由 |
|---|---|---|
| **第 1 批：发布阻塞项** | 清 app-update.yml + 真实发布地址；屏蔽生效自检 UI；删 `white-noise-context.tsx` 与 `ProductivityInsight` | 前两条决定"发出去的包能不能用、屏蔽是不是真的生效"，第三条零风险纯减负 |
| **第 2 批：桌面体验补齐** | 托盘倒计时、窗口布局记忆、小组件置顶接 IPC（或删按钮）、防休眠扩到普通专注、快捷键可配置（顺带解决保留键冲突） | 都是桌面端高频体感项，改动局部、互不影响 |
| **第 3 批：健壮性与闭环** | 严格模式违规持久化 + 统计页放弃率、会话崩溃恢复、端口占用校验、通知动作按钮 | 依赖前两批稳定后再做，避免在变动中的代码上叠加 |

第 1 批里性价比最高的**屏蔽生效自检 UI 已于 2026-09-18 落地**（见第三节首行，含主进程回读自检 + 界面原因展示 + 重试）。剩余两条 —— 自动更新地址（含 `dist-app` 里的 app-update.yml）与 DoH 绕过 —— 仍需处理，且都属发布阻塞项。

### 复核记录（2026-09-18）

对 2026-09-17 版报告做了二次核验，结论全部仍然成立，并补强两处：

- 自动更新占位符不止源码两处，`dist-app/win-unpacked/resources/app-update.yml:2` 已写死，属**已污染发布物**（原报告仅标为源码问题）。
- `globalShortcut.register()` 在 main.js:608/612/617 三次调用均未接收返回值，注册冲突完全静默——已复验。
- `desktop-widget.tsx:188` 的 `isPinned` 为纯本地状态，无 IPC 出口——已复验。
- 昨日落地的全屏严格模式代码（`strict-lock-set`、`strictLockActive`、`preload.js:116`）完好在库。

### 本轮实施：屏蔽生效自检（P0 第一条）

- `system-shield.js`：新增 `verifyHostsBlock()`（回读 hosts 确认标记块存在）、`describeWriteFailure()`
  （原因码翻译）、`recordShieldHealth()` / `getShieldHealth()`；`applyWebsiteBlocks()` 写入后即自检；
  `startSystemShield()` 与 `getShieldStatus()` 回传 `health`；新增 `shield-verify` IPC（激活时重放写入 = 重试）。
- **关键设计**：`applyWebsiteBlocks` 保持返回布尔值不变，健康信息走模块级 `lastShieldHealth` 侧路记录。
  若改成返回对象，3 处调用点的真值判断会被"对象恒真"击穿，静默引入更难查的 bug。
- 渲染层：`focus-shield.tsx` 此前 `systemShieldStatus` **只赋值、全组件零渲染**，error 状态完全不可见；
  现已接入 health 展示、顶部徽章联动（未生效变红）、30s 回读轮询、重试按钮。
- `dnd.ts`：严格模式路径补 `console.warn`，避免"锁住了但没屏蔽上"完全无感知。
- 校验：`node --check` 主进程两文件 exit 0；`tsc --noEmit` exit 0；eslint 该组件 0 error / 8 warning，
  8 条全为改动前既有模式，新增代码零新增警告。

---

*本报告依据实际读到的代码撰写；行号对应 2026-09-18 复核时的仓库状态。*
