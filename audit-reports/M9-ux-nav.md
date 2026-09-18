# M9 导航 / 引导 / 无障碍 / 本地化 —— 对标成熟软件排查报告

> 模块范围：侧边栏信息架构、命令面板、快捷键、首次引导(onboarding)与空状态、通知中心、日记/复盘/纪念日入口、主题与定时切换、响应式断点、无障碍(键盘/ARIA/对比度/缩放)、错误边界与加载态、i18n、性能感知(首屏/列表渲染)。
> 所有"现状"均基于本次实际读取的文件与行号，未读到的功能一律不声称存在。仓库根：D:\Timer\dcm\backup（web 端，组件库 Radix UI + Tailwind 4 + Zustand persist）。

## 一、对标产品

| 对标产品 | 本次重点参照的能力 |
|---|---|
| **Notion** | 工作区侧边栏信息架构（分区+折叠）、命令面板(Cmd+K)覆盖度与 fuzzy 检索、首次引导(模板/工作区设置)、空状态设计 |
| **Linear** | 键盘优先 UX、快捷键自定义、命令面板动作化、通知中心聚合与实体深链、焦点管理 |
| **Obsidian** | 快捷键完备性、面板可访问性、侧边栏导航健壮性、主题一致性 |
| **Todoist / TickTick 滴答清单** | 智能列表导航、今日视图聚合、首启引导(创建第一个任务)、通知跳转定位任务、语言切换 |
| 辅助参照 | Things 3(键盘导航层级)、Google Calendar(日历视图响应式/键位)、Forest/番茄ToDo(专注入口可达性) |

## 二、现状能力盘点（真实读到的功能）

1. **侧边栏** components/app-sidebar.tsx：主菜单 10 项导航（dashboard/tasks/focus/habits/goals/calendar/time-block/anniversaries/journal/analytics，由 lib/config.ts:16-27 NAV_ITEMS 生成）；智能列表：已收藏 + 今天/明天/最近7天/已逾期/收集箱/已完成/所有任务（lib/smart-lists.ts:80-189，带计数 Badge）；项目树 ProjectTree（递归、折叠、子项目计数，app-sidebar.tsx:365-446）；底部：主题循环切换、桌面小组件(Electron)、快速捕获、设置、用户信息卡片；Electron 下 top-9 布局避让自绘标题栏。
2. **顶栏** components/desktop-app.tsx:310-393：移动菜单按钮(lg:hidden)、视图标题、快速添加(带 ⌘⇧A 键帽)、搜索按钮(带 ⌘K 键帽，data-search-trigger)、NotificationBell；components/title-bar.tsx 为 Electron 自绘标题栏菜单（文件/编辑/视图/窗口/帮助，含 accelerator 展示与最小化/最大化/关闭窗口、小组件操作）。
3. **命令面板** components/command-palette.tsx：Ctrl+Shift+P 开关；navigation/actions/tasks 三类；G-D/G-T/G-P/G-K/G-G/G-S/G-H/G-A/G-, 等 goto 命名提示；add/添加 前缀直接建任务(170-183)；↑↓/Enter/Esc/鼠标悬停；底部快捷键提示条。
4. **快捷键** lib/shortcuts.ts：Ctrl+N 新建、Ctrl+T/P/H/G/A/D/S/B 跳视图、Ctrl+1..5 跳转、Ctrl+Shift+A 快速捕获、Ctrl+Space 停止计时、/ 搜索、Shift+? 帮助、Esc 退出输入；专注页专属：空格 开始/暂停、R 重置、S 跳过、F 全屏、数字1/2/3 切模式；components/keyboard-shortcuts-dialog.tsx 帮助弹窗（SHORTCUT_LIST 静态文案）。
5. **主题** lib/theme.ts（light/dark/system + matchMedia 监听）、app/layout.tsx:60-64 内联防闪烁脚本、lib/use-dark-mode-schedule.ts 定时切换（60000ms 轮询）；设置页 settings-view.tsx:1051-1073 浅色/深色/系统；侧边栏循环切换。主应用未使用 next-themes 的 ThemeProvider（theme-provider.tsx 仅被 app/widget/page.tsx 与 ui/sonner.tsx 引用）。
6. **通知中心** components/notification-bell.tsx：未读角标(9+)、全部已读、清空(带确认)、点击按 actionUrl 优先跳视图、实体存在性检查(97-111，不存在则自动移除)、相对时间。
7. **全局搜索** components/global-search.tsx：Ctrl+K 打开；搜索 任务/习惯/纪念日/时间记录（各截 5 条）；选择后写 localStorage['focusflow-selected-item'] 深链（tasks-view.tsx:373-387 读取并 scrollIntoView + 高亮 task-item-{id}）。
8. **错误边界与加载** app/error.tsx、app/loading.tsx、app/not-found.tsx、components/error-boundary.tsx（可重试）；desktop-app.tsx:250-277 为每个视图包裹 ErrorBoundary + viewFallback(刷新)。
9. **首次引导** components/views/dashboard-view.tsx:122-124 isFirstTime 判定 + 160-193「欢迎使用 FocusFlow」卡片（创建第一个任务/开始第一次专注/养成好习惯/设定目标四个入口）——注意：见隐患①，实际不可达。
10. **每日复盘/日记入口**：导航项「日记」直达 journal-view.tsx；每日复盘由 lib/hooks/use-daily-review-trigger.tsx 定时(默认21:00)弹窗 + 设置页手动入口(settings-view.tsx:727 调 __openDailyReview)，daily-review-dialog.tsx 与日记数据打通；纪念日为独立导航项 anniversaries-view.tsx。
11. **响应式** desktop-app.tsx:288-308：侧边栏 lg: 才显示桌面版，lg:hidden 移动抽屉 + bg-black/40 遮罩；Header 控件 md/lg 分档；components/ui/use-mobile.tsx(768px 断点)；views 普遍使用 grid sm:/md:/lg: 响应式网格（如 calendar-view.tsx:401/846）。
12. **跨窗口/深链基础设施** lib/store/index.ts:85-87 storage 事件跨窗口合并；focusflow-selected-item 深链机制；Electron 剪贴板捕获建任务(desktop-app.tsx:108-126)、拖拽文件建任务(202-236)。

