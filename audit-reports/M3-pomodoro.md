# 专注计时/番茄钟模块 —— 对标成熟软件排查报告

> 排查范围：D:\Timer\dcm\backup 下 FocusFlow 的专注计时/番茄钟模块（Web + Electron 桌面端）。
> 结论均基于本次真实读取的文件与行号；未读到的内容不声称存在。

## 一、对标产品

本次实际参照的成熟产品：

- **Forest / Flora**：种树奖励、离开应用惩罚（切走即枯萎/警告）、种树动画与成就反馈。
- **番茄ToDo（TickTick 系）**：严格模式（每日上限/锁定）、休息自动开始与引导、中断统计口径、目标设定（每日番茄数与分钟数双目标）。
- **Session**：会话级专注统计（暂停/中断计数）、菜单栏/托盘倒计时、离开检测灵敏度、keep-awake 保持唤醒。
- 辅助参照：**TickTick 番茄钟**（跨刷新会话恢复、预计结束时刻锚点）、**潮汐白噪音**（曲库/淡入淡出/定时停止）、**RescueTime**（黄金时段分析融入工作流）。

## 二、现状能力盘点（真实读到，逐条注明文件）

**计时核心**
1. 全局番茄钟引擎，独立于视图：250ms tick、基于模块级 startedAt/Date.now() 计算剩余时间（可补偿休眠/降频）、完成/放弃/外部控制统一收口 — lib/pomodoro-engine.ts:155-195、311-345。
2. 四种状态机操作：开始/暂停（handleToggle）、重置（handleReset）、跳过（handleSkip）、beforeunload 放弃并枯萎 — lib/pomodoro-engine.ts:210-304。
3. 跨天自动重置每日番茄数、不打断运行中会话 — lib/store/slices/pomodoro-slice.ts:54-110。
4. 完成记账：会话、时间块（🍅 专注/☕ 短休息/🌳 长休息）、任务 completedPomodoros/timeSpent、timeEntry、标签 usageCount、成就动态检查、预计番茄达成判定 — lib/pomodoro-completion.ts:38-161。
5. 放弃记账：abandonedPomodoroSessions + 🥀 放弃专注时间块 — lib/pomodoro-completion.ts:163-206。

**界面与交互**
6. 专注页主卡：模式切换、进度环（动态渐变色阶）、重置/暂停/跳过、任务绑定与预估进度、专注备注、会话标签（自动补全+最近标签）、快速建任务、智能任务推荐 — components/focus/timer-main-card.tsx:147-464、components/focus/pomodoro-quick-task.tsx、components/focus/pomodoro-timer.tsx:120-516。
7. 侧栏：今日番茄数/目标进度、4 格长休息节奏、树木成长动画（种子→发芽→幼苗→成长→成熟/枯萎）、本周统计、连续天数、今日记录列表 — components/focus/timer-sidebar.tsx:43-205。
8. 设置弹窗：专注/短休息/长休息时长、长休息间隔、自动开始休息/专注、8 种完成音效预设（Web Audio 合成）— components/focus/timer-settings-dialog.tsx:58-176、lib/focus-sounds.ts:23-119。
9. 专注预设（深度工作/快速专注/马拉松 + 自定义增删改）— components/focus/timer-presets.tsx、pomodoro-slice.ts:153-235。
10. 完成总结弹窗：时长/今日番茄数/连续天数/关联任务预估进度/标记完成/继续专注/休息一下 — components/focus/timer-summary-dialog.tsx:53-175。
11. 沉浸全屏模式：动态色环、休息建议轮播、励志语录、每轮种树与森林、任务徽章、第几个番茄指示 — components/focus/immersive-timer.tsx:99-260+。
12. 中断记录：分类化 distractions 快速记录（数字/生理/环境/其他）— components/focus/distraction-log.tsx:41-160。
13. 空闲自动暂停（阈值可设置，默认关）— lib/use-idle-detector.ts:7-56、settings-view.tsx:1031。
14. 迷你悬浮钟（全局 FAB）+ 桌面小组件 + 托盘 + Electron 浮窗多端同步 — components/mini-timer.tsx、desktop-widget.tsx:209-214、electron/main.js:227-267、672-687、timer-float.tsx:38-139。
15. 系统挂起/锁屏自动暂停、全屏联动 — lib/pomodoro-engine.ts:319-324、electron/main.js:537-550。
16. 环境音 + 双耳节拍（10 种合成环境音、4 种脑波）、自动播放 — components/focus-sound.tsx:38-56、118-210。
17. 每日目标双击卡（今日番茄数达标 +100XP）、任务预估达成自动确认弹窗 — components/focus/pomodoro-timer.tsx:189-209、481-496。
18. 严格模式引擎强制逻辑已内置（每日上限拦截、锁定至会话结束禁止 reset/skip）— lib/pomodoro-engine.ts:197-291（注意：无 UI，见下表）。
19. 黄金时段分析（统计页 + PDF 报告）— components/views/analytics-view.tsx:329-336、components/report-export-dialog.tsx:134,366。
20. 任务行内“开始专注/继续”一键绑定并启动 — components/task-quick-actions.tsx:50-61。

