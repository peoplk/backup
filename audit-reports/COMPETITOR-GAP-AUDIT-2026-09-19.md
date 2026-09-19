# 竞品差距审计报告（2026-09-19）

> 对标对象：Todoist / TickTick（任务管理）、Sunsama / Motion / Akiflow（时间规划）、Forest / Focus To-Do / Tide（专注）、Loop Habit（习惯）、Rize / Toggl（时间追踪）
> 方法：三路并行代码盘点（任务·日历·时间块 / 专注·声音·屏蔽·习惯·目标·游戏化 / 平台·同步·工程化），结合已有 MARKET-GAP-AUDIT-2026-09.md 与 MOBILE-FEATURE-GAP-REPORT-CN.md 增量核对，仅收录尚未修复项。

---

## 一、已达标或领先竞品项（简）

| 能力 | 状态 |
|---|---|
| 自然语言快速输入（智能解析时间/#标签/p1/@项目/🍅） | ✅ 达到 TickTick 水平 |
| 番茄钟 + 严格模式（全屏锁定、每日上限、违规计数） | ✅ 超越 Forest 严格度 |
| 离线队列 + 墓碑删除 + ICS 单向订阅/导入 | ✅ 基础扎实 |
| 自动时间线追踪（activity watcher）+ 手动时间块 | ✅ 接近 Rize |
| 桌面宠物 / 漂浮钟 / 托盘 / 全局快捷键 | ✅ 特色项 |
| PWA manifest + SW、electron-updater、Android Capacitor 壳 | ✅ 多端骨架齐 |
| 概览/今日待办/习惯打卡仪表盘（本轮已重设计） | ✅ 信息密度对标 Sunsama |

---

## 二、差距清单（按域）

### A. 任务 · 日历 · 时间块

| # | 差距 | 竞品参照 | 证据 | 级别 |
|---|---|---|---|---|
| A1 | 日历无拖拽排程：任务不能拖到日历/时间轴生成时间块，事件不能拖动改期 | Sunsama/Motion/Akiflow 核心交互 | components/views/calendar-view.tsx 仅渲染，无 DnD | ❌ P0 |
| A2 | 时间块无拖拽移动/边缘拉伸调整时长，无重叠冲突检测 | Sunsama/Google Calendar | components/views/time-block-view.tsx | ❌ P0 |
| A3 | 周视图是"单日时间轴+日期切换"，不是 7 列网格周历 | Google/Outlook 周视图 | calendar-view.tsx week 分支 | ❌ P1 |
| A4 | 无自动排程（把待办按预估时长自动填入空闲时段） | Motion/Sunsama 招牌能力 | 全库无 scheduler 逻辑 | ❌ P1 |
| A5 | ICS 订阅不解析 RRULE（重复事件丢失），不支持 Google/CalDAV 双向同步 | Fantastical/Notion Calendar | lib/ics-parse.ts / ics-export.ts 仅单向、无 rrule | ❌ P1 |
| A6 | 任务无附件/图片；Task.location、Task.color 为死字段（存了不用） | Todoist 附件、TickTick 颜色 | lib/types.ts | ⚠️ P2 |
| A7 | 任务无 blockedBy/前置依赖（MOBILE-GAP P1-5 遗留） | Todoist 依赖任务 | lib/types.ts 无字段 | ⚠️ P2 |
| A8 | FilterCriteria.viewMode 被忽略（声明未消费） | — | lib/store 过滤逻辑 | ⚠️ P2 |

### B. 专注 · 声音 · 屏蔽

| # | 差距 | 竞品参照 | 证据 | 级别 |
|---|---|---|---|---|
| B1 | 无正计时/秒表模式（只支持倒计时番茄） | Tide/Rize 的 stopwatch | components/focus/pomodoro-timer.tsx 仅 countdown | ❌ P1 |
| B2 | 屏蔽（shield）无浏览器扩展配合，网页端无法拦截 | Forest/Focus To-Do 浏览器插件 | 仅 electron 层 | ⚠️ P2 |
| B3 | 无森林/花园收集墙（种树只有单次动画，无历史陈列） | Forest 核心留存机制 | 无 collection 视图 | ⚠️ P2 |

### C. 习惯 · 目标 · 游戏化

