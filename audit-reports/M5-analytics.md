# 统计报表（数据分析 / 专注报表 / 导出）—— 对标成熟软件排查报告

> 模块范围：components/views/analytics-view.tsx、components/focus-report.tsx、components/task-efficiency-card.tsx、components/activity-timeline-card.tsx、components/report-export-dialog.tsx、lib/productivity-score.ts、lib/pdf-export.ts、lib/csv.ts、lib/ics-export.ts、lib/activity-categories.ts、lib/use-activity-tracker.ts、lib/hooks.ts、lib/store/slices/activity-slice.ts、lib/store/slices/time-entry-slice.ts、lib/format.ts 及其关联数据源（lib/data-link-service.ts、lib/store/slices/pomodoro-slice.ts、lib/store/slices/project-slice.ts、lib/pomodoro-completion.ts、lib/config.ts、lib/store/index.ts、components/desktop-app.tsx）。
> 排查方式：全部结论均基于实际读取上述源码（行号已标注），未读到的功能一律不声称存在；本机无网络，对标能力来自内置知识（Toggl / RescueTime / Clockify / Timepage / TickTick 等）。

## 一、对标产品

| 对标产品 | 参照点 |
|---|---|
| Toggl Track | 报表时间范围（自然周/月/自定义区间）、项目×时间柱状图、标签/项目多维拆分、一键 CSV/PDF 导出、周环比 |
| RescueTime | 生产力评分（Pulse）透明度、周/月/年度热力图、"时间去哪了"应用分类统计（工作/分心/中性）、目标与提醒 |
| Clockify | 报表过滤器（项目/标签/任务/用户/日期区间）、明细时间条目表、CSV/XLSX 导出、自定义周期对比 |
| Timepage（Flexibits） | 日历数据与时间统计合并（事件即时间）、周起始日/时区感知、时间块可视统计 |
| TickTick 滴答清单 | 自然周报/月报自动生成、目标完成率图表、习惯频率感知完成率 |

## 二、现状能力盘点（真实读到的功能，逐条注明文件路径）

### 2.1 components/views/analytics-view.tsx（1448 行，主分析页）
- **四 Tab 结构**：overview / trends / details / report（analytics-view.tsx:72, 503-508），由 desktop-app.tsx:263-264 挂载为"分析"视图。
- **概览页**：
  - 5 个指标卡：专注时长(带 sparkline+周环比)、完成任务、深度工作(≥45min)、连续专注(连击天数)、效率评分(加权 40/25/20/15)（analytics-view.tsx:556-602, 292-298）。
  - 专注趋势面积图：7/14/28/90 天预设 + 上期对比虚线（prevTrendData，analytics-view.tsx:160-195, 607-654）。
  - 每日目标达成率：环形 GoalRing + 番茄/分钟双进度（analytics-view.tsx:280-290, 656-681）。
  - 7×24 时段热力图（heatmapData，每周一~周日×24h，analytics-view.tsx:301-321, 683-734）。
  - 智能洞察：黄金专注时段、最佳工作日、碎片化指数、习惯完成率（analytics-view.tsx:323-337, 736-750）。
  - 项目时间分布 Donut（基于 project.totalTime，analytics-view.tsx:209-215, 753-789）。
- **趋势页**："28 天专注趋势"面积图（实为 trendWithComparison，跟随 trendPeriod 预设，默认 7 天）、项目趋势堆叠面积图(28 天)、习惯趋势折线（按周）、时段分布柱状图（仅本周）（analytics-view.tsx:795-913, 340-377）。
- **详情页（单日分析）**：日期导航(前一天/后一天/回到今天)、6 指标卡、24h 热力图、会话时间线（类型/时长/任务/项目色）、项目分布（含周预算进度与超预算红标）、任务投入列表、较昨日/较 6 日均值双对比卡（analytics-view.tsx:915-1383, 398-468, 1047-1383）。
- **数据自动刷新**：30s 定时 + visibilitychange（analytics-view.tsx:136-142）。

### 2.2 components/focus-report.tsx（575 行，"报表" Tab 子页）
- 时间范围：近7/30/90/全部（'all' 最多 365 天）；分组：项目/标签/日期（focus-report.tsx:67-68, 281-303）。
- 横向条形图 + 项目 Donut + 项目详情展开表（含任务级番茄数与时长）+ 标签详情列表（focus-report.tsx:306-571）。
- 内联 CSV 导出（仅项目汇总行，focus-report.tsx:196-209）。

