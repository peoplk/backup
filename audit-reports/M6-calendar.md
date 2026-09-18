# 日历与时间块 —— 对标成熟软件排查报告

> 排查范围：components/views/calendar-view.tsx、components/views/time-block-view.tsx、components/calendar-subscriptions-manager.tsx、lib/store/slices/time-block-slice.ts、lib/calendar-subscriptions.ts、lib/use-calendar-subscriptions.ts、lib/ics-parse.ts、lib/ics-export.ts、lib/dnd.ts、lib/config.ts，以及关联的 lib/types.ts、lib/store/slices/subscription-slice.ts、lib/smart-lists.ts、lib/hooks.ts、components/views/settings-view.tsx、components/views/tasks-view.tsx、components/views/analytics-view.tsx、android-app/src/pages/Calendar.tsx、android-app/src/pages/TimeBlock.tsx。
> 所有"现状"结论均基于实际读到的代码，逐条标注文件与行号；未读到的不声称存在。

## 一、对标产品

| 对标产品 | 本模块参考点 |
| --- | --- |
| Google Calendar | 月/周/日时间网格、重叠事件侧排、全天条、重复事件与例外(occurrence)、时区、订阅聚合配色与过滤、快速创建 |
| Fantastical | 自然语言输入、今天导航、冲突可视化、日历悬浮详情 |
| TickTick 滴答清单 | 任务与日历双向联动（任务拖上日历/拖入时间块）、“今天”便捷导航、农历/节假日标注、周起始日设置、时间块统计、ICS 导出 |
| Toggl / Clockify | 计划 vs 实际时间口径、类别时长趋势统计 |
| Forest / Session | 时间块与专注(番茄)联动、时段归属 |

## 二、现状能力盘点（真实读到）

1. **日历三种视图（月/周/日）**：components/views/calendar-view.tsx:93（viewMode）、1557-1586（Tabs 切换）。
2. **月视图**：7 列网格、今天/选中高亮、每格最多展示 2 条事件 + “+N 更多”、完成任务/番茄角标 —— calendar-view.tsx:400-492。注意：月格子事件来自 getEventsForDate（201-279），该函数**不含 timeBlocks**（时间块不显示在月视图）。
3. **周视图**：左侧 7 日选择条 + 当日事件列表（全天/上午/下午/晚上分组）+ 本周概览统计（任务/番茄/时长/习惯）—— calendar-view.tsx:597-1140。注意：**不是 7 列时间网格**，而是列表形态。
4. **日视图**：左侧时间轴 + 绝对定位时间块胶囊 + 小时网格内任务/订阅事件 + “当前时间红线”与自动滚动 —— calendar-view.tsx:1142-1388、393-398、1315-1325。
5. **时间块 CRUD**：lib/store/slices/time-block-slice.ts:15-31（add/update/delete/getTimeBlocksForDate）；页面入口 components/views/time-block-view.tsx:148-195（含删除确认、完成切换 toggleBlockComplete:193-195）。
6. **时间块快捷创建**：点击小时格弹出创建（time-block-view.tsx:482-492）、编辑对话框复用（647-763）；起止时间仅整点下拉（681-699）。
7. **时间块当日统计**：已规划时长(总分钟)、完成数、类别分布与百分比条 —— time-block-view.tsx:249-270、579-610；calendar-view.tsx:1414-1474。
8. **外部日历订阅**：添加/启停/删除/逐条刷新/全部刷新/状态展示（idle/syncing/synced/error）—— components/calendar-subscriptions-manager.tsx:22-173；存储层 lib/store/slices/subscription-slice.ts:20-75；刷新逻辑 lib/calendar-subscriptions.ts:10-58（串行、15s 超时、2MB 上限）；启动后 3s + 每 30 分钟自动同步 lib/use-calendar-subscriptions.ts:10-35。
9. **ICS 解析**：VEVENT 的 SUMMARY/DTSTART/DTEND/UID、全天(VALUE=DATE)、UTC(Z)/本地时间、行折叠；**解析时过滤 90 天前事件并限制 500 条** —— lib/ics-parse.ts:52-107。
10. **ICS 导出**：任务(含 RRULE、VALARM 提醒、PRIORITY、STATUS/COMPLETED) + 纪念日(年度 RRULE、提前提醒)—— lib/ics-export.ts:24-162；入口 components/views/settings-view.tsx:2108-2115。
11. **事件聚合展示**：把任务(dueDate)、时间记录、纪念日、番茄钟汇总、订阅事件统一聚合到日历 —— calendar-view.tsx:201-279；周视图 getEventsForDateDetailed:602-679。
12. **任务与日历联动**：日历中可勾选完成/取消完成任务（calendar-view.tsx:169-174、786-805、1117-1119），周视图含“本周待办”快捷列表（1097-1133）。
13. **与提醒联动**：任务级提醒（到点/提前 N 分钟/绝对时间）由 lib/use-auto-notifications.ts:55-82 触发；ICS 导出附带 VALARM（ics-export.ts:99-124）。时间块**无**提醒字段。
14. **工作时段设置**：settings-view.tsx:770-840 提供“启用工作时间”配置（store 见 lib/store/slices/dashboard-slice.ts:23-26），但**未被日历/时间块视图消费**（grep workingHours 仅命中 settings 与 store，无视图渲染）。
15. **Android 端**：日历页支持月/周视图与**拖拽任务改期**（android-app/src/pages/Calendar.tsx:94-101）、周起始日=周一（:61）；时间块页有周条 + DatePicker/TimePicker（TimeBlock.tsx:67-99）。桌面端反而没有拖拽改期。

