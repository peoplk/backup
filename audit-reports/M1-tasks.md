# 任务管理模块 —— 对标成熟软件排查报告

> 对标产品：Todoist、TickTick 滴答清单、Things 3、Microsoft To Do、Google Tasks
> 排查方式：实际读取代码（文件+行号），本报告全部结论均来自代码实证；未读到的功能一律不声称存在。

## 一、对标产品

| 产品 | 重点参照能力 |
|---|---|
| Todoist | 自然语言快速添加（日期/优先级/项目/标签/重复规则一杆式解析）、项目过滤（点击侧边栏项目即过滤）、NLP 重复规则（every Monday）、快捷键 P1-P4/1-7 改期、No Date 列表 |
| TickTick 滴答清单 | 智能列表（今天/未来7天/无日期/已逾期）、项目即列表、任务拖拽改期与排序、多提醒（到时/提前N分钟/每周期重复）、归档与取消归档视图、批量改期/改项目 |
| Things 3 | 无日期(Someday)/今日/接下来分层、拖拽到日期区排期、子任务深度嵌套、Checklist 转任务 |
| Microsoft To Do | 我的日子(My Day)聚合、列表+步骤、背景计划、重复提醒、任务步骤子项 |

## 二、现状能力盘点（真实读到的功能，逐条注明文件路径）

1. **任务 CRUD 与完成逻辑**：lib/store/slices/task-slice.ts（addTask L30-41、updateTask L42-47、deleteTask L48-70 软删除进回收站、completeTask L89-244、uncompleteTask L245-298、skipRepeatTask L299-347、pause/resume L348-403）。
2. **任务/日程/提醒三类型**：lib/types.ts L35-36 ScheduleItemType、L66-100 Task（type 区分 task/event/reminder）。
3. **子任务系统**：task-slice.ts L493-588（增删改/拖拽排序 reorderSubTasks/提升为独立任务 convertSubTaskToTask）；SubTask 含 dueDate（lib/types.ts L1-7）；任务行内展开编辑（components/views/tasks-view.tsx L789-833、L1234-1249）。
4. **任务依赖（双向）**：task-slice.ts L605-654（addTaskDependency/remove/getBlockedTasks/canCompleteTask）；UI components/task-dependencies.tsx（被阻塞提示 L97-107）+ 依赖图 components/task-dependency-graph.tsx。
5. **重复任务**：RepeatRule（daily/weekly/monthly/yearly/custom + daysOfWeek/dayOfMonth/endDate/endAfterCount/paused）lib/types.ts L16-25；完成滚动/跳过/暂停/恢复/补刷新 task-slice.ts L119-403；重复完成历史 repeatCompletions（store types L232-237）。
6. **提醒（绝对/相对截止/到时）**：TaskReminder L38-46；UI components/task-reminders.tsx（预设 5/15/30 分钟/1/2 小时/1 天 L18-26、绝对时间、到时）；触发引擎 lib/use-auto-notifications.ts L41-112（60s 轮询 + notified-registry 去重 + 浏览器通知）。
7. **NLP 快速添加**：lib/smart-input-enhanced.ts（优先级 P1-P4/紧急 L15-20、能量 L22-26、日期解析 L125-176、时间解析 L178-218、标签 #L85-89、项目 @L91-96、番茄 2🍅 L98-103）；components/smart-quick-add-task.tsx（实时预览+校验+建议）；components/quick-capture.tsx（Ctrl+Shift+A 全局快速捕获 L56-80）。
8. **视图**：列表（按优先级分组）/看板（拖拽改状态+WIP 限制）/四象限矩阵，tasks-view.tsx L338、L442-497、L2032-2060、L2064-2286。
9. **智能列表**：lib/smart-lists.ts L80-183（今天/明天/最近7天/已逾期/收集箱/已完成/所有任务）+ 侧边栏星标列表 components/app-sidebar.tsx L200-261；重复任务今日完成态判断 L19-38。
10. **项目（含父子树）**：Project（parentId、budgetMinutes）lib/types.ts L145-153；lib/store/slices/project-slice.ts（deleteProject 级联删除子项目并清理任务/时间记录引用 L32-65）；侧边栏 ProjectTree 折叠树+计数 app-sidebar.tsx L365-446。
11. **批量操作**：components/batch-operations.tsx（完成/优先级/加标签/删除浮层 L84-195）+ 多选 TaskSelectionWrapper L197-220；store：batchComplete/batchDelete/batchUpdatePriority/batchAddTag（含回收站与依赖清理 L435-492）。
12. **保存的筛选**：lib/store/slices/dashboard-slice.ts L78-94（增/改名/删/排序）；UI components/saved-filters-bar.tsx（保存/应用/重命名/删除/匹配高亮 L41-140；criteria 含 project 字段 lib/types.ts L48-57）。
13. **模板**：components/task-templates.tsx（内置 日常会议/代码开发/健身/家务 L58-100）；模板 store（taskTemplates、applyTaskTemplate，lib/store/types.ts L197-200）。
14. **全局搜索**：components/global-search.tsx（任务/习惯/纪念日/时间记录 L32-54，选中导航 L58-84）。
15. **日期预设**：components/quick-date-presets.tsx（今天/明天/后天/本周六/下周一/下个月/无日期 L21-81）。
16. **快捷键**：lib/shortcuts.ts（Ctrl+N 新建、Ctrl+Shift+A 捕获、视图跳转等 L316-329）。
17. **回收站/撤销**：deleteTask 入 trashedItems（task-slice.ts L65-68）、undoLastDelete/restoreFromTrash/emptyTrash（trash-slice.ts L70-196）、toast 撤销（tasks-view.tsx L1216-1226）。
18. **任务与专注/习惯/目标联动**：lib/data-link-service.ts（handleTaskCompletion L86-120：积分/成就/目标进度/项目时长按增量入账）。
19. **标签管理**：Tag 实体+usageCount（lib/types.ts L285-292）；tag-slice.ts（删除级联清理任务/时间记录 L34-42）。

