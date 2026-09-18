# 习惯与目标 —— 对标成熟软件排查报告

> 模块范围：习惯（新增/打卡/频率/连续/冻结/批量补卡/提醒/统计）与目标（里程碑/量化/关联任务与习惯/进度/成就/游戏化/庆祝）。
> 本报告全部结论均基于实际读取的源码文件（标注路径与行号），未读取 node_modules/.next/build 等编译产物。

## 一、对标产品

- **Habitica**（习惯 RPG 化：经验/等级/金币/装备、成就、习惯难度与打卡反馈、连胜与惩罚）
- **Strides**（目标追踪：习惯频率按『每周 N 次/特定星期』计算连胜与完成率、最佳记录、目标分解为可量化指标+提醒）
- **Streaks**（习惯链式打卡：只统计『应打卡日』的连续天、冻结补卡、历史日历、多提醒）
- **TickTick 滴答清单**（习惯库/模板、每日多次提醒、补打卡、周月习惯统计、习惯与任务并排视图）
- **小日常**（习惯统计年度热力图、打卡心情备注、成就与连续天数）
- **Notion / Google Calendar**（目标时间线、里程碑截止日期、到期提醒）

## 二、现状能力盘点（真实读到的功能）

| # | 能力 | 文件位置（路径:行号） |
|---|------|------------------------|
| 1 | 习惯 CRUD、编辑弹窗：名称/图标/颜色/分类/频率/提醒时间/打卡式与量化式切换 | components/views/habits-view.tsx:80-154、232-454；lib/store/slices/habit-slice.ts:17-55 |
| 2 | 频率模型：daily/weekly/monthly/custom（星期模式 weeklyPattern、每 N 天 intervalDays） | lib/types.ts:155-176；lib/habit-frequency.ts:6-53 |
| 3 | 打卡入 store：今日打卡、streak 步进计算、连续第 7/14/21/30/60/100 天成就通知 | lib/store/slices/habit-slice.ts:56-132 |
| 4 | 连续冻结保护（固定作用于『昨天』，每习惯上限 3 次） | lib/store/slices/habit-slice.ts:133-178；UI 入口 habits-view.tsx:896-907 |
| 5 | 批量补卡（昨天/最近 3/7/14 天预设 + 多习惯多选 + 自动去重） | components/habit-batch-checkin.tsx:34-205；habit-slice.ts:179-208 |
| 6 | 习惯视图：今日完成/最长连续/平均完成率统计卡、30 天日历网格、15 周热力图、周完成率柱状图、分类饼图、30 天趋势折线 | habits-view.tsx:458-824 |
| 7 | 单习惯卡片：连续天数、冻结徽标、30 天完成率、最近 14 天迷你条 | habits-view.tsx:843-1055；lib/hooks.ts:278-353 |
| 8 | 习惯提醒（单次固定时间，浏览器通知，60s 轮询） | lib/use-auto-notifications.ts:176-205 |
| 9 | 习惯与目标关联：goal.linkedHabits + habit.linkedGoalId 双向写入；任务关联 goal.linkedTasks | components/views/goals-view.tsx:504-628；lib/data-link-service.ts:441-489 |
| 10 | 目标 CRUD：类型(年/季/月/周)/分类/状态流转/目标值+单位/起止日期；未开始/进行中/已完成/已暂停分组 Tab | components/views/goals-view.tsx:89-173、175-249、661-972；lib/store/slices/goal-slice.ts:10-94 |
| 11 | 里程碑：添加/勾选/删除/拖拽排序（dnd-kit）；完成度进度条 | goals-view.tsx:257-329、437-502 |
| 12 | 目标进度自动重算：任务完成率与里程碑完成率取平均；100% 时加 50 点并通知 | lib/data-link-service.ts:275-312 |
| 13 | 习惯→目标贡献测算函数与习惯健康度统计（30 天贡献率/平均连胜/完成率） | lib/habit-goal-integration.ts:104-285 |
| 14 | 游戏化：20 级经验曲线+称号、成就定义与评估（专注/任务/习惯/连续/特殊 5 类 21 项）、经验=金币、经验计算 | lib/gamification.ts:20-99、102-217、361-388；lib/store/slices/achievement-slice.ts:8-59 |
| 15 | 成就墙：解锁统计卡、等级显示、分类展示、未解锁进度条、已解锁日期 | components/achievements-wall.tsx:65-295 |
| 16 | 每日专注目标达成庆祝弹窗（星效动画），仅一次/天 localStorage 去重 | components/goal-celebration.tsx:23-117；lib/hooks/use-daily-goal.ts:11-62；dashboard-view.tsx:591-595 |
| 17 | 仪表盘：今日习惯快捷打卡列表、习惯进度条、专注目标环 | components/views/dashboard-view.tsx:106-120、540-587 |
| 18 | 统计页：按习惯真实频率计算的周完成率、习惯周趋势图（8 周） | components/views/analytics-view.tsx:240-250、360-377 |
| 19 | 安卓端习惯小组件（只读展示 done/total + 进度条） | android-app/android/app/src/main/java/com/focusflow/app/widgets/HabitWidgetProvider.java:22-33 |
| 20 | 数据迁移：旧版习惯补齐 trackingType/targetValue/streakFreezes 等字段 | lib/store/index.ts:293-356 |

