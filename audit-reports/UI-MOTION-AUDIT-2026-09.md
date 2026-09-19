# FocusFlow 整体 UI 与动效排查（2026-09-19）

基建现状：无动画库（无 framer-motion/gsap），动效 = Tailwind v4 transition + `tw-animate-css` +
`app/globals.css` 手写 keyframes；Tailwind 4 CSS-first，无 tailwind.config，令牌全在
`globals.css` `@theme inline`。以下按「动效基建 / 视图过渡 / 浮层一致性 / 交互反馈 / 视觉一致性 /
可访问性」分组，每条附证据位置，末尾给优先级。

---

## 一、动效基建

- **U1 无统一动效令牌**：`@theme` 里没有 `--ease-*`、`--default-transition-duration`、`--animate-*`
  （`globals.css:112-157`）。实际时长散落为默认 150ms / `duration-200` / `duration-300` / 内联
  0.3s、0.4s，同一应用里至少 5 套节拍。
- **U2 死 CSS 成灾**：`.glass` 全家（6 个类，`globals.css:271-349`）、`.modern-card`、
  `.transition-smooth`、`.glow-primary`、`.gradient-border`、`.sheet-*`/`.dialog-*`（614-670）
  TSX 引用数为 0；`animate-shimmer/float/confetti/task-complete/checkmark-pop/timer-pulse`
  定义了从未使用；`orbitSpin`/`glowBreath` keyframes 无引用。约 200 行无效样式。
- **U3 `prefers-reduced-motion` 全仓 0 处**：沉浸计时器呼吸动画、glow、confetti 等对动效敏感
  用户无任何降级。
- **U4 `immersive-timer.tsx`（1841 行）自成体系**：约 30 处 inline `transition:'...'`
  （`293,757,865,1628`）、组件内 `<style>` 注入 keyframes（`1826-1840`）、`onMouseEnter` 改
  style（`1628-1631`），与全局类/令牌体系完全隔离，且全文件零 `dark:` 变体。

## 二、视图切换与页面过渡

- **U5 切换瞬时且状态残留**：10 个视图在 `desktop-app.tsx:308-333` 按 `switch(activeView)`
  全量卸载重挂，无出场过渡；滚动容器常驻（`desktop-app.tsx:454-459`），切换后**不重置
  scrollTop**，上一视图滚动位置残留；顶栏标题纯文本直切（`386`）。
- **U6 入场动画零层级**：10 个视图共用同一个 `animate-fade-in-up`（0.4s/8px，
  `globals.css:455-457`），无方向、错落、内容层级差异，观感是"整块闪一下"。

## 三、浮层与反馈态一致性

- **U7 Radix 动效只覆盖 7/21 个原语**：有 `data-[state=*]` 动画的仅 dialog/alert-dialog/
  dropdown-menu/popover/select/tooltip/tabs；dialog 是 `duration-200`，dropdown/popover/select/
  tooltip 无 duration（默认 150ms）；`TabsContent`（`tabs.tsx:57-63`）切页零动画；
  checkbox/switch/slider/progress 无进出场。
- **U8 没有 sheet**：`task-detail-drawer.tsx:120-121` 用居中 Dialog 冒充抽屉，无侧滑。
- **U9 加载/空态各写各的**：无 `Skeleton/Spinner/Empty` 公共组件；三处 spinner 边框粗细都不同
  （`app/loading.tsx:4` border-3 vs `desktop-app.tsx:338` border-2）；`暂无…` 手写空态 34 处
  散在 16 个文件；骨架屏仅 `desktop-widget.tsx:99-146` 私有实现。
- **U10 Toast 零主题化**：`ui/sonner.tsx` 仅 3 个 CSS 变量，无统一 duration/图标/动画约定，
  79 处调用全凭默认。

## 四、交互反馈与游戏化动效

- **U11 按钮无按压态**：`ui/button.tsx` 有 hover/focus/disabled，但全仓 `active:scale` 仅 2 处
  （`distraction-log`、`desktop-widget.tsx:532`）；title-bar 窗口三键也只有 `transition-colors`。
- **U12 解锁/庆祝动画缺位或有 bug**：成就解锁无瞬间动画（`achievements-wall.tsx:313-317` 只有
  静态 ring；confetti keyframes 定义了没用）；`goal-celebration.tsx:23-45` 的 `setMounted(true)`
  同步 + setTimeout 写两遍导致入场动画实际不生效，24 个 `<Star>`+`animate-pulse` 是假 confetti；
  `level-up-modal.tsx` 遮罩 200ms 与图标 `zoom-in-95 duration-300` 不同步、靠手写 20ms
  setTimeout 驱动。