## 三、需要增强与优化的功能

| 优先级 | 领域 | 差距描述 | 对标产品 | 成熟做法参考 | 增强建议（指明文件） | 用户影响 | 工作量 |
|---|---|---|---|---|---|---|---|
| 高 | 首次引导 | 欢迎卡判定 tasks.length===0 && habits.length===0 && pomodoroSessions.length===0（dashboard-view.tsx:122-124），但 store 首启即种子 5 条任务/4 个习惯/3 项目/2 纪念日（task-slice.ts:29、habit-slice.ts:15、project-slice.ts:14、anniversary-slice.ts:15 引用 lib/store/utils.ts:31-59 的 default*，来自 lib/config.ts:41-57），isFirstTime 永远为 false，欢迎卡与引导不可达；也无独立 onboarding 状态（lib、store 均无 onboarding 字段） | Notion/Todoist/滴答清单 | 首启显示向导：选择工作流/创建第一个任务；示例数据可选导入而非默认注入 | 新增 lib/store/slices/onboarding-slice.ts（firstRunCompleted 等）+ components/onboarding/ 首启向导组件挂到 desktop-app.tsx；lib/config.ts 默认数据改为"示例数据"，仅当用户选择时才导入；同步修改 dashboard-view.tsx 用 store 标志判定 | 新用户被假数据淹没、无从知道功能入口，留存率受损 | 中(3-4d) |
| 高 | 本地化 i18n | 仅 app/layout.tsx:55 html lang 为 zh-CN；全部文案中文硬编码；settings-view.tsx:1077-1096 语言区 English 为 disabled 假按钮；ui/dialog.tsx:75 关闭按钮 sr-only 文案是英文 Close | Todoist/TickTick/Notion | 内置 i18n 框架(messages 目录、语言切换持久化、日期/时区跟随 locale) | 引入 next-intl（或小型 t() 封装）+ lib/i18n/，先迁移高频可见文案（设置、侧边栏、命令面板、快捷帮助）；语言切换写入 store 并更新 document.documentElement.lang；修复 dialog Close sr-only | 无法切换语言，非中文用户不可用；硬编码字符串无法排版/复测 | 高(5-7d 渐进) |
| 高 | 快捷键 | 与浏览器保留键冲突：Ctrl+A=跳分析(与全选/标题栏 selectAll 冲突, title-bar.tsx:91)、Ctrl+D=仪表板(书签)、Ctrl+G=目标(查找)、Ctrl+T=任务(新标签页)、Ctrl+S=设置(保存)、Ctrl+P=专注(打印)（lib/shortcuts.ts:42-155）；标题栏「视图」菜单展示 Ctrl+6..9（数据分析/纪念日/设置/日历）但 shortcuts.ts 未实现；「帮助」菜单展示"快捷键 Ctrl+/"实际是 Shift+?（title-bar.tsx:128）；SHORTCUT_LIST 缺失 Ctrl+K(搜索, desktop-app.tsx:189) | Linear/Obsidian/TickTick | 键位避免浏览器保留键（用 Ctrl+Shift 或 Cmd 平台化）；提供快捷键自定义 UI（keymap 持久化） | 重构 lib/shortcuts.ts：跳视图统一 Ctrl+Shift+数字/字母；与 title-bar.tsx 菜单 accelerator、SHORTCUT_LIST 三方同步（抽出单一配置源 lib/shortcut-defs.ts）；可选加设置页快捷键重映射 | Ctrl+T/P/D 等会触达浏览器副作用；菜单展示与实际不符造成误导 | 中(2-3d) |
| 高 | 命令面板 | 覆盖度低：仅导航/快速任务/add 前缀建任务；无"创建习惯/目标/纪念日/日记/项目/时间块"动作、无"跳转到项目/智能列表/设置项"、无 fuzzy 匹配（command-palette.tsx:213-222 仅 includes 子串）、无最近使用/收藏、search 分类(237-242)从未有数据；快捷键提示为装饰文案 | Todoist/Linear/Notion | 命令与快捷键共享注册表；fuzzy 检索；支持"跳转+创建"双类型；记录最近使用 | 在 lib/ 建 command-registry.ts（id/标题/分类/动作/快捷键），command-palette.tsx 改为消费注册表；接入 lib/smart-input-enhanced.ts 自然语言解析（如"明天下午3点 写周报 #工作"）；增加项目跳转命令 | 键盘流用户效率低；功能入口只能靠鼠标找 | 中(3-4d) |
| 中 | 导航/信息架构 | 功能入口分散：回收站仅在 设置（settings-view.tsx:854）、任务模板/日历订阅/成就/专注封锁无侧边栏与命令面板入口；无标签(Tag)导航、无"今日"聚合视图；项目树无搜索/排序 | TickTick/Notion/Linear | 侧边栏分区（收藏/智能列表/项目/标签/更多），支持项目搜索与排序；"今天"视图作为默认落地页聚合任务+习惯+番茄 | app-sidebar.tsx 增加「更多」分组（回收站、模板、订阅、成就）；项目树支持过滤与重排（可参照现有 taskOrder 扩展 projectOrder）；NAV_ITEMS 增加标签入口 | 找功能靠"翻设置"，导航层级深 | 中(3d) |
| 中 | 通知中心 | 仅 dropdown 弹层：无类型筛选/未读筛选/日期分组/全量页；点击只切视图不定位实体——notification-bell.tsx:48-55 路由表 pomodoro 映射到 'pomodoro'，但 activeView 无此值（store/types.ts:142），当通知缺 actionUrl 时会 cast 后落入无效跳转；实体 relatedId 未被用于深链 | Linear/Todoist/滴答清单 | 通知中心聚合页(分类tab/未读过滤)；点击跳转并定位实体(滚动高亮+展开) | notification-bell.tsx：点击时除 setActiveView 外写 focusflow-selected-item（复用 tasks-view 深链机制, tasks-view.tsx:373-387）；修正 'pomodoro' fallback 为 'focus'；新增全量通知页（Dialog 或独立视图） | 通知只能看类型、点了去不了具体任务；部分通知点错地方 | 中(2-3d) |
| 中 | 响应式断点 | 平板断点空白：侧边栏 hidden lg:block（desktop-app.tsx:289），汉堡按钮 lg:hidden(319-323) → 768-1023px 平板既无侧边栏也无汉堡入口；移动抽屉(293-308)无 Esc 关闭、无焦点陷阱、遮罩无 aria-label | Notion/滴答清单/Google Calendar | md(≥768) 显示精简侧边栏或让汉堡在 <lg 显示；抽屉采用 Dialog 语义(焦点锁定/Esc/aria-modal) | desktop-app.tsx：汉堡按钮从 lg:hidden 改为 <lg 显示或新增 md: 精简侧边栏；抽屉改用 Radix Dialog（自带焦点陷阱/Esc）；补 aria-modal、aria-label | 平板用户无法切换视图，卡死在当前页 | 低-中(1-2d) |
| 中 | 无障碍 | 无 skip-to-content 链接；活跃导航项无 aria-current（app-sidebar.tsx:106-132 仅样式高亮，全项目 aria-current 0 处）；ProjectTree 把折叠按钮做成嵌套在 button 内的 span(role=button)（app-sidebar.tsx:403-426），嵌套交互元素键盘不可达；命令面板无 combobox/listbox 语义（无 aria-activedescendant）；无 prefers-reduced-motion 处理（globals.css 无相关媒体查询，animate-fade-in-up/animate-grow/transition-all duration-200/300 等动画大量使用） | Notion/Obsidian/Linear | 键盘可达性清单：skip link、aria-current、单一交互元素、combobox aria、降低动画偏好（WCAG 2.3.3） | app-sidebar.tsx 加 aria-current、重构 ProjectTree 折叠为独立按钮；desktop-app.tsx 加 skip-link；command-palette.tsx 加 role=combobox+listbox+aria-activedescendant；globals.css 加 prefers-reduced-motion: reduce 时全局禁用动画/过渡 | 键盘/读屏用户无法使用核心导航；晕动用户受动画影响 | 中(2-3d) |
| 中 | 空状态与加载态 | 空状态不统一：任务列表空时渲染 5 个「暂无紧急/高/中/低优先级任务」卡片(2305-2370)而非一个整体空状态 CTA；首次挂载只有 Spinner(desktop-app.tsx:279-285)与 app/loading.tsx，无骨架屏；无 Suspense 视图级 fallback（虽有 per-view ErrorBoundary） | Todoist/TickTick/Notion | 统一 EmptyState 组件（图标+说明+主 CTA+次级动作）；Skeleton 组件；Suspense fallback | 抽 components/ui/empty-state.tsx 并替换 tasks-view/journal-view/analytics-view(843/1037) 等处；对重组件（calendar/analytics）用 Suspense 包裹 | 新用户不知道从哪开始；视觉跳动 | 低-中(1-2d) |
| 低 | 主题一致性 | 双轨主题体系：手工 lib/theme.ts + layout.tsx 内联脚本 + electron/preload.js:3-15 applyTheme 三处重复实现；next-themes 仅用于 widget 页与主应用 sonner.tsx:7 useTheme（主应用根布局未包 ThemeProvider，Toaster 主题来源悬空，存在与手动 .dark 不一致风险）；定时切换 60s 轮询(use-dark-mode-schedule.ts:39)不够平滑且与"跟随系统"并存时行为二义 | Obsidian/滴答清单 | 单一主题源 + 定时切换用 setTimeout 对齐时间点 + 与系统模式互斥提示 | 统一到一处实现（保留内联防闪烁脚本），主应用根布局包裹 ThemeProvider(attribute=class)；use-dark-mode-schedule 到点立即切换，enabled 时明确忽略 system | 深浅色切换偶发不一致；定时切换最长 60s 延迟 | 低(1d) |
| 低 | 性能感知 | 列表无虚拟化：任务列表/看板/矩阵全部 map 渲染（tasks-view.tsx:2149、2303-2388，仅已完成卡截 5 条）、日历月网格(calendar-view.tsx:427/846)、时间线、分析列表均全量渲染；命令面板与全局搜索每键输入全量 filter | TickTick/Things 3 | 大列表虚拟化(@tanstack/react-virtual)或分页/惰性渲染；搜索输入 debounce | 对 tasks-view 的 TaskItem 列表与日历 month grid 用 @tanstack/react-virtual（或先做按需分页：首屏 50 条+加载更多）；global-search/command-palette 输入 debounce 150-200ms | 数百任务时滚轮卡顿、首屏渲染变慢 | 低-中(2-3d) |
| 低 | 入口与一致性细节 | 每日复盘仅 设置+定时弹窗 两个入口（无仪表板/任务页入口）；SHORTCUT_LIST 描述与实现不一致（Ctrl+1-5 笼统、缺 Ctrl+K 等）；命令面板/搜索不含 回收站/模板/订阅/成就 等实体 | TickTick(今日页复盘入口) | 复盘入口放"今天"聚合页；快捷键帮助按分类分组可搜索 | dashboard-view.tsx 加"今日复盘"卡片入口（调 window.__openDailyReview，已由 lib/hooks/use-daily-review-trigger.tsx:27 暴露）；keyboard-shortcuts-dialog.tsx 按导航/动作/专注分组+搜索框，文案从单一配置源生成 | 复盘功能发现率低；帮助文档漂移 | 低(1d) |