## 三、需要增强与优化的功能

| 优先级 | 领域 | 差距描述 | 对标产品 | 成熟做法参考 | 增强建议（指明文件） | 用户影响 | 工作量 |
|--------|------|----------|----------|--------------|----------------------|----------|--------|
| 高 | 频率模型 | 『每周』习惯没有『每周 N 次』目标（Habit.frequency=weekly 时 isHabitScheduledOn 恒为 true，实际等价『每天』）；『每月』类型存在但新增弹窗无入口，无法从 UI 创建 | Strides、Habitica、TickTick | 支持『每周 1~7 次任意日完成』与『每月 N 次』，完成率/连胜按周期目标计算 | lib/types.ts:155-176 增加 weeklyTarget/monthlyTarget 字段；lib/habit-frequency.ts:6-30 按周期目标判定应做日；habits-view.tsx:368-434 频率选择加入『每周N次/每月N次』选项 | 用户无法表达『每周跑步3次』这类最常见习惯约束 | 中 |
| 高 | 连胜算法 | 连胜按**连续自然日**计算（lib/hooks.ts:304-320、habit-slice.ts:64-79、habit-goal-integration.ts:165-185），非每日习惯（如每周一/三/五）在休息日无记录即断链，用户永远拿不到 >1 的连胜；且无『最佳纪录』统计 | Streaks、Strides、小日常 | streak 只对『应打卡日』计数（跳过休息日）；保存 bestStreak；断链后显示历史最佳 | 抽取 lib/habit-streak.ts 统一计算（调度感知），替换 4 处重复实现；Habit 增加 bestStreak 字段；卡片展示最佳纪录 | 非每日习惯用户反馈『连续天数永远 1 天』，核心激励失效 | 中 |
| 高 | 目标联动 | 习惯→目标进度链路断裂：UI 关联只写 goal.linkedHabits（data-link-service.ts:463-474），而 habit-slice 调用的 HabitGoalIntegration 读自己私有 localStorage 注册表 focusflow-habit-goal-links（habit-goal-integration.ts:19-47）——该表无人写入；且 data-link-service.ts:275-312 的进度公式只含任务+里程碑，习惯贡献被覆盖丢失 | Strides、Habitica | 单一数据源：用 goal.linkedHabits 作为唯一注册表；习惯完成时把『应打卡日完成率』计入目标进度（与任务/里程碑加权） | 统一到 data-link-service.ts:275-312：进度=(任务完成率×权重+里程碑×权重+习惯调度完成率×权重)/Σ权重；删除或并轨 habit-goal-integration.ts 的 localStorage 注册表 | 关联了习惯的目标进度不会随打卡增长，用户以为功能坏了 | 高（需小重构） |
| 高 | 成就触发与显示 | 成就检查只在番茄钟完成时调用（data-link-service.ts:166、pomodoro-completion.ts:85-86），习惯打卡、任务完成、目标达成均不触发 checkAchievementsNow → 习惯类成就（如连续30天）几乎无法在打卡时解锁 | Habitica（任何动作即时发成就）、小日常 | 在 checkInHabit/handleHabitCheck、handleTaskCompletion、目标完成路径统一调用 state.checkAchievements() | habit-slice.ts:127-131、data-link-service.ts:86-138 与 197-251 追加 checkAchievements 调用 | 成就解锁滞后/不可达，破坏即时反馈 | 低 |
| 中 | 游戏化体系 | 金币=经验别名（gamification.ts:238 coins: experience），无消费/装备/奖励兑换；userLevel.totalPoints（state 持久化）与 gameProgress.experience（用量计算）双轨不一致（习惯打卡不加 points，见 data-link-service.ts:197-251 无 addPoints）；升等级无动画/弹窗 | Habitica（金币购买装备）、番茄ToDo（金币兑换商店） | 建立统一积分入账路径；习惯打卡/里程碑完成发放积分；等级提升全屏庆祝；可选『奖励兑换』（金币换自由时间/奖励） | gamification.ts 统一 addPoints 调用点；data-link-service.ts handleHabitCheck 加分；新增 components/level-up-modal.tsx 并检测等级变化 | 数值体系缺乏用途，玩家没有『花金币』动机，留存低 | 中 |
| 中 | 习惯提醒 | 提醒仅一个固定时间（types.ts:166 reminderTime）；非应打卡日也会提醒（use-auto-notifications.ts:176-205 未判断 isHabitScheduledOn）；补打卡提醒可选性不足 | TickTick（每日多次提醒）、Streaks（提醒+补签通知） | 支持每习惯多提醒、非排班日跳过、提醒文案含频率信息；Electron 桌面端弹系统通知 | use-auto-notifications.ts:176-205 增加 isHabitScheduledOn 判断与多时间表；types.ts 增加 reminderTimes: string[] | 用户在休息日被无意义提醒轰炸 | 低 |
| 中 | 模板/预设 | 无习惯模板库/预设（任务有 task-templates.tsx）；NLP 快速添加只解析任务（lib/smart-input-enhanced.ts:3-13 ParsedTaskInput 无习惯/目标字段） | TickTick 习惯库、Habitica 习惯建议 | 提供内置习惯模板（健身/阅读/冥想等分类导入）；smart-input 支持『每天跑步/每周3次读书』解析为习惯 | 新建 lib/habit-templates.ts + components/habit-template-dialog.tsx；smart-input-enhanced.ts 增加 habit 分支；习惯弹窗加『从模板选择』 | 新用户无从下手，建立习惯成本高 | 中 |
| 中 | 习惯管理 | 没有『归档/暂停/重启』操作（Habit.archived 字段存在但视图无入口，habits-view.tsx 仅删除+编辑）；习惯列表固定顺序、不可拖拽排序（无 dnd 库引入） | Habitica（暂停/复活）、Streaks（暂停）、滴答清单（归档） | 卡片/菜单提供『归档（隐藏）、暂停（冻结连胜可选）』；列表支持拖拽排序 | habits-view.tsx 增加操作菜单 + useSortable；habit-slice.ts 增加 archiveHabit/pauseHabit | 长期习惯无法暂停，只能删除历史 | 低 |
| 高 | 目标提醒 | 目标无截止/进度提醒：Reminder 支持 type:goal（types.ts:310-321）但 use-auto-notifications.ts 无任何 goal 处理；截止日自动设置为 new Date()（goals-view.tsx:185 空截止→今天→立即『已过期』） | Notion、Google Calendar、Strides | 目标创建时校验截止日期（无则按类型默认季度末）；截止前 7/3/1 天提醒、进度≥75% 提醒；到期自动移到『已过期』状态 | goals-view.tsx:175-190 截止日期必填校验；use-auto-notifications.ts 增加 goal-due 检查分支 | 用户经常错过目标截止，目标沦为静态清单 | 中 |
| 中 | 目标量化 | targetValue/currentValue 不自动联动：完成任务/习惯不累加 currentValue，进度计算只看里程碑/任务比例（goals-view.tsx:245-249），『读12本书→完成5本』这类目标无法自动推进 | Strides（目标量化+自动记录）、Habitica | 链接任务/习惯完成时按单位增量累加 currentValue；进度=(currentValue/targetValue)×100 与里程碑加权 | data-link-service.ts:275-312 增加 targetValue 分支；goal-slice.ts addGoal/updateGoal 校验 | 数值型目标进度永远靠手改，追踪失效 | 中 |
| 中 | 目标时间线 | 无目标时间线/甘特视图、里程碑无截止日期输入（addMilestone 仅 title+completed，goals-view.tsx:239-243；types.ts:235-241 dueDate 字段闲置）、无延误目标高亮 | Notion 时间线、Google Calendar、Strides | 里程碑支持截止日期+逾期红色提示；目标卡片显示时间线缩略图；『目标日历』视图把里程碑截止投放到日历 | goals-view.tsx:239-243 增加 dueDate 输入；Milestone 逾期样式；calendar-view 接入目标里程碑 | 复杂目标缺乏进度可视化和节奏感 | 中 |
| 低 | 打卡体验 | 量化打卡输入语义混（输入值=总量，按钮=+1 累加，habits-view.tsx:993-1020：今天已2再输3会覆盖成3而非达到5）；打卡无备注输入（HabitCheckIn.note 字段存在但 UI 无入口，仅冻结/补卡自动填充） | 小日常（打卡可写心情）、滴答清单（打卡备注） | 输入框注明『本次数值（累加）』并提供 ± 步进按钮；打卡弹窗可带备注 | habits-view.tsx:991-1050 调整为累加语义；HabitCard 增加备注小弹窗 | 量化习惯记录出错、无当日心得留存 | 低 |

