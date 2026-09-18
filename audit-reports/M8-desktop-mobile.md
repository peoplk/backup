# 桌面/移动端与系统集成 —— 对标成熟软件排查报告

> 模块：M8 · 桌面端（Electron 托盘/浮窗/小组件/系统级屏蔽/自动更新）+ Android 端（Capacitor 原生集成）与跨端同步链路
> 排查方式：真实读取仓库文件（含行号）；未读到=未声称存在。对标认知来自内置知识（TickTick、Todoist、Notion、Forest、番茄ToDo、Freedom、Cold Turkey、Session、RescueTime 等成熟产品）。

## 一、对标产品

| 对标产品 | 对标侧重点 |
|---|---|
| TickTick（滴答清单）桌面/移动端 | 托盘/后台常驻、全局快捷键、开机自启、跨端即时同步、原生小组件、本地通知 |
| Todoist 桌面端 | 全局快捷键（任意文本快速添加）、通知与动作、平台一致性 |
| Forest / 番茄ToDo（移动端） | 专注前台保活、勿扰(DND)联动、系统级应用封锁、状态栏计时通知、成就反馈 |
| Notion 桌面端 | 桌面小组件窗口、窗口置顶/位置记忆、自动更新体验 |
| Freedom / Cold Turkey | 系统级专注封锁（hosts/驱动/守护进程、宽限与崩溃恢复、跨关进程持久生效） |
| Session / RescueTime 桌面端 | 后台采集、托盘信息密度、窗口行为细节 |

## 二、现状能力盘点（真实读到的功能，逐条注明文件路径）

### 2.1 Electron 主进程（electron/main.js，830 行）
- 单实例锁 + 二次启动唤起主窗口：main.js:27-43
- 安全基线：contextIsolation/sandbox/webSecurity 开启、isTrustedSender() 按 senderFrame 来源校验每个 IPC、URL 白名单、setWindowOpenHandler 拒绝非安全外链：main.js:55-105、preload.js:17-116
- 主窗口：无边框自绘标题栏、close→hide（关到托盘）、全屏切换、backgroundThrottling:false：main.js:124-183
- 桌面小组件窗口（340×560，alwaysOnTop/transparent/skipTaskbar）与番茄钟浮窗（320×120，同上）：main.js:185-225、227-267
- 托盘：tooltip 展示"今日待办/番茄钟状态"，右键菜单含 显示主窗口/桌面小组件/番茄浮窗/开始暂停番茄/开机自启勾选/退出：main.js:269-315
- 开机自启：app.setLoginItemSettings({openAtLogin, openAsHidden})，托盘勾选联动：main.js:317-337、653-660
- 打包版内嵌 Next standalone 服务（仅回环 127.0.0.1:3000）+ 20s 健康检查轮询 + 失败回收子进程：main.js:352-398
- 系统原生通知：main.js:407-426（含 icon、点击回主窗口）
- 剪贴板监听：每 2s 轮询，仅检测 URL 并弹"检测到链接"通知，点击创建任务：main.js:428-455、desktop-app.tsx:108-126
- 自动时间线追踪：仅 Windows，PowerShell+Win32 API 每 30s 采样前台窗口，仅本地存储；isWindowsPlatform 守卫：main.js:457-519
- 全局快捷键：Ctrl+Shift+F（呼出/隐藏）、Ctrl+Shift+N（快速添加）、Ctrl+Shift+P（切换番茄钟）：main.js:521-535
- 电源监控：suspend/resume/lock-screen/unlock-screen 事件→暂停/恢复番茄钟：main.js:537-550、pomodoro-engine.ts:319-324
- 自动更新：electron-updater，autoDownload=false，启动 15s 后检查，发现/下载完成发通知：main.js:552-575
- PDF 导出：隐藏窗口渲染 HTML→saveDialog（2MB 上限、文件名清洗、窗口兜底销毁）：main.js:713-748
- 凭据保险库：safeStorage 加密（不可用时明确拒绝降级为明文）：main.js:750-786
- 番茄钟跨窗同步：主窗口每秒广播 pomodoro-state，浮窗/小组件 5s 兜底拉取：main.js:670-687、desktop-widget.tsx:208-220、timer-float.tsx:54-66