## 三、需要增强与优化的功能

| 优先级 | 领域 | 差距描述 | 对标产品 | 成熟做法参考 | 增强建议(指明文件) | 用户影响 | 工作量 |
|---|---|---|---|---|---|---|---|
| 高 | 项目过滤 | 侧边栏点击项目只 setActiveView('tasks')，不传项目 ID、不设任何项目过滤（app-sidebar.tsx L403-406）；任务页过滤栏无“项目”下拉（tasks-view.tsx L1946-1998）；filteredTasks 不检查 task.project（L400-411）；已保存筛选的 project 条件在 onApply 中被静默丢弃（L2021-2028） | Todoist/TickTick | 点击项目即显示该项目任务，可叠加“今天/未来7天”等智能列表 | app-sidebar.tsx L403-406 传 projectId；tasks-view.tsx 增加 activeProjectId 状态与项目下拉（L400-411 过滤、L1946-1998 下拉）；onApply 应用 c.project | 无项目聚焦入口，项目形同虚设 | 小 |
| 高 | 归档 | archiveTask 后任务仍显示在主列表/智能列表（tasks-view.tsx L400-411 与 smart-lists.ts L80-183 均不过滤 archived）；全应用无归档视图；唯一“取消归档”入口是归档 toast 的撤销按钮（tasks-view.tsx L1202） | TickTick/Things | 归档即从默认/智能列表隐藏，提供“归档”视图并可批量恢复/删除 | tasks-view.tsx L400-411 与 smart-lists.ts L80-183 各 filter 加 !t.archived；新增“归档”视图与侧边栏入口；上下文菜单加“取消归档”（L2486-2530） | 归档功能名存实亡，任务库无法收敛 | 中 |
| 高 | 重复任务提醒 | 完成重复任务滚动下一周期时不重置 reminders[].triggered（task-slice.ts L188-218），且 notified-registry 键 task-reminder-{id}-{rid} 不清理（use-auto-notifications.ts L49-50）——重复任务提醒仅第一个周期生效；on-due 提醒固定 09:00 与任务到期时分不一致（use-auto-notifications.ts L82-89） | TickTick/Todoist | 周期滚动时重置提醒“已触发”标记与通知键（按周期）；到时提醒取任务 dueDate 实际时分 | task-slice.ts L188-218 滚动时 map 重置 reminders.triggered 并调用 clearNotifiedKeysWithPrefix(任务id前缀)；use-auto-notifications.ts L82-89 去掉 setHours(9,0,0,0) 改用 dueDate 原时分；对应 L299-347 跳过逻辑 | 每天/每周重复任务提醒全失效，最常见场景 | 中 |
| 高 | NLP 时间解析 | “下午3点开会”被解析成 03:00 且“下午”残留标题（parseTime 先匹配 X点 再处理时段词，smart-input-enhanced.ts L190-215）；“晚上8点”得 08:00；无“今晚/明早/周末”短语；“下个月”按 +30 天处理非下月1日（L33） | Todoist/TickTick | 时段词与数字组合解析：下午/晚上 +12h；先剥离时段词再解析数字；补 今晚/明早/周末/后天 词表 | smart-input-enhanced.ts parseTime 重构（上午/下午/晚上+X点 组合正则并计算 12 小时制，再回落现有逻辑）；DATE_PATTERNS 增加词条 | 中文快速捕获核心体验：下午任务得到凌晨时间+脏标题 | 小 |
| 高 | NLP 重复/提醒/时间段 | 快速添加不解析重复规则（每天/每周一/每N天）、不解析提醒（提前15分钟提醒我）、不解析时间段（14:00-16:00 的 16:00 与 - 残留标题）；提示文案宣传“+项目A”但解析器只认 @（smart-input.ts L44 vs smart-input-enhanced.ts L91-96） | Todoist | “买牛奶 every day”“开会 14:00-15:00”“周五前提醒我”“+新项目自动建项目” | smart-input-enhanced.ts 扩展 ParsedTaskInput（repeat/reminders/endTime 字段已有类型支撑）；H:MM-H:MM 解析 endTime；每天/每周X/每N天 解析 repeat；+ 项目前缀与 @ 等价；修正 smart-input.ts L38-73 提示文案 | 快输入闭环缺失，Todoist 核心卖点 | 中 |
| 中 | 提醒后台可靠性 | 提醒仅靠渲染进程 60s setInterval（use-auto-notifications.ts L301），应用未打开/标签页被节流即丢失；触发窗口仅 5 分钟（L58-59、L71、L86），错过窗口永不再触发；Electron 无主进程调度（main.js 仅 notify IPC） | TickTick/Todoist/Things | 服务端或本地常驻调度；基于绝对时间的持久化“待触发队列”；打开时 catch-up 补发 | electron/main.js 新增主进程提醒调度（扫描 tasks reminders/工作时段）；渲染轮询改为“到期即触发”（diff<=0 且未 notified 即触发，去掉 ≥-5min 窗口）并页面加载立即 catch-up | 关闭应用=零提醒 | 大 |
| 中 | 重复规则能力 | 重复 UI 仅 每天/每周/每月/每年（tasks-view.tsx L1864-1868），无“每周一三五”、无“每N天/周”、无工作日/周末预设；自定义(custom) 与 daysOfWeek/dayOfMonth 字段存在但完成滚动 switch 无分支（task-slice.ts L173-186、L310-323，weekly 固定 +7 天忽略 daysOfWeek） | Todoist/TickTick | 自定义重复：按 daysOfWeek 逐周推进、按 interval 天推进、每月按 dayOfMonth | task-slice.ts L173-186/L310-323 switch 增加 custom/daysOfWeek/dayOfMonth 分支（可直接复用 repeatRules）；tasks-view.tsx 重复面板加“星期几多选”与“工作日/周末”预设 | 健身/学习类“每周一三五”重复无法表达 | 中 |
| 中 | 智能列表 | 缺“无日期(稍后)”与“本周”列表；今天列表把逾期重复任务用 lte 一并归入（smart-lists.ts L90-92），与“已逾期”边界混淆；列表不排除 archived | Todoist(无日期)/Things(Someday)/TickTick(未来7天) | 增加 no-date、this-week 智能列表；今天列表仅含到期日==今天，逾期重复任务归“已逾期” | smart-lists.ts L80-183 新增 filter；app-sidebar.tsx L222-261 listIconMap 注册新列表；今天列表改 equal | 无日期任务没有归属视图，无法“稍后处理” | 小 |
| 中 | 批量操作 | 批量条仅 完成/优先级/加标签/删除（batch-operations.tsx L96-177）；无批量改项目、批量改日期（store 已有 rescheduleOverdueTasks task-slice.ts L730-735 但无 UI）、无批量归档 | TickTick | 批量选择后支持 改日期/改项目/归档，底部条扩展菜单 | batch-operations.tsx 增加 项目/日期/归档 菜单；tasks-view.tsx 传入对应 handler（复用 updateTask 或新增 batch 方法） | 每周计划整理低效 | 小 |
| 中 | 排序与分组 | 列表固定按优先级分 4 卡（tasks-view.tsx L442-497），无“按日期/创建时间/项目”排序切换、无分组依据选择 | Todoist/TickTick | 排序下拉（日期升序/优先级/项目/创建时间）+ 分组（项目/日期/优先级）切换，手动排序仅作补充 | tasks-view.tsx 增加 sortBy 状态（L338 附近）作用于 groupedTasks（L442-464）；分组模式切换；与 taskOrder 互斥 | 长列表无法按到期日规划、无法按项目浏览 | 中 |
| 中 | 拖拽与排期 | 列表拖拽仅行内重排（HTML5 draggable L930-933）；无拖拽改期/拖到日期区/拖到项目（highlightedDate 只用于点击闪亮 L336/L840-845，无投放逻辑）；看板拖拽只改状态 | TickTick/Things/Google Tasks | 顶部“今天/明天/稍后”投放条；拖入项目树改项目；月视图投放改期 | tasks-view.tsx 顶部加投放条，onDrop 调 rescheduleTask（task-slice.ts L724-729）；app-sidebar.tsx 项目树作为投放目标，onDrop 调 updateTask({project}) | 快速排期是 GTD 高频操作 | 中 |
| 中 | 全局搜索 | 只搜 任务标题/描述/标签、习惯、纪念日、时间记录（global-search.tsx L32-54），不搜子任务/评论/项目实体/标签实体；每类 slice(0,5) 截断无“查看更多”；无搜索语法（p1、@项目、#标签、已完成） | Todoist/Microsoft To Do | 子任务与备注纳入索引；支持筛选符；Esc 关闭、Enter 首个结果 | global-search.tsx 扩展搜索范围与语法解析；lib/shortcuts.ts 增加 Ctrl+K 打开搜索（L316-329 附近） | 子任务/备注内容找不到 | 中 |
| 低 | 新建任务实体同步 | NLP “@新项目”直接写入 task.project 字符串，不自动创建 Project 实体（task-slice.ts L30-41 仅展开字段）；任务加标签不调 incrementTagUsage（tag-slice.ts L48，仅在 pomodoro-timer.tsx L53 调用），Tag usageCount 失真 | Todoist/TickTick | 添加任务时自动注册新项目/标签实体并递增计数 | task-slice.ts addTask 动态调用 store 的 addProject/addTag（参照 data-link-service.ts L18-22 动态导入模式）；tag-slice.ts 在 addTask 后自动 incrementTagUsage | 孤儿项目名、标签统计不准 | 小 |
| 低 | 子任务能力 | 子任务无 优先级/提醒/能量/评论；convertSubTaskToTask 丢失 reminders/energy/notes（task-slice.ts L558-588 仅复制 title/priority/project/tags/dueDate）；子任务全部完成后不提示完成父任务 | Things 3/Microsoft To Do | 子任务可选提醒与优先级；转换时复制完整字段；全部完成时提供“完成父任务”联动 | lib/types.ts SubTask L1-7 扩展字段；task-slice.ts L558-588 复制提醒/备注；tasks-view.tsx 子任务区加提醒入口（复用 task-reminders.tsx 受控模式） | 复杂任务拆分后无法独立排期提醒 | 中 |

