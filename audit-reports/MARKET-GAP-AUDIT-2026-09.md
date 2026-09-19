# 对标市面同类软件的功能与代码差距排查（2026-09）

对标对象：Toggl Track（时间记录/报表）、Rize / ActivityWatch（自动追踪与洞察）、
TickTick / Todoist（任务与日历）、Forest / Motion（专注激励与自动排程）。

结论概览：FocusFlow 在「单机闭环」上已达到或超过多数竞品（严格模式 kiosk 锁定、
hosts+进程双屏蔽、游戏化、AI 任务解析、离线队列同步均为竞品不具备或仅付费云端具备）。
差距集中在三类：**数据完整性（时间记录不可编辑）**、**自动追踪深度（弱于 Rize/ActivityWatch）**、
**生态与移动端（无双向日历、无浏览器端、双实现漂移）**。

---

## 一、功能缺失（按域）

### 1. 时间记录 —— 对标 Toggl Track / Rize
- **F1（P0）时间条目不可编辑/删除**：桌面 store 无 `updateTimeEntry` / `deleteTimeEntry`，
  记错时长无法修正；Android store 反而有 → 双实现漂移。Toggl 全部条目可改可删可移动。
- **F2 费率与账单**：无 hourly rate / billable 标记 / 按客户汇总，无法替代 Toggl 的工作计价场景。
- **F3 保留期与清理策略**：自动时间线仅 14 天 / 64 应用硬编码，设置中无数据保留期选项。
- **F4 报表形态**：已有 PDF/CSV 导出，但无定期报表（周报邮件式）、无限滚动历史报表、
  按项目/标签的 billable 汇总视图。

### 2. 自动追踪 —— 对标 Rize / ActivityWatch
- **F5 浏览器维度缺失**：PowerShell 前台窗口采样只有进程+标题，无 URL/标签页维度
  （ActivityWatch 有 watcher 按窗口类别归类；Rize 有浏览器扩展）。
- **F6 活动归类不可编辑**：自动活动不能手动改类别、不能一键转成 time entry / 番茄会话
  （Rize 的核心交互：把追踪到的活动直接归入 project）。
- **F7 洞察深度**：有 productivity-score，但无「专注 vs 分心」自动分类评分、
  能量时段预测（现有黄金时段仅按完成会话小时聚合）。

### 3. 任务与日历 —— 对标 TickTick / Todoist / Motion
- **F8 日历只读**：ICS 订阅聚合已有，但无 Google/CalDAV 双向同步（TickTick/Motion 主打：
  任务拖上日历排程、会议自动挡住任务时间）。
- **F9 无自动排程**：`smart-recommendation` 只打分，不生成日程；Motion 式
  「按截止日/工时自动排进时间块」缺失；时间块视图与任务依赖图未打通（依赖图节点不能落到排期）。
- **F10 导入生态**：无 Todoist/TickTick/CSV 模板导入（仅自有 ICS/CSV）；迁移成本高。
- **F11 协作缺位**：无共享项目/指派/评论。单机定位可接受，但 data-link-service 已有
  webhook 出站，缺入站 API（他人推送任务进来）。

### 4. 专注激励 —— 对标 Forest
- **F12 奖励无闭环**：`GameProgress.coins === experience`，无商店/消耗/兑换
  （Forest 用金币真实种树；此处硬币无用途，激励衰减）。
- **F13 无社交约束**：无自习室/好友监督/公开承诺（Forest 房间、TickTick 习惯打卡分享）。
- **F14 屏蔽无浏览器侧**：hosts 屏蔽被 DoH 绕过（已加提示，P0 缓解），但无自家浏览器扩展
  做请求级拦截与网页使用时长统计（可一并解决 F5）。

### 5. 平台与同步
- **F15 移动端与桌面漂移**：Android store 与桌面 store 功能不同步（见 F1），
  双实现无共享层收敛计划（`shared/core` 已开始但 pomodoro 引擎等仍在 lib 根）。