### 2.2 系统级专注封锁（electron/system-shield.js，385 行）
- 网站封锁：写 hosts 文件（IPv4 0.0.0.0 + IPv6 :: ＋www 变体），首次自动备份到 ~/.focusflow/hosts.backup，标记块启停、恢复时还原并 flushDns（Windows/macOS）：system-shield.js:106-226
- 应用封锁：仅 Windows——立即 taskkill + 每 3s tasklist CSV 精确进程名匹配扫描再杀：system-shield.js:229-263、282-294
- 白名单模式：默认干扰清单（16 个常见站点 + 7 款常见 App）减白名单求差集：system-shield.js:26-94
- 注入防护：域名/进程名 sanitize 正则校验，spawn 全用 argv 数组不经 shell：system-shield.js:59-79
- IPC 全部经 isTrustedSender：system-shield.js:351-373；退出时 restore（cleanupShield）：main.js:821-829
- 定时封锁调度（web 侧）：时间窗（含跨夜、按周几）边缘触发启停：lib/use-shield-schedule.ts:14-75

### 2.3 渲染层（桌面体验）
- 自绘标题栏：文件/编辑/视图/窗口/帮助菜单、拖拽区、最大/最小/关闭、小组件快捷键提示：components/title-bar.tsx:69-131、260-354
- 桌面小组件：时钟+番茄环+今日待办（3 条）+今日习惯（2 条）+今日统计三卡；打卡习惯/选择专注任务/跳过；置顶按钮：components/desktop-widget.tsx:162-681
- 番茄浮窗：环形进度+播放/暂停/重置/关闭，可拖拽：components/timer-float.tsx:75-137
- 主窗口集成：Electron API 菜单导航、托盘切换番茄钟、剪贴板建任务、拖放文件批量建任务、移动端侧边栏适配：components/desktop-app.tsx:51-236