## 四、发现的隐患与问题（含行号）

1. **重复任务提醒只触发一次（高）**：完成任务滚动周期时 task-slice.ts L188-218 未重置 reminders[].triggered，use-auto-notifications.ts L48 直接跳过 triggered 提醒；notified 键 L49-50 亦不清除。每天/每周重复任务仅首次提醒。
2. **on-due 提醒固定 09:00（中）**：use-auto-notifications.ts L82-89 对 on-due 强制 setHours(9,0,0,0)，而任务到期时分存于 dueDate（tasks-view.tsx L618-624），造成“到时提醒”9 点触发而非任务设定时刻；before-due 用真实时分（L67-71），两条路径不一致。
3. **中文“下午/晚上+X点”解析错误（高）**：smart-input-enhanced.ts L190-197 先匹配 X点 得 03:00/08:00，时段词分支（L200-215）被提前 return 短路，“下午/晚上”残留进标题；L33 “下个月”按 +30 天计算而非下月1日。
4. **“周X”当天解析歧义（低）**：smart-input-enhanced.ts L143-144 daysUntil === 0 ? 7 : daysUntil，当天即目标星期时给“下周同日”而非今天。
5. **归档无视图、列表不过滤（高）**：tasks-view.tsx L400-411 与 smart-lists.ts L80-183 均不排除 archived；unarchiveTask 仅经 toast（tasks-view.tsx L1202）与 store（L83-88）存在，全组件无归档列表视图。
6. **项目筛选全链路失效（高）**：app-sidebar.tsx ProjectTree onSelect（L403-406）仅切视图；tasks-view.tsx 无项目过滤状态/下拉（L400-411、L1946-1998），onApply（L2021-2028）忽略 criteria.project——保存带项目条件的筛选后应用无效。
7. **taskOrder 残留与全局共享（低）**：deleteTask/batchDeleteTasks（task-slice.ts L48-70/L445-478）不清理 taskOrder 中的已删 id；taskOrder 为全局单序，切换智能列表后可能造成排序错乱。
8. **custom/每周多日重复无推进分支（中）**：task-slice.ts L173-186、L310-323 的 switch 无 custom 分支（也无 default），RepeatRule.type='custom' 任务完成后 dueDate 不再推进，重复中断；daysOfWeek 语义在 weekly 分支被忽略。
9. **标签计数失真（低）**：incrementTagUsage 仅 pomodoro-timer.tsx L53 调用，任务创建/加标签不计数，Tag usageCount 不代表真实使用（影响标签排序与云同步权重）。
10. **逾期/到期通知按日绑定且无跨日补发（中）**：use-auto-notifications.ts L119-123 的键含 today.toDateString()，跨日刷新（refreshRepeatTasks L404-433）不重置提醒 triggered，且错过当日轮询后当天提醒不再补发。