## 四、发现的隐患与问题

1. **目标进度被两个公式互相覆盖**：data-link-service.ts:275-312（任务+里程碑平均）与 habit-goal-integration.ts:104-137（习惯 30 天贡献率逐次累加）都对同一 goal.progress 写值，其中一种触发即覆盖另一种；且后者每次打卡『贡献率×权重×10』是增量累加而非重算，打卡频次越高进度涨得越快（上限 100 封顶）——进度不可复现、不可审计。
2. **成就体系两套并存**：habit-slice.ts:81-88 内联的连续天数通知（7/14/21/30/60/100）与 gamification.ts:63-99 的 habit-streak-7/30/100 成就墙是重复的两套机制；且后者只在番茄完成后评估（见三），连续天数通知又只发 notification 不入成就墙，用户会看到『已庆祝』却未解锁徽章。
3. **等级阈值常量双处复制**：gamification.ts:20-23 与 achievement-slice.ts:9-12 各有一份 LEVEL_THRESHOLDS（数值相同但互不引用），后续调平衡会漂移；称号数组也有两份（gamification.ts:25-30 / achievement-slice.ts:14-19）内容略有差异，同一等级可能显示不同称号。
4. **统计口径错误**：analytics-view.tsx:373 习惯周趋势分母为 activeHabits×7，未考虑排班（每周一三五一习惯的完成率最高只能显示约 6%）；analytics-view.tsx:249-250 只统计 completed 记录数除以排班天数，未排除冻结补卡产生的『假完成』记录（habit-slice.ts:153-158 冻结会写 completed:true）。habits-view.tsx:326-334 的 30 天完成率同样忽略排班与冻结。
5. **目标创建缺陷**：goals-view.tsx:185 未填截止日期时 endDate 取 new Date()，新目标当天就显示『已过期』（goals-view.tsx:381）；手动点『完成』（goals-view.tsx:641-652）直接 updateGoal 置 status/progress，不触发 data-link-service.ts:298-311 的加 50 分与达成通知——手动完成的反馈与自动完成不一致。
6. **冻结保护语义与数据污染**：habit-slice.ts:133-178 冻结固定作用于『昨天』，若昨天是休息日则产生一条多余的 completed 记录（污染完成率/热力图）；冻结次数只增不减、无周期重置（默认 3 次永久）。
7. **打卡性能**：streak/完成率在 hooks.ts:304-334、habit-slice.ts:56-79 均对全部 habitCheckIns 逐个 find（O(n)），习惯数量与历史增多后，每次打卡与渲染耗时会线性上升；建议按 habitId 建索引 Map。
8. **非排班日仍可打卡/不可区分**：日历网格只有今天可点（habits-view.tsx:674-677），历史日期上『休息日』与『应做日』外观相同（同灰），用户无法一眼区分漏打卡与休息日；仪表盘快捷列表（dashboard-view.tsx:109-117）也不过滤排班，休息日习惯会显示为『待打卡』。