### 2.4 Android 端（android-app/，Capacitor 8 + 原生 Java）
- 独立 React 应用（vite+tsx+zustand 本地持久化 focusflow-android-v1）：android-app/src/（App.tsx:568 行、useStore.ts:1101 行）
- 原生桥 NativeBridge：待处理动作（分享/快捷方式）、小组件数据推送、语音转文字、列出已安装应用、更新屏蔽状态与「使用情况访问」跳转、状态栏计时通知同步：android-app/src/lib/native-bridge.ts:35-95、NativeBridgePlugin.java:50-178
- 系统级应用封锁：FocusShieldService 前台服务（specialUse FGS），UsageStatsManager 每 800ms 查前台应用，命中→拉起 ShieldBlockActivity 全屏拦截页：FocusShieldService.java:39-49、106-139；触发条件＝专注运行中＋黑名单应用：App.tsx:47-54
- 桌面小组件（Android 原生）：今日任务/今日习惯/专注统计 3 个 AppWidget Provider：AndroidManifest.xml:54-86、android/app/src/main/java/com/focusflow/app/widgets/*.java
- 状态栏计时通知：原生每秒自走表快照＋ongoing＋"结束"按钮（广播→PendingActionStore→JS 消费停止）：TimerNotification.java:49-88、TimerNotifReceiver.java:10-17、android-app/src/lib/timer-notif.ts:27-41
- 系统分享→快速捕获（SEND/PROCESS_TEXT）+ 应用快捷方式：AndroidManifest.xml:33-51、115-117
- 本地通知：电容 LocalNotifications＋漏发补发＋习惯重复提醒（+15/30/45/60 分钟）＋完成/稍后提醒动作按钮：android-app/src/lib/notifications.ts:42-179、App.tsx:158-333
- 云同步：WebDAV + 阿里云 OSS（S3 兼容 SigV4）双 provider，启停/自动同步/远端订阅：android-app/src/lib/sync-store.ts:1-22、oss.ts、webdav.ts；web 端同样支持 OSS/AWS S3/MinIO（lib/s3-sync.ts:53-64）
- 功能面（页面清单 + grep）：任务/习惯/目标/番茄专注（含 strict 上限与锁定）/统计/日历/时间块/日记/纪念日/成就/白噪音场景音/专注屏蔽/任务模板/回收站/项目/时间追踪/搜索/备份恢复与 CSV 导入导出/ICS 导出（无导入）/语音快速添加/系统分享/离线本地存储：android-app/src/pages/*.tsx、src/lib/ics.ts、src/lib/backup.ts

### 2.5 其他
- 构建脚本：electron-builder（win portable+NSIS / mac dmg / linux AppImage，publish 走 FOCUSFLOW_UPDATE_URL 环境变量，默认 example.com）：scripts/build-electron.js、package.json:19-83
- server 打包：standalone 复制 + 静态/public 收集 + HOSTNAME 收紧为回环：scripts/build-server.js

## 三、需要增强与优化的功能

| 优先级 | 领域 | 差距描述 | 对标产品 | 成熟做法参考 | 增强建议（指明文件） | 用户影响 | 工作量 |
|---|---|---|---|---|---|---|---|
| 高 | 系统级屏蔽·权限 | Windows/macOS 写 hosts 需管理员权限，当前无提权流程、失败仅 console.error，屏蔽可能长期静默失效 | Freedom / Cold Turkey | 安装时登记提权辅助进程/守护，启动校验 hosts 可写并在 UI 提示"未生效" | electron/system-shield.js:178-226、electron/main.js、专注/屏蔽设置 UI | 多数普通用户网站屏蔽不生效却不知情 | 高 |
| 高 | 系统级屏蔽·生效性 | 仅 hosts+flushDns：Chrome/Edge 开启 Secure DNS(DoH) 即绕过；macOS 完全无应用屏蔽（taskkill 逻辑 Windows-only） | Cold Turkey / Freedom / 番茄ToDo | 浏览器扩展/网络层过滤；检测 DoH 并提示；mac 用 osascript/launchctl 拦截 | electron/system-shield.js:229-263、FocusShieldPage、android FocusShieldService 类比 | "封锁"可被一分钟内绕过 | 高 |
| 高 | 跨端同步链路 | 安卓与 Web/桌面是两套数据模型：focusflow-android-v1（习惯用 habitLogs/habitLogsQuantity、专注用 focus/isRunning）vs productivity-app-storage（habitCheckIns/pomodoroTimerState）；同步虽同为 S3 兼容协议却无统一 schema、无账号配对与设备绑定，远端未知键被丢弃，可能互相覆盖 | TickTick / Todoist | 定义跨端统一传输 JSON schema＋迁移映射；设备配对/账号绑定；带版本合并与冲突 UI | android-app/src/lib/sync-store.ts、android-app/src/store/useStore.ts、lib/store/index.ts:427-573、lib/s3-sync.ts | 桌面与手机数据不一致、跨端修改丢失 | 高 |
| 高 | Android 专注保活 | 番茄计时在 WebView JS setInterval 250ms（Focus.tsx:125-185），无专注前台服务保活；TimerNotification 只是快照自走表，进程被杀/WebView 冻结后 app 状态与通知分叉，恢复无对账 | 番茄ToDo / Forest | 新增 FocusTimerService（FGS）原生计时，start/pause/tick 回流 JS；被杀后按快照补记会话 | android-app/android/app/src/main/java/com/focusflow/app/（新增服务）、android-app/src/pages/Focus.tsx、timer-notif.ts、AndroidManifest.xml | 息屏/切后台/被杀后专注时长记录不准，核心价值受损 | 高 |
| 中高 | Electron 启动/窗口 | 打包版依赖 localhost:3000 子服务，端口被占/服务失败即 app.quit（main.js:388-394、806-808）；主窗口不记忆位置/尺寸/最大化；自启 openAsHidden 在 Windows 无效且无 wasOpenedAsHidden 处理，自启仍弹主窗口 | Notion / TickTick | 窗口状态持久化（bounds 存 userData 并恢复）；wasOpenedAsHidden 时直接入托盘不 show；端口占用探测与随机回退端口 | electron/main.js:124-183、317-337、788-809、scripts/build-server.js（PORT 参数化） | 启动脆弱、自启打扰、窗口布局每次重排 | 中 |
| 中 | 桌面浮窗/小组件 | "置顶/取消置顶"按钮只是本地 useState（desktop-widget.tsx:187-191、371-413），无 IPC，实际窗口始终 alwaysOnTop；浮窗/小组件位置不持久化；340×560 尺寸固定 | Notion / TickTick | 新增 IPC setAlwaysOnTop/move，main 侧持久化 bounds；提供紧凑/展开版式 | electron/main.js:185-267、electron/preload.js、components/desktop-widget.tsx、components/timer-float.tsx | 按钮无实际效果、浮窗每次重开位置丢失 | 小 |
| 中 | 全局快捷键 | 仅 3 个固定 Ctrl+Shift+* 且不检查 register 返回值（冲突无提示）；剪贴板监听只识别 URL（main.js:437），无法"任意文本一键快速添加"；无 macOS 约定（Cmd+*） | Todoist / TickTick | 快捷键可配置＋注册失败提示；剪贴板非 URL 文本→直接进入快速添加（与 web quick-capture 打通） | electron/main.js:428-455、521-535、lib/settings（新增）、components/title-bar.tsx | 快捷键撞车无感知；快速添加只支持链接 | 中 |
| 中 | 桌面通知 | 通知不支持 requireInteraction/silent 与动作按钮（main.js:407-426 硬编码 silent:false）；番茄完成无"继续下一轮/跳过"等一键操作 | TickTick / 番茄ToDo | 透传 requireInteraction/silent；利用 Notification actions 或通知点击携带动作路由 | electron/main.js:407-426、electron/preload.js、lib/browser-notifications.ts:32-57 | 重要提醒易被系统折叠、无法一键续播 | 中 |
| 中 | 自动更新 | publish url 默认 example.com，未配置即静默失败；NSIS/portable 未签名（SmartScreen 警告）；portable 目标不支持 electron-updater；无"检查更新"入口与进度/重启 UI | Notion / TickTick | 配置真实发布地址＋代码签名；标题栏"帮助"加"检查更新"，更新时显式进度与"立即重启更新" | scripts/build-electron.js、package.json:19-83、electron/main.js:552-575、components/title-bar.tsx | 用户长期停留在旧版且无感知 | 中 |
| 中 | Android 功能缺口 | 缺：每日复盘、保存的筛选（savedFilters）、ICS 导入（只有导出，ics.ts）、PDF 导出、隐私锁；"网站"类屏蔽项在安卓只存不生效（FocusShieldService 仅拦包名），无浏览器级拦截 | TickTick 移动端 / Forest | 补齐复盘与筛选（web 已有逻辑可移植）；网站屏蔽→引导屏蔽浏览器应用或接入系统 DNS；标注"仅桌面生效" | android-app/src/pages/*（新增复盘/筛选）、FocusShieldPage.tsx、android-app/src/lib/ics.ts | 移动端能力明显弱于桌面端，特色功能不可达 | 中 |
| 低中 | Android 系统集成细节 | 专注期间不联动系统勿扰(DND)/锁屏；capacitor.config.ts:5 appName 仍是 "Nova"，品牌不一致；allowBackup=true 未评估隐私；FocusShieldService 800ms 高频轮询耗电 | 番茄ToDo / Forest | 专注开始开 DND、结束恢复；改 appName/logo；评估 allowBackup；轮询降频（2-3s）＋退避 | android-app/capacitor.config.ts、App.tsx（DND intent）、FocusShieldService.java:39-49、AndroidManifest.xml | 提醒被静音错过、品牌混乱、耗电 | 低 |
| 低 | 双桌面端混乱 | android-app/electron 提供第二个"手机壳" Electron 窗口（420×820、无托盘/快捷键/更新），与 root Electron 并存，仓库无说明 | —— | 明确其演示用途并文档化，或从发布物中排除避免用户误装 | android-app/electron/main.cjs、android-app/package.json:11-13 | 维护者与用户困惑 | 低 |

## 四、发现的隐患与问题

1. 本地端口被占用即加载错误页面：main.js:376-396 健康检查只问"端口有 HTTP 响应"，若 3000 被其他服务占用，fetch 通过后主窗口加载到陌生内容（preload 桥仍在；UI 错乱，且 isLocalAppUrl 对任意 localhost:3000 内容放行）。建议启动前探测端口并带自定义响应头校验，或用随机端口。
2. 屏蔽退出即解除/崩溃残留：before-quit 才 cleanupShield（main.js:818-824），用户"退出"后屏蔽提前失效，而进程被杀时 hosts 屏蔽块会残留到下次启动（backupHosts 才清理）；屏蔽无"结束时间"，开启后不会自动停止（除 renderer 侧 schedule）。
3. macOS 应用封锁静默无效：system-shield.js:229-263 全部 isWindows 守卫，macOS 上应用屏蔽返回"成功"实为空操作，UI 无提示。
4. hosts 写入权限无感知：system-shield.js:178-226 写 C:\Windows\System32\drivers\etc\hosts 失败仅 console.error，用户界面看到"已开启"却是假象。
5. 托盘图标非 Template 图：main.js:340-349 用彩色 PNG resize 16px，macOS 菜单栏深色模式下可能不可见；托盘菜单缺"检查更新""今日统计预览"。
6. 引擎只跑在主窗口：pomodoro-engine.ts:311-345 仅 DesktopApp 初始化；若主窗口 webContents 崩溃，小组件/托盘对番茄钟的控制全部失效（main.js:669-687 依赖 mainWindow?.webContents.send）。
7. 跨窗口合并弱校验：store/index.ts:121-146 依赖 storage 事件同步，pomodoroTimerState 被排除在事件合并外（131 行），完全依赖 IPC 广播；小组件内修改的任务靠事件时序回主窗口。
8. Android 计时分叉：TimerNotification.java:29-37 原生自走表与 WebView 内 remainingSec（Focus.tsx:134-179）各自为政，进程被杀恢复后 app 显示旧值且无原生对账补记。
9. Android 专注完成依赖 Web Notification：Focus.tsx:155-161 完成时用 new Notification(...)（WebView 中不可靠），未走电容 LocalNotifications；后台冻结时可能无声无息。
10. Android 远端覆盖风险：sync-store.ts 的 applyRemoteData（useStore.ts:938-953 附近）按自身键集合校验后整套覆盖本地，跨端键名不一致时本地数据易被污染或整段丢弃，无逐字段冲突合并。
11. build-server.js:74-80 用单行正则替换 standalone server.js 的 HOSTNAME 声明，依赖 Next 生成代码的具体形态，Next 升级后可能失效；建议改为构建期注入。
12. app.use 层面缺少单实例/端口冲突的降级：若 3000 端口被防火墙拦截或 IPv6/127.0.0.1 绑定差异，健康检查可能假失败（main.js:376-396 使用 127.0.0.1 而窗口加载 localhost:3000，macOS 上两者通常等价，个别 VPN 场景不一致）。

## 五、本模块已有亮点

1. Electron 安全基线扎实：contextIsolation+sandbox+每个 IPC 入口 isTrustedSender 校验、URL 协议白名单（拒绝 file:/ms-msdt: 类协议）、setWindowOpenHandler 统一拒开新窗（main.js:55-105、system-shield.js:351-373、preload.js 只暴露白名单 API）。
2. 跨窗口 Store 同步考虑细致：storage 事件白名单合并防 ping-pong、2s 节流落盘、partialize 排除运行态计时（store/index.ts:121-217、427-473）。
3. 番茄引擎健壮：Date.now() 基准计时抗系统节流、beforeunload 记录弃权会话（枯树）、系统挂起/锁屏自动暂停（pomodoro-engine.ts:174-195、291-345）。
4. 系统屏蔽写入防护：域名/进程名校验防 hosts/命令注入、精确进程名匹配防误杀（QQ 不误杀 QQBrowser）、hosts 备份＋标记恢复＋DNS 刷新（system-shield.js:59-79、229-263）。
5. Android 原生集成超出预期：3 个系统小组件、分享/文本选择快速添加、语音转文字、用途访问级应用拦截＋全屏拦截页、状态栏自走表通知带"结束"按钮、习惯通知动作＋重复提醒＋漏发补发（App.tsx、native-bridge.ts、NativeBridgePlugin.java、TimerNotification.java、FocusShieldService.java、AndroidManifest.xml）。
6. 桌面拾取体验：剪贴板 URL 捕获、拖放文件批量建任务、托盘一键启停番茄钟（desktop-app.tsx:108-236）。
7. 隐私取向：活动时间线仅本机采样不上传（main.js:457-519）、凭据拒绝明文降级（main.js:759-773）、Android 习惯数据不出设备。

---
*本报告依据实际读到的代码撰写；所有行号对应排查时仓库状态。*