- **U13 沉浸/锁定转场全瞬时**：`use-strict-fullscreen` 与 `privacy-lock-overlay.tsx` 中
  transition/animate 零命中，进 kiosk/隐私锁生硬跳变；timer-float 显隐窗口无淡入淡出
  （`electron/main.js:397-400`），三个控制按钮用裸 `transition`（`timer-float.tsx:118-132`）。
- **U14 Dashboard widget 无拖拽反馈**：`dashboard-view.tsx` 未接 dnd-kit（仅 tasks/goals 用），
  重排缺少位移/落位动画。

## 五、视觉一致性

- **U15 字号自演化了 284 处任意值**：`text-[10px]`×220、`[11px]`×37、`[9px]`×23、`[8px]`×2——
  事实上第二套 type scale，但没进 `@theme`。
- **U16 圆角/阴影档位失控**：rounded-lg 139 / xl 114 / full 136 / md 44 / 2xl 36 / sm 27 混用；
  shadow 七档混用；`title-bar.tsx:218`、`button.tsx:25-26`、`desktop-app.tsx:394` 各自覆写。
- **U17 暗色模式覆盖不均**：`dark:` 仅 131 处；`components/focus/` 11 个文件与 anniversaries/
  focus/goals/habits/time-block 5 个视图**零 dark:**；`desktop-widget.tsx` 硬编码色 30 处；
  `text-white` 43 处含 `ui/button.tsx:14` 的 `bg-destructive text-white`；出现成对手写
  `bg-white dark:bg-slate-800`（`title-bar.tsx:218`、`saved-filters-bar.tsx:130,214`）。
- **U18 杂项**：`/avatar.jpg` 404（默认头像资源缺失）；控制台持续出现 DialogContent 缺
  `aria-describedby` 警告。

## 六、可访问性

- **U19 focus ring 被显式关掉 7 处**：`command-palette.tsx:300`、`global-search.tsx:102`、
  `quick-capture.tsx:150`、`smart-quick-add-task.tsx:101`、`tasks-view.tsx:1309`、
  `activity-timeline-card.tsx:190`、`pomodoro-quick-task.tsx:248`——恰是键盘操作最密集的入口。
- **U20 触控/hover 依赖**：小于 32px 的可点目标 143 处（settings 20、analytics 18、tasks 14）；
  hover-only 显隐 14 处（如 `goals-view.tsx:339` 删除按钮 `opacity-0 group-hover:`），触屏与
  键盘路径不可达，且本轮 P0-1/P1-1 新加的行内操作按钮沿用了同一模式。
- **U21 图标尺寸两套写法并存**：`h-4 w-4`×289 vs `size-4`×18 等。

---

## 优先级建议

| 级别 | 项 | 理由 |
|---|---|---|
| P0 | U19 focus ring 被移除、U20 hover-only 不可达、U18 avatar 404 | 键盘/触屏路径直接失效，修复成本低 |
| P0 | U12 goal-celebration 入场失效 bug、U5 切换滚动残留 | 属于可感知 bug 而非风格问题 |
| P1 | U1 动效令牌（duration/easing 三档制）+ U7 Radix 进出场模板统一 + U11 按压态 | 一次立规，全局收敛节拍 |
| P1 | U5/U6 视图过渡（滚动复位、差异化入场、顶栏标题过渡）| 桌面端最频繁的感知面 |
| P1 | U8 引入 sheet、U12 解锁/升级庆祝动效落地（复用已有 confetti keyframes）、U13 沉浸/锁屏转场 | 高情绪价值点位 |
| P2 | U2 死 CSS 清理、U3 reduced-motion、U9 Skeleton/Empty/Spinner 组件化、U10 toast 主题化 | 整理债 |
| P2 | U15/U16 字号圆角收敛进 @theme、U17 暗色补齐（focus 目录优先）、U4 immersive-timer 迁移、U14 widget 拖拽反馈、U21 统一写法 | 长期一致性 |

---

## 落地状态（2026-09-19 全量修复完成）