## 三、需要增强与优化的功能

| 优先级 | 领域 | 差距描述 | 对标产品 | 成熟做法参考 | 增强建议（指明文件） | 用户影响 | 工作量 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 高 | 周视图形态 | 周视图是“星期选择条 + 当日列表”，**没有 7 列时间网格**，无法横向比较一周各时段排布、无重叠侧排 | Google Calendar / TickTick / Fantastical | 七列并排 + 左侧时间轴，事件按绝对时间定位、重叠时左右侧排、全天事件置顶 | 新建周网格渲染（重构 calendar-view.tsx renderWeekView:597-1140 或新建 components/views/week-grid.tsx），复用 getBlockStyle（1147-1158）定位逻辑；同步支持拖拽 | 排期核心体验缺失，无法一眼看一周 | 中 |
| 高 | 时间块拖拽/伸缩 | 页面文案宣称“拖拽式时间管理”（time-block-view.tsx:287），但全仓 @dnd-kit 仅用于 tasks-view.tsx:98、goals-view.tsx:19，**时间块无任何拖动/缩放实现**；改期、改时长只能开对话框 | Google Calendar / TickTick / Session | 拖动块换小时段、底部/顶部把手下边缘缩放（15 分钟吸附）、拖到其他日期改期；拖动中实时冲突高亮 | 在 time-block-view.tsx 与 calendar-view.tsx 的块渲染（1328-1355）引入 @dnd-kit/core（复用 tasks-view.tsx:98-100 先例）；新增拖拽态 state（临时 startTime/endTime），onDragEnd 调 updateTimeBlock | “拖拽式”名不副实，排期效率低 | 大 |
| 高 | 时间粒度 | 起止时间选择仅有整点 TIME_SLOTS（lib/config.ts:143-146），无法创建 09:30、13:15 等非整点时段；任务事件的 timeSlots 同样整点（tasks-view.tsx:1769-1792） | Google Calendar / TickTick | 15/30 分钟步进选择器，或原生 type="time" 输入 | TIME_SLOTS 改为 15 分钟步进（或保留整点并新增 type="time" 输入，参考 settings-view.tsx:790-805 的用法），同步改 calendar-view.tsx:1230-1248、time-block-view.tsx:681-699、tasks-view.tsx:1769 | 时间块/日程只能整点，规划颗粒粗 | 小 |
| 高 | 重复事件 | 本地任务的 repeatRule 在日历**不展开**（只按 dueDate 匹配，calendar-view.tsx:206/621）；订阅解析**完全忽略 RRULE/EXDATE/RECURRENCE-ID**（ics-parse.ts:87-103）；lib/hooks.ts:30-40、lib/smart-lists.ts:19-38 的复发判断只是“dueDate<=today”近似，周一重复任务会显示为每天都到期 | Google Calendar / TickTick | 统一复发引擎：FREQ/INTERVAL/BYDAY/BYMONTHDAY/UNTIL/COUNT/EXDATE，日历按所选日期展开 occurrence | 新建 lib/recurrence.ts 作为唯一复发计算引擎（本地任务 + 订阅共用）；calendar-view.tsx 聚合时按日期展开；hooks.ts/smart-lists.ts 改为调用引擎做“该日期是否有 occurrence”判断 | 周/月重复任务在日历只出现一次；订阅重复事件全部丢失 | 大 |
| 中 | 时区 | 无时区设置；ICS 解析对 TZID/VTIMEZONE“按本地时间解释”（ics-parse.ts:7 注释）；导出硬编码 X-WR-TIMEZONE:Asia/Shanghai（ics-export.ts:32）；任务日期也是本地 Date 混合语义 | Google Calendar / Fantastical | 用户时区配置 + IANA 时区存储展示；导出写用户时区；浮动时间与 Z 时间区分 | settings-view.tsx 增加时区选择（写入 store，参考 workingHours 模式）；ics-export.ts:32 改读用户时区；ics-parse.ts 对 TZID 至少做 UTC 规范化 | 跨时区用户（出差/海外）事件时间错位 | 中 |
| 中 | 全天事件 | 日程有 isAllDay 开关（tasks-view.tsx:1752），但日历把**所有任务时间统一取 dueDate**（calendar-view.tsx:215、629），全天日程显示 00:00（见隐患 1）；周视图“全天”分组（1046-1051）只收无 time 的聚合事件 | Google Calendar / TickTick | 全天条置顶；isAllDay 任务 time 置空入全天区；月视图格子显示全天/时间块计数 | calendar-view.tsx：getEventsForDate/Detailed 对 isAllDay 任务 time=undefined；月视图事件源加入 timeBlocks | 全天日程视觉错误，月视图看不到时间块 | 小 |
| 中 | 外部日历互通（订阅聚合 + ICS 导入导出） | 订阅仅 4 个属性解析（无描述/地点/分类/重复）；**解析时过滤 90 天前并限 500 条**（ics-parse.ts:105-106），翻看历史月份无订阅事件；月视图所有订阅统一紫色（calendar-view.tsx:267-268，`void cal` 忽略配色）；刷新串行无失败退避；导出仅任务+纪念日（settings-view.tsx:2109）**不含时间块**，且无 .ics 文件导入（仅订阅 URL） | Google Calendar / TickTick | 按日历配色渲染 + 日历级显示开关 + 按需区间解析 + 失败退避；导出含时间块 VEVENT（UID 稳定）；支持 .ics 导入转本地任务/时间块 | calendar-view.tsx 用 cal.color 渲染订阅事件（订阅已有 color，subscription-slice.ts:29）；ics-parse.ts 改为按请求区间解析或放宽过滤；calendar-subscriptions.ts:48-53 并行化+退避；lib/ics-export.ts 增加 timeBlocks 参数并生成 VEVENT（有 endTime 用起止时间，否则全天）；新增导入入口（读文件 → parseICS 复用 → 写入 store） | 多订阅无法区分来源、历史数据缺失、时间块无法同步到系统日历 | 中 |
| 中 | 事件冲突提醒 | 无时间块间/时间块与任务、订阅事件的重叠检测，也无冲突可视化；时间块不能挂提醒，也无法联动专注屏蔽 | Google Calendar / Fantastical / Opal | 添加/拖动时实时检测重叠并红条高亮 + 提示；时间块可设置提醒或启动 useAutoShield | 新建 lib/conflict-check.ts（块间、块与任务事件、块与订阅事件）；在 add/update/拖动结束处调用；TimeBlock 类型（lib/types.ts:245-257）增加 reminder 字段，联动 lib/use-auto-notifications.ts 或 lib/dnd.ts:115 的 useAutoShield | 排期重叠不自知，计划打架 | 中 |
| 中 | 任务到日历的转换 | 桌面无“任务拖到日历改日期/拖入时间线转时间块”（Android 已有拖拽改期 android-app/src/pages/Calendar.tsx:94-101）；“可关联任务”仅是点击把标题填入表单（time-block-view.tsx:612-643） | TickTick / Things 3 | 任务列表拖入日历格子改 dueDate；拖入时间线直接生成时间块并带 taskId | tasks-view.tsx 拖拽（930-933）扩展：日历格子 onDrop 改 dueDate；time-block-view.tsx 时间线 onDrop 生成块（复用 handleAddBlock 逻辑） | 桌面排期需要两步操作，效率低 | 中 |