### 2.3 components/report-export-dialog.tsx（382 行，PDF 导出）
- 类型：周报=近7天滚动、月报=近30天滚动、90天（getDateRange，report-export-dialog.tsx:30-52）。
- PDF 内容：概览(时长/番茄/任务/完成度)、目标达成表(日均时长/日均番茄 vs focusGoals)、每日专注表(byDate)、项目 TOP5、洞察(高效日/低效日/高峰时段)、已解锁成就（renderReportHTML，report-export-dialog.tsx:252-381）。
- 与页面联动的 Dialog 预览摘要（report-export-dialog.tsx:207-225）。

### 2.4 组件
- task-efficiency-card.tsx：任务级效率（预估 25min/番茄 换算、实际投入、评级 快/略超/超出较多）（task-efficiency-card.tsx:39-69）。
- activity-timeline-card.tsx：今日应用时间线（工作/分心/中性分类、分心占比、清除记录、Electron 开关）（activity-timeline-card.tsx:27-155）。
- lib/use-activity-tracker.ts：Electron 前台应用采样开关同步（use-activity-tracker.ts:10-64）。

### 2.5 数据与工具层
- lib/productivity-score.ts：computeDailyScore（S/A/B/C/D，任务40+专注30+计划15+习惯15）、computeScoreTrend（productivity-score.ts:12-114）。
- lib/hooks.ts：useStats/useWeekStats/useStreak/useHabitStats/useWeeklyData/useProjectData/useFocusData（hooks.ts:136-445），被仪表盘等复用。
- lib/activity-categories.ts：进程名+窗口标题正则分类（activity-categories.ts:48-65）。
- activity-slice.ts：按天聚合，保留最近 14 天/每天最多 64 个应用、单采样≤300s（activity-slice.ts:9-11, 32-74）。
- time-entry-slice.ts：start/stop/add 手动计时条目（time-entry-slice.ts:16-50）；task-quick-actions.tsx 有开始/停止入口。
- lib/csv.ts：任务 CSV 导入导出（csv.ts:13-177）。
- lib/ics-export.ts：任务+纪念日 ICS 生成（ics-export.ts:24-162）。
- lib/pdf-export.ts：HTML→打印模板、SVG 条形图手工生成、Electron printToPDF IPC 封装（pdf-export.ts:19-426）。
- lib/format.ts：时长/相对时间/周起始工具（format.ts:1-129）。
- 数据入账链路：lib/pomodoro-completion.ts（完成番茄→session+标签计数+时间块/TimeEntry 联动）、lib/data-link-service.ts（任务完成→项目时长增量记账、目标进度、成就、积分；data-link-service.ts:86-363）。

## 三、需要增强与优化的功能

