# shared/ — 跨端共享核心逻辑（单一来源）

本目录是桌面主库（Next.js）与移动端（`android-app/`，Vite+Capacitor）**共用的纯逻辑层**。
目标是消除"双库漂移"：同一业务规则在两端各写一份、各自演化（历史教训：等级体系曾漂移为
桌面 20 级/60000 分 vs 移动端 12 级/3000 分）。

## 规则

1. **本目录代码不得 import 主库或 android-app 的任何模块**（保持零依赖）；
   需要实体类型时，在 `core/types.ts` 定义结构兼容的最小类型。
2. **业务规则只在这里写一份**：两端各自的 `lib/*.ts` 以 re-export shim 或
   `@shared/*` 别名引用，禁止再复制实现。
3. 纯逻辑优先（不依赖 DOM/React/Zustand），需要平台能力的部分留在两端。

## 别名

- 桌面主库：`lib/level-config.ts` 等为兼容 shim（`export * from '../shared/core/...'`），现有 import 不变
- Android：tsconfig paths 与 vite alias 均已配置 `@shared/*` → `../shared/*`

## 已迁移

| 模块 | 说明 |
|---|---|
| `core/level-config.ts` | 等级阈值/称号/levelFromPoints（20 级单一来源） |
| `core/palette.ts` | 数据色板 COLOR_PALETTE |
| `core/habit-frequency.ts` | isHabitScheduledOn / 频率文案 / 期望次数 |
| `core/habit-streak.ts` | 统一连胜引擎（调度感知、弹性周目标、历史最佳） |
| `core/types.ts` | SharedHabit / SharedHabitCheckIn 结构兼容类型 |
| `core/smart-input.ts` | 智能 NLP 解析器（桌面版为单一来源，兼容 🍅2/2个番茄 写法） |
| `core/recurring.ts` | 重复推进引擎（两端语义并集；修复桌面月末钳制溢出 bug） |
| `core/xp-rules.ts` | 经验规则（桌面口径：番茄按分钟计分） |
| `core/productivity-score.ts` | 生产力评分（四分项 S-D 评级；桌面同源） |
| `core/focus-sound-engine.ts` | 音效引擎（24 种音色；多轨混音；Android 历史 key 别名兼容；雨/森林/咖啡馆/火车/篝火已用 Android 精细 DSP 反向升级） |

## 下一批（按漂移风险排序）

1. Android 数据模型向桌面 Task 收敛（子任务/提醒/依赖等字段仍不对称）
2. 音效合成质量对齐（余量）：waves/wind/plane/keyboard/heartbeat 仍为桌面简化合成，Android 对应音若更优可再回灌