| 中 | 农历/节假日 | 全仓无农历与节假日数据（grep “农历|lunar|holiday|节假日|节气” 0 命中）；仅内置两个默认纪念日（lib/config.ts:48-51） | TickTick 滴答清单 / 小日常 | 月视图标注农历日期与法定节假日；纪念日支持农历重复（农历生日） | 新增 lib/lunar-calendar.ts（内置 2024-2027 公历-农历换算 + 国内节假日表），月视图日期格角标；Anniversary repeat 增加 lunar 类型（lib/types.ts:187） | 中文用户日历无农历/节日，与主流日历体验落差大 | 中 |
| 中 | 时间块统计 | 统计页无时间块维度（analytics-view.tsx grep timeBlocks 0 命中）；周视图“工作时长”统计的是 timeEntries（calendar-view.tsx:687-693），与时间块“已规划时长”（time-block-view.tsx:249-255）口径不同 | Toggl / Clockify / TickTick | 计划 vs 实际对比、分类时长趋势、达成率 | analytics-view.tsx 新增时间块板块（达成率、类别占比、近 7 天趋势）；周视图并列展示“计划时长 vs 实际时长” | 计划执行率无数据支撑，统计口径混乱 | 中 |
| 低 | 周起始日 | 桌面日历周从周日开始（calendar-view.tsx:192 用 getDay() 起始；config.ts:139 首列“日”），统计页用周一（analytics-view.tsx:149），Android 用周一（Calendar.tsx:61）；无用户设置 | Google Calendar / TickTick | weekStartsOn 0|1 可配置，全端统一 | 设置项加入 settings-view.tsx（参照 workingHours 区块 770-840）；store 增加 weekStartsOn 字段；calendar-view.tsx / analytics-view.tsx / android Calendar.tsx 统一读取 | 周视图与统计周界不一致，口径混乱 | 小 |