## 四、发现的隐患与问题（含文件行号）

1. **[引导失效]** components/views/dashboard-view.tsx:122-124 isFirstTime 判定与默认数据种子矛盾：lib/store/slices/task-slice.ts:29（tasks: defaultTasks，5 条）、habit-slice.ts:15（4 个）、project-slice.ts:14、anniversary-slice.ts:15 首启即非空 → 欢迎卡永不展示；新用户默认持有"学习新框架""整理房间"等任务（lib/config.ts:59-65），与成熟产品"空工作区+引导"相反。
2. **[快捷键冲突]** lib/shortcuts.ts:42-155：Ctrl+A 跳"分析"与系统全选语义冲突；Ctrl+T/Ctrl+P/Ctrl+D/Ctrl+G 均为浏览器保留键（新标签/打印/书签/查找）；标题栏菜单展示 Ctrl+6..9（title-bar.tsx:103-108）实际无实现；帮助菜单展示 "Ctrl+/"（title-bar.tsx:128）实际为 Shift+?。
3. **[无效路由]** components/notification-bell.tsx:48-55 notificationRoutes.pomodoro = 'pomodoro'，而 lib/store/types.ts:142 activeView 不含 'pomodoro'；当通知缺 actionUrl 时点击会经 setActiveView(route as ...)（bell:121）落入 renderView default → 跳仪表板而非专注页。
4. **[平板断点陷阱]** components/desktop-app.tsx:289 侧边栏 hidden lg:block + 汉堡 lg:hidden（319）：768~1023px 无任何导航入口；且移动抽屉（293-308）无 Esc 关闭/焦点陷阱/aria。
5. **[主题双轨]** 主应用未包 ThemeProvider（components/theme-provider.tsx 仅 widget 页与 ui/sonner.tsx:7 使用）；lib/theme.ts、app/layout.tsx:60-64、electron/preload.js:3-15 三处重复实现 applyTheme；定时切换轮询 60s（use-dark-mode-schedule.ts:39）。
6. **[嵌套交互元素]** components/app-sidebar.tsx:403-426：折叠 chevron 用 span(role=button) 嵌在 button 内，键盘无法聚焦展开/收起项目（仅外层按钮可导航）；活跃项无 aria-current。
7. **[i18n 占位]** components/views/settings-view.tsx:1088-1095 English 按钮 disabled；components/ui/dialog.tsx:75 sr-only 文案为英文 Close。
8. **[命令面板副作用]** components/command-palette.tsx:170-183：add 前缀在 Enter 时先建任务又立即关闭，缺少自然语言能力（smart-input-enhanced.ts 未接入）。
9. **[Electron 快捷键重叠]** electron/main.js:531 globalShortcut.register('Ctrl+Shift+P') 与 command-palette.tsx:246 的 Ctrl+Shift+P 同时注册：全局快捷键先截获按键，面板自身 handler 可能不再触发，出现"按一下开、按一下关"抖动风险（需实测确认）。
10. **[列表全量渲染]** 任务列表/看板全部任务 map（tasks-view.tsx:2149、2303…），无虚拟化/分页（仅已完成卡截 5 条），任务量大时首屏与滚动性能下降。