## 三、需要增强与优化的功能

| 优先级 | 领域 | 差距描述 | 对标产品 | 成熟做法参考 | 增强建议（指明文件） | 用户影响 | 工作量 |
|---|---|---|---|---|---|---|---|
| 高 | 计时状态机鲁棒性（刷新/崩溃恢复） | 刷新页面即触发 beforeunload → 会话直接记“放弃”且树枯萎（pomodoro-engine.ts:291-304）；partialize 强制持久化 isRunning:false（lib/store/index.ts:433-436），崩溃/强杀后重启无任何“继续/恢复”路径，剩余时间与树状态错乱 | TickTick / 番茄ToDo | 会话跨刷新持久：持久化 sessionStartedAt+activeSessionId，启动时对账（剩余>0 → 提示“继续上次会话”，已过期 → 按实际时长完成或放弃），仅显式退出才记放弃 | lib/pomodoro-slice.ts（新增字段）、lib/pomodoro-engine.ts（ensurePomodoroEngine 对账）、lib/store/index.ts partialize | 刷网页/崩溃即丢失专注与树木，用户受挫 | 中 |
| 高 | 防作弊（切应用/离开判定） | Web 端无失焦检测：切走应用/浏览器标签后计时照跑，仅“无操作”空闲暂停（use-idle-detector.ts:23-56，默认关闭）；严格模式锁定只锁控件不防离开 | Forest / Flora / 番茄ToDo | 监听 visibilitychange+window blur：专注中切走 → 气泡警告，N 秒未回 → 记一次“离开”并可选树枯萎；提供灵敏度设置 | 新增 lib/focus-leave-detector.ts；接入 lib/pomodoro-engine.ts；timer-settings-dialog.tsx 加开关 | 专注承诺可被“切走”绕过，防作弊不闭环 | 中 |
| 高 | 严格模式（每日上限/锁定）无设置入口，功能实际不可用 | 引擎已实现拦截逻辑（pomodoro-engine.ts:197-291：maxSessionsPerDay 上限、lockUntilSessionEnd 禁 reset/skip，pomodoro-timer.tsx:114-118 锁提示），但全项目无任何 UI 调用 updatePomodoroStrictMode（grep 无匹配）；且 strict.autoStartNext/skipBreaks 字段（lib/types.ts:355-356）无消费方 | 番茄ToDo 严格/自律模式 | 提供“严格模式”设置面板：每日上限、锁定至会话结束、自动开始下一轮、跳过休息；把 autoStartNext/skipBreaks 接入引擎 handleComplete | 新增 components/focus/pomodoro-strict-settings.tsx（或并入 timer-settings-dialog.tsx）；lib/pomodoro-engine.ts:107-141 接入新开关 | 每日番茄上限与防逃避能力完全不可用 | 低～中 |
| 高 | 多窗口/多标签双引擎竞写 | 引擎只在主窗口初始化（components/desktop-app.tsx:68-79），但浏览器开第二个标签时同一代码会再次 ensurePomodoroEngine（initialized 为模块级，pomodoro-engine.ts:27,311-345）；两个 ticker 各自按 startedAt 计时并写同一 localStorage，而 storage 同步又显式跳过 pomodoroTimerState（lib/store/index.ts:131）→ 两端时间漂移，到 0 时可能双写“重复会话/时间块/时间条目” | 任意成熟产品 | 用 BroadcastChannel/可见标签选举单一 writer（副窗口只读不 tick），storage 事件纳入 pomodoroTimerState 合并；或持久化引擎租约 | lib/pomodoro-engine.ts、lib/store/index.ts、新增 lib/single-timer-writer.ts | 双开标签 → 统计重复、时间显示跳变 | 中 |
| 中 | 休息节奏（自动休息抢占总结时间） | 完成工作会话后立即切休息且 autoStartBreak 默认 true（pomodoro-engine.ts:131；pomodoro-slice.ts:34；快速专注预设 true），而总结弹窗同时弹出（pomodoro-timer.tsx:182-187）→ 用户还在看总结/标记任务，休息已在倒计时被吞掉 | 番茄ToDo / TickTick | 总结弹窗未关闭前不启动休息；或完成页显式给出“休息 5 分钟”按钮，默认 autoStartBreak=false | lib/pomodoro-engine.ts（handleComplete 延迟启动）、components/focus/timer-summary-dialog.tsx | 休息被悄悄消耗，节奏被打乱 | 低 |
| 中 | 暂停/中断统计口径 | 无自动 pauseCount/pauseSeconds/leaveCount：引擎只记录完成/放弃会话，会话内暂停次数与时长不落账；总结弹窗也只展示时长/番茄数（timer-summary-dialog.tsx:73-127），无法复盘打断；distractions 手动记录与将来生成的会话 id 无法关联（timer-main-card.tsx:421-425 未传 pomodoroSessionId） | Session / 番茄ToDo | pomodoroTimerState 累计 pauseCount/pauseSeconds（引擎 tick 记录），完成时写入会话并展示在总结；开始会话时预生成 activeSessionId，distractions 用其关联 | lib/pomodoro-engine.ts、lib/pomodoro-slice.ts、lib/pomodoro-completion.ts、timer-summary-dialog.tsx | 注意力中断无数据可复盘 | 中 |
| 中 | 每日/周目标双维度展示单薄 | 专注页只有“今日番茄数/目标”与 4 格长休息节奏（timer-sidebar.tsx:53-73）；每日分钟目标与周累计只在 Dashboard/每日复盘展示（dashboard-view.tsx:106,275；daily-review-dialog.tsx:134,244） | TickTick / 番茄ToDo | 专注页加入“今日已专注 X/目标 Y 分钟 · 本周 W/600 分钟”双卡片与“还差 N 个番茄达标”提示 | components/focus/timer-sidebar.tsx、pomodoro-timer.tsx | 目标驱动与激励弱 | 低 |
| 中 | 时段统计（黄金时间）未融入专注流程 | 黄金时段只在统计页与 PDF 报告（analytics-view.tsx:329-336；report-export-dialog.tsx:134,366），专注页与开始流程完全不体现 | RescueTime / TickTick | 专注页顶部“当前时段效率预估”卡片（如 9-10 点为你的黄金时段）+ 开始前推荐下一个最佳专注窗口 | components/focus/pomodoro-timer.tsx + 新增 lib/focus-peak-hour.ts（复用 analytics 的 byHour 统计口径） | 高峰时段利用率低 | 低 |
| 中 | 铃声与白噪音：两套体系重复、无曲库/淡入淡出/定时停止 | 存在两套声音实现：focus-sound.tsx（10 种合成环境音+4 种双耳节拍）与 white-noise-context.tsx（Provider 已挂载 app/layout.tsx:5 但全项目无 UI 消费，死代码）；音量均为 gain 直接赋值（focus-sound.tsx:98-102,200）无淡入淡出，切换/停止有爆音；无本地音频曲库、无“专注结束自动停止” | 潮汐 / Forest | 合并为单一声音模块（删除或重写 white-noise-context）；startAmbientSound/stopAllAudio 用 setTargetAtTime 淡入淡出；增加“会话结束自动停止”“定时停止”与可选内置音频 | components/focus-sound.tsx、lib/white-noise-context.tsx | 声音入口割裂、爆音、无真实曲目 | 中 |
| 中 | 与任务绑定：开始前缺“结束时刻锚点” | 任务行内一键专注已有（task-quick-actions.tsx:50-61），但开始计时时无“预计 9:45 结束 · 今日 3/8 番茄 · 本任务第 2/4 个”的上下文提示；标题栏“开始专注 Ctrl+Space”只跳转视图不真正启动（title-bar.tsx:158-159） | TickTick / 番茄ToDo | 开始前/主卡显示预计结束时刻与今日进度；标题栏快捷键改为真正 toggle（转 dispatch focusflow:toggle-pomodoro） | components/focus/timer-main-card.tsx、components/title-bar.tsx、lib/shortcuts.ts | 时间锚点与目标感弱 | 低 |
| 低 | 桌面端无保持唤醒（keep-awake） | Electron 主进程无 powerSaveBlocker：专注时屏幕可自动熄灭打断沉浸（electron/main.js 全文未见相关调用） | Session / Forest | 专注运行且窗口可见时调用 powerSaveBlocker('prevent-display-sleep')，会话结束/暂停释放 | electron/main.js + preload.js + lib/pomodoro-engine.ts（IPC 开关） | 屏幕熄灭打断沉浸 | 低 |
| 低 | 托盘/浮窗信息与延迟 | 托盘 tooltip/菜单只有状态文本无倒计时（electron/main.js:269-272；desktop-app.tsx:130-177 仅上报 todayCount+pomodoroStatus）；浮窗/小组件靠 5s 轮询拉取（timer-float.tsx:59-61；desktop-widget.tsx:214），最多滞后 5s | Session（菜单栏倒计时） | report-tray-state 增加 timeLeft/mode 并降频上报（1~2s）；主窗主动广播 pomodoro-sync（已有 onPomodoroSync 通道，main.js:672-687）替代轮询 | components/desktop-app.tsx、electron/main.js、components/timer-float.tsx | 托盘无倒计时、浮窗显示滞后 | 低 |