## 五、本模块已有亮点

- **可视化完整**：30 天日历网格 + 15 周 GitHub 式热力图 + 周柱状图 + 分类饼图 + 30 天趋势，习惯统计维度超过了多数桌面工具（habits-view.tsx:616-824）。
- **频率自定义较强**：星期模式与『每 N 天』两种自定义频率已有实现并被统计页正确用于排班计数（lib/habit-frequency.ts:17-26；analytics-view.tsx:240-250）。
- **里程碑拖拽排序**：dnd-kit 实现，交互完成度高（goals-view.tsx:472-501）。
- **批量补卡+回收站撤销**：预设范围、多选、自动去重，删除习惯走回收站可撤销（habit-batch-checkin.tsx:86-99；habit-slice.ts:50-53）。
- **关联系统设计初衷好**：任务/习惯双向关联目标并自动重算进度（data-link-service.ts:86-138、275-312），意图对标 Strides/Habitica，主要问题是注册表分裂与触发点不全（见三/四）。
- **成就体系分级展示**：tier（bronze/silver/gold/platinum）+ 未解锁进度条 + 解锁日期，结构可扩展（achievements-wall.tsx:34-63、216-272）。
- **数据兼容迁移**：版本化迁移补齐习惯量化/冻结字段（lib/store/index.ts:293-356），对已有用户升级友好。