## 五、本模块已有亮点

1. **深链机制完善**：focusflow-selected-item localStorage 深链（components/global-search.tsx:59-61 写入 → tasks-view.tsx:373-387 自动展开+滚动+临时高亮+自动清除），是成熟产品级定位体验。
2. **错误边界体系完整**：error-boundary.tsx + 每视图 fallback（desktop-app.tsx:250-277）+ app/error、loading、not-found 全套，并带"重试/刷新"动作。
3. **专注页全屏状态处理完备**：components/focus/pomodoro-timer.tsx:214-234 同时监听浏览器 fullscreenchange 与 Electron onFullScreenChange，避免 ESC 退出全屏后状态残留。
4. **通知实体有效性检查**：notification-bell.tsx:97-111 点击前检查 related 实体是否已删除，已删则自动移除，避免死链。
5. **自动化守护完善**：定时深色模式+系统主题监听（lib/theme.ts:29-33）、快捷键帮助 Shift+? 全局可开、跨窗口 storage 合并（lib/store/index.ts:85-87）、Electron 剪贴板/拖拽文件建任务等低摩擦入口（desktop-app.tsx:108-236）。
6. **键盘优先基础扎实**：Radix primitives（Dialog/Select/Checkbox/Switch/Tooltip）自带 focus-visible 焦点环与 aria 语义；大部分 icon-only 按钮有 aria-label（如 bell:129、汉堡:324、标题栏窗口按钮）；命令面板有完整键盘操作提示条。