## 四、发现的隐患与问题（附文件行号）

1. **0 秒会话被记为完整番茄**：若会话恰好在 timeLeft=0 时被暂停（如 SystemSuspend 在归零瞬间到达，pomodoro-engine.ts:319-323），再点“开始”→ tick 立即 reachedZero → handleComplete 以 getTotalDuration 记账（pomodoro-engine.ts:174-194），产生一个“完整时长”的空会话。应在 timeLeft<=0 时禁止开始或按放弃处理。
2. **死代码 1**：components/focus/pomodoro-timer.tsx:149-173 的 playSound 无任何调用者（grep 确认），与引擎 lib/pomodoro-engine.ts:64-78 的播放逻辑重复。
3. **死代码 2**：lib/white-noise-context.tsx 整文件无 UI 消费者（仅 app/layout.tsx:5 挂 Provider），与 components/focus-sound.tsx 功能重复，是两套声音体系并存的来源。
4. **死代码 3**：lib/config.ts:73-87 generateDefaultPomodoroSessions 伪造历史番茄数据（当前 slice 实际使用空数组 lib/store/utils.ts:61 未引用它，但保留该生成器易被误用污染统计与连击）。
5. **死代码 4**：lib/browser-notifications.ts:136-140 notifyDailyGoalReached 无调用方；lib/types.ts:361-371 ProductivityInsight 标注 deprecated 未使用；pomodoro-timer.tsx:505-506 completedSessions 与 completedSessionsCount 重复传参。
6. **口径不一致（枯萎树成长度）**：组件放弃路径会清 treeGrowth=0（pomodoro-timer.tsx:264），而引擎 beforeunload 放弃只置 withered 不清成长度（pomodoro-engine.ts:303），侧栏可能显示“已枯萎 · 成长度 60%”（timer-sidebar.tsx:103-116）。
7. **存储同步跳过计时状态**：lib/store/index.ts:131 显式跳过 pomodoroTimerState（为节流/防回写的有意设计），但配合多标签双引擎（表第 4 行）会产生显示不一致与重复完成。
8. **运行中可改时长**：timer-settings-dialog.tsx:62-98 时长滑块未在 isRunning 时禁用，中途改时长导致进度口径漂移，完成记账用时与用户实际专注时长不符（handleComplete 用最新 settings，pomodoro-engine.ts:85）。
9. **空闲检测不分模式**：use-idle-detector.ts:35-49 每 15s 轮询只判断 isRunning 不区分专注/休息，休息时（通常无键盘活动）易被“无操作”误暂停。
10. **严格模式事件提示不可达**：pomodoro-engine.ts:201 的 focusflow:strict-limit-blocked 与 pomodoro-timer.tsx:358 监听一致（无 bug），但严格模式无 UI 入口（表第 3 行），该提示实际不可达。