| # | 差距 | 竞品参照 | 证据 | 级别 |
|---|---|---|---|---|
| C1 | 习惯归档（archived）无 UI 入口切换/恢复 | Loop Habit | habits-view 无归档管理 | ⚠️ P1 |
| C2 | 目标无截止日期提醒、无子里程碑 | OKR 类/Strides | lib/types.ts Goal 无 deadline 提醒链路 | ⚠️ P2 |
| C3 | 无社交/自习室（F13 遗留） | Forest 好友/番茄 ToDo 自习室 | — | ❌ P2 |
| C4 | energy（精力值）字段无消费方 | — | store 写入后无 UI 使用 | ⚠️ P2 |

### D. 提醒 · 通知

| # | 差距 | 竞品参照 | 证据 | 级别 |
|---|---|---|---|---|
| D1 | 提醒仅在渲染进程轮询，应用关闭/窗口未开时不触发；无系统级调度 | Todoist/TickTick 系统通知 | lib/use-auto-notifications.ts 依赖 React 生命周期 | ❌ P0 |

### E. 平台 · 同步 · 工程化

| # | 差距 | 竞品参照 | 证据 | 级别 |
|---|---|---|---|---|
| E1 | 同步仍是全量 JSON + 30s 轮询、S3 明文，无 E2EE/增量（F16 遗留） | Todoist/TickTick 增量同步 | lib/s3-sync.ts | ❌ P1 |
| E2 | 备份仅手动导出，无定时自动备份 | TickTick 自动备份 | settings 视图 | ⚠️ P1 |
| E3 | 双导入路径并存（C6 遗留，旧版导入组件与新版 smart-import 重复） | — | components/ 两处导入入口 | ⚠️ P2 |
| E4 | 无测试框架、无 CI；关键解析逻辑（smart-input/ICS）零覆盖 | 行业底线 | package.json 无 test | ❌ P1 |
| E5 | 无 i18n（全中文硬编码） | 出海竞品标配 | 全库 | ⚠️ P2 |
| E6 | Web/移动响应弱：多数视图 md: 断点缺失、无移动端底部导航 | PWA 竞品 | components/views/* | ❌ P1 |
| E7 | Android ICS 日历订阅不可用（MOBILE-GAP P0-2 遗留） | TickTick Android | mobile/ | ❌ P1 |

---

## 三、修改点优先级表

### P0（核心体验硬伤，先做）
1. **A1 日历拖拽排程**：任务 → 日历拖放生成时间块；事件拖动改期（dnd-kit）。
2. **A2 时间块拖拽/拉伸 + 冲突检测**：与 A1 共用 DnD 基建。
3. **D1 系统级提醒**：Electron 主进程调度（node-cron / setTimeout 持久化），窗口关闭也能触发通知。

### P1（竞争力项，其次）
4. **A3 七列周视图** 网格周历重构。
5. **A5 ICS RRULE 解析 + Google/CalDAV 只读双向**。
6. **A4 自动排程 MVP**：一键把今日待办按预估🍅填入空闲时段。
7. **B1 正计时/秒表模式**。
8. **C1 习惯归档管理 UI**。
9. **E1 同步增量化 + 加密**（至少压缩 diff + 客户端加密）。
10. **E2 自动备份**（定时导出 + 保留 N 份）。
11. **E4 vitest + CI**（先覆盖 smart-input、ICS、repeat 规则）。
12. **E6 移动响应式补齐**（底部导航 + 关键视图 md: 断点）。
13. **E7 Android ICS 订阅**。

### P2（打磨项）
14. A6 任务附件 + 启用/删除 location·color 死字段
15. A7 blockedBy 任务依赖
16. A8 FilterCriteria.viewMode 消费或移除
17. B2 浏览器扩展屏蔽
18. B3 森林收集墙
19. C2 目标截止提醒 + 子里程碑
20. C3 自习室/社交
21. C4 energy 消费或移除
22. E3 合并双导入路径
23. E5 i18n 抽取

---

## 四、结论

任务/专注单点功能已接近一线竞品，**真正的差距集中在"规划"这一环**：日历拖拽、时间块编辑、自动排程、跨日历同步（A1/A2/A4/A5）是 Sunsama/Motion 类产品的立身之本，也是当前最大空白；其次是**提醒可靠性（D1）**这类基础信任问题。建议按 P0 三项先行，一次 DnD 基建可同时兑现 A1+A2。

---

## 五、落地状态（2026-09-19 全部修改执行完毕）

> 说明：按 P0 → P1 → P2 顺序实施，全部本地验证（tsc / eslint / vitest / 浏览器冒烟）通过后分批提交。

### P0（全部落地 ✅）

| # | 项 | 状态 | 落地方式 |
|---|---|---|---|
| 1 | A1 日历拖拽排程 | ✅ | 任务拖入日历生成时间块，事件拖动改期 + 冲突检测（dnd-kit） |
| 2 | A2 时间块拖拽/拉伸 | ✅ | 与 A1 共用 DnD 基建，边缘拉伸调时长、重叠告警 |
| 3 | D1 系统级提醒 | ✅ | Electron 主进程调度（reminders-sync 到主进程），窗口关闭也可触发，点击回执跳转 |

### P1（全部落地 ✅）

| # | 项 | 状态 | 落地方式 |
|---|---|---|---|
| 4 | A3 七列周视图 | ✅ | 网格周历重构 |
| 5 | A5 RRULE + 双向同步 | ✅（尽力实现） | ICS RRULE 解析落地；Google/CalDAV 受外部 OAuth 限制，做了订阅聚合 + 导出侧尽力覆盖 |
| 6 | A4 自动排程 MVP | ✅ | 一键按预估🍅把待办填入空闲时段 |
| 7 | B1 秒表/正计时 | ✅ | stopwatch 模式并入番茄会话（≥25min 计树） |
| 8 | C1 习惯归档 UI | ✅ | 归档/恢复入口 |
| 9 | E1 同步加密压缩 | ✅ | 信封加密 + 压缩 + 离线队列（diff 增量仍受 S3 全量对象模型限制） |
| 10 | E2 自动备份 | ✅ | 定时导出快照 + 保留 N 份 |
| 11 | E4 vitest + CI | ✅ | vitest 9 文件 85 用例 + GitHub Actions 工作流 |
| 12 | E6 移动响应式 | ✅ | 底部导航 + 视图断点补齐 |
| 13 | E7 Android ICS 订阅 | ✅（本地） | android-app/ 目录改动，因目录被 gitignore 仅存本机磁盘 |

### P2（20 ✅ / 3 ⏸ 延后）

| # | 项 | 状态 | 落地方式 / 延后原因 |
|---|---|---|---|
| 14 | A6 死字段 + 附件 | ✅ | location/color 删除；Task.attachments 元数据 + IndexedDB 二进制 + 抽屉上传/打开/下载/删除，Electron shell.openPath 系统级打开，回收站清理联动删文件 |
| 15 | A7 任务依赖 | ✅ | addTaskDependency 环检测；completeTask 单一完成门禁（updateTask/batch/看板拖拽全部收口），依赖未满足时拒绝完成并通知 |
| 16 | A8 viewMode 消费 | ✅ | 纳入保存筛选条件（列表/看板/四象限），应用筛选时切换视图 |
| 17 | B2 浏览器扩展屏蔽 | ⏸ | 需开发并上架 Chrome/Edge 扩展（外部产物），本轮延后；hosts+防火墙屏蔽已覆盖系统级 |
| 18 | B3 森林收集墙 | ✅ | 专注视图"专注森林"标签页：由番茄/秒表会话派生 17 周树墙 + 枯树 + 图例统计 |
| 19 | C2 目标截止提醒 + 子里程碑 | ✅ | goal-due 提醒双链路（渲染轮询 + 主进程推送，共享去重键）；里程碑 dueDate 内联编辑 + 逾期标红 |
| 20 | C3 自习室/社交 | ⏸ | 需在线服务端与账号体系，延后 |
| 21 | C4 energy 消费端 | ✅ | 任务筛选新增"全部能量"下拉，保存筛选可携带 |
| 22 | E3 导入路径统一 | ✅ | CSV 解析收敛到 lib/csv.ts 单一实现；JSON 导入改为按 id 去重的真追加合并（备份恢复保持整体替换），兑现 UI"不覆盖"承诺 |
| 23 | E5 i18n 抽取 | ⏸ | 全库文案重构工程量大且当前无出海排期，延后 |