## 四、发现的隐患与问题

1. **日程（事件）在日历上显示为 00:00**：事件表单只填 startTime/endTime（tasks-view.tsx:1748-1797），但 handleAddTask 仅把 dueDate 设为日期午夜、dueTime 为空（tasks-view.tsx:618-625），而 calendar-view.tsx:215/629 统一取 dueDate 的时间 → 所有“日程”在日/周视图显示 00:00 且无结束时间；同时 ICS 导出（ics-export.ts:41-49）用的是 task.startTime/endTime → **日历显示与导出时间口径不一致**，属于功能缺陷（应让日历取 startTime，或在创建事件时把 startTime 写入 dueDate）。
2. **“拖拽式”名不副实**：time-block-view.tsx:287 页面副标题宣称“拖拽式时间管理”，但全仓 @dnd-kit 仅用于 tasks-view.tsx:98、goals-view.tsx:19，时间块/日历无任何 DnD。
3. **月视图漏掉时间块**：getEventsForDate（calendar-view.tsx:201-279）不含 timeBlocks，月格子看不到时间块规划，与周/日视图信息不一致。
4. **时间块可创建逆序时长**：time-block-slice.ts:15-31 无 endTime>startTime 校验；可创建 10:00-08:00，视图高度被 clamp 到 28px（calendar-view.tsx:1156）显示为乱块；time-block-view.tsx:243 同理。
5. **订阅视图配色失效**：calendar-view.tsx:274 使用 `void cal` 丢弃订阅配色，月视图所有订阅事件统一紫色（267-268），订阅管理面板的 color（subscription-slice.ts:29）形同虚设。
6. **订阅历史数据永久丢失 + 全量重拉**：ics-parse.ts:105-106 在**解析时**就过滤 90 天前事件并限制 500 条，翻看历史月份订阅事件缺失；且每次自动同步都全量 fetch（lib/use-calendar-subscriptions.ts:30 + refreshAllSubscriptions 串行），无增量/缓存/退避。
7. **ICS 导出时区/重复语义瑕疵**：X-WR-TIMEZONE 硬编码 Asia/Shanghai（ics-export.ts:32）；RRULE 的 UNTIL 拼接“本地日期+T235959Z”（ics-export.ts:94），本地日期与 UTC 时刻混合，Google Calendar 导入后可能偏移一天。
8. **周视图每帧重建事件数组**：getEventsForDateDetailed（calendar-view.tsx:602-679）与 dayViewEvents（353）未 memo，随每次渲染重建、并依赖 daily new Date，事件多时影响滚动与输入流畅度（性能隐患）。
9. **周起始日三处不一致**：桌面周日 / 统计周一 / Android 周一（见差距表第 12 行），跨端统计口径打架。
10. **订阅事件不进入时间块视图**：时间块视图（time-block-view.tsx:100-104）只读 timeBlocks，规划时看不到外部订阅日程，无法避开冲突。
11. **提醒类任务（type=reminder）在日历无专属渲染**：聚合时与 task 同色同形，仅列表角标区分（calendar-view.tsx:551-553），语义含糊。