## 五、本模块已有亮点

- **全局引擎 + 多端同步架构**：引擎独立于视图常驻主窗口，托盘/浮窗/小组件通过 IPC + localStorage 多通道同步（lib/pomodoro-engine.ts:311-345；electron/main.js:672-687），Electron 主窗关闭只是隐藏（electron/main.js:164-169），后台计时不中断。
- **Forest 式奖惩闭环**：beforeunload 优雅放弃 + 🥀 放弃专注时间块 + 树木成长阶段（lib/forest-tree.ts:3-25），放弃也留痕。
- **完成联动完整**：完成即写入会话/时间块/任务 timeSpent/completedPomodoros/timeEntry/标签计数/成就检查（lib/pomodoro-completion.ts:38-161），且动态 import 避免循环依赖（pomodoro-completion.ts:84-87）。
- **预估番茄达成自动化**：任务预估数达成的自动确认弹窗（pomodoro-timer.tsx:189-209）与总结页“标记完成”按钮（timer-summary-dialog.tsx:111-124）。
- **沉浸模式完成度高**：动态色环、休息建议轮播、励志语录、每轮森林动画（immersive-timer.tsx:99-243）。
- **Web Audio 全部合成**：8 种完成音效（focus-sounds.ts:64-118）、10 种环境音 + 4 种双耳节拍（focus-sound.tsx:38-56、118-210），无音频文件依赖、体积小。
- **跨天重置不打断会话**：每日番茄数重置与运行中会话分离处理（pomodoro-slice.ts:59-72），凌晨跨天会话不中断。
- **严格模式引擎层已就绪**：每日上限拦截、锁定禁 reset/skip、事件广播（pomodoro-engine.ts:197-291）——只差 UI 入口即可激活。