| # | 优先级 | 领域 | 差距描述 | 对标产品 | 成熟做法参考 | 增强建议（指明文件） | 用户影响 | 工作量 |
|---|---|---|---|---|---|---|---|---|
| 1 | 高 | 时间维度 | 无自定义日期区间，趋势仅 7/14/28/90 天预设，详情仅逐日翻页（无日期选择器，analytics-view.tsx:470-472）；无自然周/自然月/年视图；"趋势"页标题写死"28 天"但数据跟随 trendPeriod（默认 7 天，analytics-view.tsx:799-807） | Toggl / Clockify / Timepage | 日期范围选择器 + 周/月/年粒度 + 环比基线可切换 | 新建 components/date-range-picker.tsx；抽 lib/report-utils.ts（getRange(周/月/自定义)）；TrendsTab 增加与 overview 共享的 period 选择器并把标题改为动态 | 无法查看上月/整年/任意区间数据，趋势页首屏标题误导 | 中 |
| 2 | 高 | 评分透明度 | 三套评分并存且权重全部硬编码：analytics 周评分 40/25/20/15、单日评分 240min/6 个/*8 罚分（analytics-view.tsx:292-298, 415-419）、hooks useStats 用 lib/productivity-score 的 40/30/15/15（hooks.ts:181）；均无"构成明细/权重说明"UI | RescueTime Pulse / 番茄ToDo | 单一评分模块 + 明细条（任务/专注/计划/习惯逐项得分+权重说明） | 报表统一改用 lib/productivity-score.ts，增加 focusGoals.dailyPomodoros 注入与 DailyScore 明细展示组件；删除 analytics 内联重复公式 | 评分不可解释、无从指导改进 | 中 |
| 3 | 高 | 数据口径 | 概览"项目时间分布"用 project.totalTime（增量记账，仅在任务完成时入账 data-link-service.ts:121-128），未完成任务的专注不计入；而日报/趋势按 session 现算，两处口径不一致；creditedTaskTime 仅在内存（data-link-service.ts:42, 122-127），重载后完成任务再次标记完成会重复累加 | Toggl / Clockify | 报表一律从 pomodoroSessions/timeEntries 元数据实时聚合 | analytics-view.tsx:209-215 改为按 session 聚合（复用 dayProjectBreakdown 逻辑）；project.totalTime 记账改为读取历史重算或持久化增量 | 饼图占比失真、重复记账 | 低 |
| 4 | 高 | 目标达成率 | 目标环分母 UI 硬编码 "/8""/200"（analytics-view.tsx:670, 675），而 focusGoals 默认每日目标为 120 分钟（pomodoro-slice.ts:112）→ 出柜即显示错误；goal progress 无里程碑时被 (progress+0)/2 减半（data-link-service.ts:289-294） | TickTick / Strides | 展示真实的 focusGoals 值；goal progress=任务完成率（无里程碑不除以 2） | analytics-view.tsx:670/675 渲染 focusGoals.dailyPomodoros/dailyMinutes；data-link-service.ts:294 finalProgress 修正；补周目标(weeklyMinutes)达成卡 | 达成率数字错误、目标激励失效 | 低 |
| 5 | 中 | 导出质量 | PDF 走 window.open+window.print 手动选"另存为 PDF"（report-export-dialog.tsx:161-164 → pdf-export.ts:197-207）；Electron printToPDF IPC 已实现（electron/main.js:727, preload.js:70）但报表入口未使用（exportViaElectronPrint 无调用方，pdf-export.ts:213-231）；月报/90 天每日明细只输出末尾 7 天（report-export-dialog.tsx:149）；日均番茄硬编码除 7（report-export-dialog.tsx:77）；任务完成度分母用全部未归档任务（report-export-dialog.tsx:140-141）；无 XLSX/PNG 图片导出、无会话/TimeEntry 明细 CSV | Clockify / Toggl / TickTick | Electron 内优先 printToPDF 静默存 PDF；按区间输出整表并按实际天数计算均分与完成度分母；报表增加"明细导出(CSV)"（session/entry 级别） | report-export-dialog.tsx 重构 report 计算；pdf-export.ts exportHTMLToPDF 内探测 electronAPI?.printToPDF；focus-report.tsx exportCSV 扩展明细；lib/csv.ts 增加 sessionsToCSV | 导出内容残缺、必须手动打印、桌面端体验差 | 中 |
| 6 | 中 | 报表周期 | 无周报/月报自动生成、无历史周期存档；"月报"是滚动 30 天而非自然月（report-export-dialog.tsx:41-46）；90 天选项标签叫"custom" | TickTick 周报 / Clockify digest | 自然周(周一起)/自然月报表 + 历史周报列表 + 自动生成入口（每日复盘联动） | 新建 components/weekly-report.tsx + lib/store/slices/report-slice.ts；getDateRange 改用自然周/月 | 无法按自然周期回顾、跨月数据错位 | 中 |
| 7 | 中 | 图表与交互 | 无年度热力图（仅 7×24 周网格，analytics-view.tsx:301-321）、无图表缩放/Brush/参考均线、无点击下钻（热力图仅 title 提示）、无周对比完整图、无目标趋势/习惯逐项图表 | GitHub 热力图 / RescueTime 月视图 / Toggl 周对比 | 新增年热力图组件；recharts Brush 时间缩放 + ReferenceLine 均值；点击热力格跳转单日详情 | 新建 components/focus/heatmap-year.tsx；analytics-view.tsx 热力图/趋势卡集成 Brush 与钻取回调 | 长期趋势与年度模式看不清 | 大 |
| 8 | 中 | 维度覆盖 | 统计未纳入：时间块（计划 vs 实际，analytics 未引用 timeBlocks）、目标进度趋势、日记/纪念日、手动计时 TimeEntry 明细、日历订阅数据（externalEvents/subscribedCalendars 在报表中零引用） | Timepage / Clockify | 增加"时间块计划完成率"报表、目标进度趋势线、日历事件时长并入统计、TimeEntry 明细表 | lib/report-utils.ts 聚合 timeBlocks/goals/journals/externalEvents；analytics-view.tsx 新增卡片或子 Tab（components/views/analytics-tabs/） | 计划执行无法复盘、日历时间未统计 | 大 |
| 9 | 中 | 活动追踪 | 应用时间线仅展示"今日"（activity-timeline-card.tsx:37-43），无历史/周聚合视图；数据仅保留 14 天、单日上限 64 个应用超限静默丢弃（activity-slice.ts:9-11, 61-65）；分类粒度仅进程名+窗口标题（活动-categories.ts:48-65），无 URL 级细分；清除记录无确认弹窗（activity-timeline-card.tsx:51-54） | RescueTime | 活动周报（应用排名/分类占比趋势）、保留期可配置、粒度提升（Electron 侧提供 URL）、清除加 AlertDialog 确认 | activity-timeline-card.tsx 扩展历史视图；activity-slice.ts MAX_DAYS 提入设置；lib/activity-categories.ts 细化；清除改 AlertDialog | 无法回答"上周时间去哪了"，误删数据风险 | 中 |
| 10 | 中 | 周起始日/时区 | 无用户设置且多处不一致：analytics 用 weekStartsOn:1（analytics-view.tsx:149, 200）、format.ts isThisWeek 按周日起始（format.ts:89-98）而 getWeekStart 返回周一（format.ts:119-128）、useWeekStats 周一（hooks.ts:221-223）、time-tracker 周日优先（time-tracker.tsx:86）；ICS 时区硬编码 Asia/Shanghai（ics-export.ts:32） | Todoist / TickTick / Timepage | 设置页增加"周起始日"与"时区"，全库统一 startOfWeek 参数；ICS 采用 VTimezone 或用户时区 | settings-view.tsx 增加设置项；lib/format.ts isThisWeek 修正；lib/config.ts 增加 DAY_ORDER_BY_WEEK_START；lib/ics-export.ts 时区参数化 | 跨周统计偏差、日历订阅跨时区漂移 | 低 |
| 11 | 中 | 指标准确性 | 休息时长硬编码 短休5/长休15（analytics-view.tsx:406）、深度工作≥45min（analytics-view.tsx:253）、评分基线 240min/6 个/480min/35 任务（analytics-view.tsx:293-297, 415-417）、task-efficiency 预估固定 25min/番茄（task-efficiency-card.tsx:45）——均不跟随 pomodoroSettings/focusPresets/focusGoals | 番茄ToDo / Clockify | 从 pomodoroSettings.workDuration / focusPresets 取真实时长；基线引用 focusGoals | analytics-view.tsx:406/253/293-297/415-419 改为参数化；task-efficiency-card.tsx:45 读取当前 workDuration | 使用非默认番茄时长时数字失真 | 低 |
| 12 | 中 | 习惯维度 | 趋势分母用 activeHabits×7 当作每天（analytics-view.tsx:373），与概览按频率（isHabitScheduledOn，analytics-view.tsx:240-250）不一致；useHabitStats.getHabitCompletionRate 以 days 为分母（hooks.ts:322-334） | Strides / TickTick | 分母统一按 isHabitScheduledOn 频率计算 | analytics-view.tsx:361-377 复用 summaryStats 逻辑；hooks.ts:322-334 增加频率感知参数 | 低频习惯完成率被低估 | 低 |
| 13 | 低 | 性能 | AnalyticsView 内联定义 OverviewTab/TrendsTab/DetailsTab 函数组件（analytics-view.tsx:546/795/916），30s now 变化即重建组件类型→整棵子树重挂载、图表重绘丢悬停状态；日级别过滤在 useMemo 内对全量 session/task 做 O(N×M) 循环（analytics-view.tsx:398-468）；'all' 范围上限 365 天静默截断（focus-report.tsx:165-167） | 成熟产品图表节流 | 拆分为顶级组件；趋势/热力图数据用"按日聚合索引"减少重复 filter；'all' 提示截断 | analytics-view.tsx 结构拆分；lib/report-utils.ts 提供按日聚合缓存 | 数据量大时切换卡顿、图表闪烁 | 中 |

## 四、发现的隐患与问题（可注明文件行号）

1. **目标环显示与计算不一致（低级 bug，出柜即错）**：analytics-view.tsx:285-288 按 focusGoals（默认 dailyMinutes=120，pomodoro-slice.ts:112）计算达成率，但 670/675 行 UI 硬编码显示 "/8" 与 "/200"，与 store 默认值（8 个、120 分钟）不符。
2. **无数据日评分为"A"**：productivity-score.ts:53-56（无到期任务→taskScore=40）、64-70（无时间块→planScore=15）、72-81（无习惯→habitScore=15），无任何记录的一天得分 40+0+15+15=70→grade A，评分失去区分度。
3. **目标进度被除以 2**：data-link-service.ts:289-294 无里程碑目标时 milestoneProgress=0，finalProgress=(progress+0)/2，目标进度被腰斩。
4. **项目时长记账缺陷**：data-link-service.ts:121-128 仅在任务完成时按增量入账，且 creditedTaskTime 为内存态（:42），应用重启后该任务再次切换完成态会从 0 重新累加 → project.totalTime 重复入账风险；同时未完成任务专注不计入项目时长（与报表口径不一致，见差距 #3）。
5. **报表计算错误**：report-export-dialog.tsx:77 avgPerDay 恒除 7（30/90 天报表日均错误）；:149 byDate.slice(-7) 月报/90 天明细只剩 7 天；:140-141 taskCompletion 分子为区间内完成数、分母为全部任务（区间完成度失真）；:265-271 dailyGoalDays 多算 1 天后又在 :309 直接相除（周报日均偏低）。
6. **趋势页标题与数据不符**：analytics-view.tsx:801 写死"28 天专注趋势"，:807 数据为 trendWithComparison（默认 7 天），首屏展示 7 天却宣称 28 天。
7. **时段分布仅统计本周**：analytics-view.tsx:197-207 hourlyDistribution 以 startOfWeek 为起点，无法反映 30/90 天的时段规律（时段卡又位于趋势页语境下）。
8. **习惯趋势分母忽略频率**：analytics-view.tsx:373 用 activeHabits×7，happened 的周频习惯完成率被低估，与概览口径（:240-250 按 isHabitScheduledOn）互相矛盾。
9. **周起始约定混乱**：format.ts:89-98（周日起始）vs :119-128 getWeekStart（周一）vs analytics weekStartsOn:1；无用户配置项。
10. **活动数据静默丢失**：activity-slice.ts:61-65 超 64 个应用/天直接 return 不记录；:70 仅保留 14 天；清除无确认（activity-timeline-card.tsx:51-54）。
11. **Electron 打印能力闲置**：electron/main.js:727 与 preload.js:70 已实现 printToPDF，pdf-export.ts:213-231 也封装了 exportViaElectronPrint，但报表入口只走 window.open+print（report-export-dialog.tsx:161-164）。
12. **评估基线全部硬编码**：analytics-view.tsx:406（短休5/长休15）、:253（≥45min 深度）、:415-419（240min/6 个/*8 罚分）、:293-297（480/35/7），不感知用户自定义番茄设置/目标。
13. **ICS 时区硬编码**：ics-export.ts:32 X-WR-TIMEZONE:Asia/Shanghai，且带时刻事件用 toISOString(UTC)（:5-6），跨时区用户日历订阅会漂移。
14. **无效代码/死代码**：pdf-export.ts exportFocusReportToPDF / exportElementToPDF / exportViaElectronPrint 均无调用方；focus-report.tsx:55 引入 startOfMonth 未使用；analytics 内联公式与 lib/productivity-score.ts 重复实现。

## 五、本模块已有亮点

1. **信息架构完整**：四 Tab（概览/趋势/详情/报表）覆盖"汇总→趋势→单日下钻→输出"，比多数同类应用更完整；单日详情页含 24h 热力图、会话时间线、项目分布、任务投入、双对比卡，下钻能力扎实。
2. **环比能力**：趋势图上期虚线对比（analytics-view.tsx:175-195）、单日"较昨日/较 6 日均值"双环比（analytics-view.tsx:443-465），具备 Toggl 级别对比意识。
3. **项目周预算监管**：单日详情页展示项目周预算消耗与"超预算"红标（analytics-view.tsx:1249-1284），为 Clockify/Timepage 级别特性。
4. **智能洞察**：黄金专注时段/最佳工作日/碎片化指数自动生成（analytics-view.tsx:323-337），接近 RescueTime 的 Pulse 与"最佳时段"建议。
5. **习惯频率感知**：概览周完成率按 isHabitScheduledOn 计算（analytics-view.tsx:240-250），比"每天计次"更准确（尽管与趋势页口径不一致）。
6. **免重依赖的 PDF 工程**：pdf-export.ts 手工生成 SVG 条形图 + 打印 CSS（A4/分页/颜色保持），并在 Electron 主进程备好 printToPDF，为后续一键导出留下通道。
7. **记账防重设计**：data-link-service.ts 提供"已完成事件去重发积分（:40, 131-135）"、"项目时长只记增量（:42, 121-128）"、"session 与 TimeEntry 取较大值防双计（:349-351）"等工程化细节。
8. **自动刷新与跨窗口**：30s 定时 + visibilitychange 刷新（analytics-view.tsx:136-142），localStorage 节流 2s 落盘（store/index.ts:152-217），对长时间挂机场景友好。
9. **本地优先级**：活动数据明确"仅本机、不上传"（activity-timeline-card.tsx:68），符合 RescueTime 本地模式的产品取舍。