## 五、本模块已有亮点

1. **统一事件聚合架构**：单一日历聚合任务、时间记录、纪念日、番茄钟、订阅事件（calendar-view.tsx:201-279），是“个人时间中枢”的正确方向。
2. **订阅管理状态机完整**：idle/syncing/synced/error + 启用开关 + 单项/全部刷新 + 上次同步时间展示（calendar-subscriptions-manager.tsx:134-140），超过多数自建应用。
3. **日视图“今天”自动定位**：打开自动滚动到当前时刻（calendar-view.tsx:393-398），并带“当前时间红线”（1315-1325、1031-1044）。
4. **ICS 导出质量较好**：已含 RRULE、多 VALARM 触发换算、PRIORITY、STATUS/COMPLETED（ics-export.ts:69-124）。
5. **重复任务完成记录体系**：RepeatTaskCompletion + isRepeatTaskCompletedToday（lib/hooks.ts:42-49）+ 智能列表复用，复发数据模型已有基础，缺的是展开引擎（lib/recurrence.ts）。
6. **Android 端已实现拖拽改期与周一起始**（Calendar.tsx:94-101、61），证明团队具备 DnD 能力，桌面端补齐成本可控。
7. **时间块快捷统计面板**：时间块/完成/已规划/待完成四宫格（time-block-view.tsx:505-524）+ 类别分布进度条（579-610），直观好用。
8. **工作时段配置已存在**（settings-view.tsx:770-840），未来可平滑接入日历灰显非工作时段。