- **F16 同步为全量 JSON + 30s 轮询**：无增量/CRDT/实时（含 E2E 加密缺失，S3 明文存
  bucket 由用户自担），多设备并发写只有简单冲突 resolve。

---

## 二、代码层缺失/风险

- **C1** `time-entry-slice` 缺 update/delete 动作（对应 F1，改动小、收益大）。
- **C2** 桌面/Android 两套 store 无契约测试，字段漂移无告警（对应 F15）。
- **C3** 活动追踪仅 PowerShell 轮询，macOS/Linux 无等价实现，且无节流/失败降级日志
  （对应 F5/F3）。
- **C4** 屏蔽自检的 health reason 无法区分 UAC 拒绝与杀软回滚（源码注释自陈）——
  影响用户自助排障。
- **C5** 无自动化测试（全仓未见测试框架），P0–P2 级修复依赖人工回归。
- **C6** `shared/core` 与 `lib` 双路径兼容 re-export 造成同一能力两个 import 源，
  易再漂移（与 C2 同根）。

---

## 三、建议优先级

| 级别 | 项 | 理由 |
|---|---|---|
| P0 | F1/C1 时间条目编辑删除 | 数据正确性缺口，用户无法自助修正 |
| P0 | F3/C3 追踪保留期设置 + 跨平台降级日志 | 隐私预期与可用性 |
| P1 | F6 自动活动 → time entry 一键转化 + 类别编辑 | 打通「无感到→有感到」，Rize 核心价值 |
| P1 | F8 Google/CalDAV 双向同步 | 日历是当前视图体系的最大断点 |
| P1 | F12 硬币商店闭环 | 低成本激活既有游戏化数据 |
| P2 | F2 费率/账单、F10 导入模板、F14 浏览器扩展 | 扩展场景 |
| P2 | F16 增量同步/E2EE、C2 双端契约测试、C5 测试框架 | 工程质量线 |

---

## 四、落地状态（2026-09-19）

| 项 | 状态 | 说明 |
|---|---|---|
| F1/C1 时间条目编辑删除 | ✅ | `updateTimeEntry/deleteTimeEntry` + 时间追踪页行内编辑/删除（删除带 8 秒撤销） |
| F3/C3 保留期设置 + 降级日志 | ✅ | 保留期 7–90 天可配；主进程采样连续 3 次失败熔断并广播 error 状态，非 Windows 平台明示不支持 |
| F6 活动→时间条目转化 + 类别编辑 | ✅ | 今日应用行内「转记录」生成 time entry；类别下拉覆写（`categoryRules` 持久化并回填历史记录） |
| F8 双向同步 | ◐ 尽力实现 | Google/CalDAV API 双向需 OAuth 凭据与在线服务，与本地优先定位冲突，暂不做。已落地双向桥子集：外部订阅事件一键导入为本地日程/任务；ICS 导出在桌面端改为系统保存对话框直接发布本地 .ics（可被 Outlook/日历应用导入） |
| F12 硬币商店闭环 | ✅ | `userLevel.coins` 可消耗账本（随经验发放、商店扣减），解锁冻结扩容卡/冻结恢复卡，接入习惯 `useStreakFreeze` 名额 |
| F2 费率/账单 | ✅ | `Project.rate` 时薪 + 时间追踪页按月导出 CSV 账单（工时×费率） |
| F10 导入模板 | ✅ | CSV 表头别名归一化（兼容 Todoist「Task Name/Priority 1-4/Due Date/Labels」等列名）+ 一键下载导入模板 |
| F14 浏览器扩展 | ✖ 未做 | 独立工程，超出本轮范围 |
| F16/C2/C5 工程质量线 | ✖ 未做 | 需要独立排期（增量同步协议、双端契约测试、测试框架） |

---

*盘点基于 `components/views`（22 视图）、`lib/store/slices`（22 slice）、`electron/main.js`
与 `lib/` 能力模块的只读调研；竞品功能为其 2026 年公开功能页/对比文章口径。*