## 五、本模块已有亮点

1. **完整的依赖系统双向维护**：添加依赖自动同步 dependsOn/blockedBy，删除任务级联清理双向引用，完成前置校验（task-slice.ts L94-117、L605-654），并有依赖关系图组件（task-dependency-graph.tsx）——优于多数同类应用。
2. **看板 WIP 限制 + 拖拽改状态**（tasks-view.tsx L210-233、L516-558）：列级 WIP 上限、越界 toast、拖拽跨列完成流转，敏捷实践已落地。
3. **四象限艾森豪威尔矩阵视图**（tasks-view.tsx L474-497、L2175-2286）：紧急×重要四象限一键切换，规划视角丰富。
4. **多提醒模型**：3 种提醒类型（绝对/相对截止/到时）+ 7 档预设 + 每条独立开关（task-reminders.tsx L18-26、L156-235），配合 notified-registry 跨会话去重（use-auto-notifications.ts L49-50）。
5. **重复任务滚动策略成熟**：以 max(原始到期日, 今天) 为基准推进（task-slice.ts L170-172）、跳过/暂停/恢复/每日补刷新（L299-433）、完成历史可回溯（uncompleteTask L245-298 回滚上一周期）。
6. **任务-专注-目标-积分数据联动**：data-link-service.ts 完成事件+增量入账+去重映射（L86-120），完成重复任务也会触发（task-slice.ts L163、L219）。
7. **删除即回收站+可撤销**：软删除入 trashedItems（task-slice.ts L65-68）+ toast 撤销（tasks-view.tsx L1216-1226）+ 回收站批量恢复/清空（trash-slice.ts L70-196）。
8. **智能列表性能处理**：smart-lists.ts L40-60 useShallow + 60s 跨日检测；getSmartListTasks useCallback 稳定引用（L192-198），避免大列表重渲染。
9. **NLP 输入三层反馈**：实时解析预览+校验警告+关键词建议 chips（smart-quick-add-task.tsx L117-197），QuickAddTask/QuickCapture/任务弹窗共用同一解析实现（quick-add-task.tsx L12-16、tasks-view.tsx L1604-1625）。

---
*报告基于代码实证：components/views/tasks-view.tsx、lib/smart-input-enhanced.ts、lib/smart-input.ts、lib/smart-lists.ts、lib/store/slices/task-slice.ts、lib/use-auto-notifications.ts、components/app-sidebar.tsx、components/batch-operations.tsx、components/task-reminders.tsx、components/saved-filters-bar.tsx、components/global-search.tsx、components/quick-date-presets.tsx、lib/types.ts、lib/store/types.ts、lib/data-link-service.ts、lib/store/slices/tag-slice.ts、lib/store/slices/trash-slice.ts 等。*