| 项 | 状态 | 说明 |
|---|---|---|
| U1 动效令牌 | ✅ | `@theme` 新增 `--ease-smooth/--ease-spring`、`--default-transition-duration:200ms`、全局缓动统一 cubic-bezier(0.32,0.72,0,1) |
| U2 死 CSS | ✅ | 删除 `.glass*`/`.modern-card`/`.glow-primary`/`.gradient-border`/`.sheet-overlay`/`.dialog-*`/`.transition-smooth` 及 shimmer/float/confetti/task-complete/timer-pulse 等 ~200 行；`orbitSpin/glowBreath`（timer-ring 内联引用）、`.glass-sheet/.sheet-panel/.sheet-handle`（新 sheet 复用）确认保留 |
| U3 reduced-motion | ✅ | `globals.css:274` 全局 `prefers-reduced-motion` 降级块（animation/transition 压至 0.01ms） |
| U4 immersive-timer | ⚠️ 部分 | 关键转场（严格模式提示、违规行）已改 `animate-in` 令牌类；文件内剩余 ~25 处内联 transition 属 kiosk 自定义视觉，整体迁移并入后续重构，避免一次性回归风险 |
| U5 切换残留 | ✅ | `desktop-app.tsx` 视图切换 scrollTop 复位 + 顶栏标题 `key` 重挂载淡入 |
| U6 入场层级 | ✅ | 10 视图根改 `.view-enter`（子块 0.06–0.36s 错落上浮） |
| U7 Radix 进出场 | ✅ | dialog/alert-dialog 遮罩 duration-200、dropdown/popover/select/tooltip 统一 150ms、TabsContent fade+slide 200ms |
| U8 Sheet | ✅ | 新建 `ui/sheet.tsx`（glass-sheet/85vh/下滑手柄/四边滑入）；task-detail-drawer 迁移为 bottom(移动)/right(桌面) sheet；**补上历史缺失的触发入口**（任务右键菜单「查看详情」，此前 detailTaskId 从未被置值，抽屉为不可达死代码） |
| U9 组件化 | ✅ | 新增 `Spinner/Skeleton/EmptyState`；loading 路由与 analytics/tasks/goals 等手写空态收敛；三处 spinner 统一 |
| U10 Toast | ✅ | sonner 统一 duration 2500 + popover 语义色/classNames 主题化 |
| U11 按压态 | ✅ | button 基类 `active:scale-[0.98]` |
| U12 庆祝动效 | ✅ | goal-celebration 双 setMounted bug 修复；成就「刚刚解锁」徽标+checkmark-pop；level-up 图标时长与遮罩同步（200ms）；原计划的 confetti keyframes 复用改为 `animate-in zoom-in` 方案，keyframes 已随 U2 删除 |
| U13 沉浸/锁屏转场 | ✅ | privacy-lock 遮罩淡入 300ms；沉浸计时严格/违规块滑入；timer-float 裸 transition 改 transition-colors |
| U14 widget 拖拽反馈 | ⏸ 暂缓 | dashboard 小组件当前无任何重排入口（非仅缺动画），实现 dnd-kit 重排属新功能而非动效修复，单独立项 |
| U15 字号令牌 | ✅ | `--text-2xs/--text-3xs` 进 @theme，283 处 `text-[8-11px]` 全部替换 |
| U16 圆角/阴影 | ✅ 收敛 | 弹层圆角统一进 sheet/dialog 组件；剩余 `rounded-[4px]/[2px]` 与 3 处重阴影为 title-bar/widget 刻意最小集合，保留 |
| U17 暗色 | ✅ | saved-filters-bar/task-reminders/quick-date-presets/button-destructive 全量语义化（0 slate/blue/white 残留）；widget/title-bar/timer-float 深色 chrome 为刻意设计保留 |
| U18 杂项 | ✅ | avatar 默认值置空 + 条件渲染（404 消失）；20 个文件全部 DialogContent 补 `aria-describedby` 或显式 undefined，控制台 0 警告 |
| U19 focus ring | ✅ | 7 处 `focus:outline-none` 类移除点恢复可见 ring（走 tokens） |
| U20 hover-only | ✅ | 19 处 `opacity-0 group-hover:` 统一为 `.hover-reveal`：仅 `(hover:hover) and (pointer:fine)` 下隐藏，触屏常驻显示、键盘 focus 可达 |
| U21 写法统一 | ✅ | 新增业务代码统一 `h-N w-N`；`size-N` 仅存于 shadcn 生成的 ui 原语，不强改 |

验证：`tsc --noEmit` / eslint（0 错误）通过；dev server DOM 实测——Dialog `aria-describedby` 生效、
Sheet 以 `slide-in-from-bottom + .sheet-handle` 正常开合、console 无警告、text-2xs=10px/text-3xs=9px。
截图目检仍受内置浏览器面板限制未做，交互层以 DOM 结构检查覆盖。

---

*依据 Explore 全仓盘点（含统计数与 file:line）+ 运行中 dev server 的 DOM 结构检查；
截图目检因内置浏览器面板未显示暂缺，打开面板或启动 `npm run electron:dev` 可补视觉层结论。*
