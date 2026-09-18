# 专注封锁/防干扰 —— 对标成熟软件排查报告

> 模块负责人：M4 · 专注封锁/防干扰（FocusShield）
> 基于真实代码读取（文件路径均以 D:\Timer\dcm\backup 为根），结论来自实际读文件，非文档推断。

## 一、对标产品

| 产品 | 对标要点 |
|---|---|
| **Freedom** | 跨端系统级阻断（macOS/Windows/Android/iOS）、严格/轻松两档强度、定时封锁会话（Scheduled Sessions）、暂停 5 分钟、延迟开始、50+ 预设阻隔清单 |
| **Cold Turkey Blocker** | “不可绕过”定位：系统服务/防火墙层拦截、防退出保护、应用+网站双通道、屏蔽报表 |
| **Opal** | 移动端按类别（社交/娱乐/游戏）屏蔽、封锁会话倒计时、退出需付出代价 |
| **OneSec** | 打开被屏蔽 App 时的“呼吸犹豫屏”（3 秒）、拦截尝试自动计数，把拦截变成可量化的行为干预 |
| 参考：Forest / 番茄ToDo | 专注坚持与游戏化联动（失败惩罚/成就奖励）、专注时长统计复盘 |

## 二、现状能力盘点（真实读到的功能，逐条注明文件路径）

1. **屏蔽清单管理（网站/应用）**：components/focus/focus-shield.tsx（L40-54 存储 Key、L60-119 初始化/恢复、L175-198 增删改切换、L429-461 列表渲染）；默认清单 lib/focus-shield-defaults.ts（L3-45：黑名单 8 网站+4 应用、白名单 6 网站+4 应用）。
2. **黑白名单模式切换**：components/focus/focus-shield.tsx L38 / L121-140（两套清单分别保存加载）；Electron 端白名单反向计算 electron/system-shield.js L82-94。
3. **倒计时封锁会话**：components/focus/focus-shield.tsx L228-250（activateShield 1~1440 分钟，localStorage 持久化 active/until）、L324-337（+25 分钟延长）、L94-112（刷新后恢复、过期自动停）。
4. **定时封锁会话（时间窗调度）**：UI components/focus/shield-schedule-settings.tsx（L15-127 周几+起止时间+跨夜提示）；数据 lib/store/slices/focus-shield-slice.ts L69-105；调度执行 lib/use-shield-schedule.ts L36-75（30 秒轮询、跳变沿触发、跨夜窗口判定 L15-30）。
5. **Electron 系统级屏蔽**：electron/system-shield.js —— hosts 文件拦截（L178-226，0.0.0.0/::/www 四行）、进程终止（L229-263 tasklist/taskkill，3 秒轮询 L287-289）、hosts 备份与标记块清理（L107-166）、DNS flush（L169-175）；IPC 注册 electron/main.js L791，退出清理 L821/L828。
6. **IPC 安全设计**：electron/main.js L71-79 isTrustedSender 校验；electron/system-shield.js L59-79 sanitizeDomain/sanitizeAppName 注入防护；spawn 全用 argv 数组不经 shell（L236、L259）。
7. **番茄钟自动屏蔽联动**：lib/dnd.ts L21-74（引用计数启停）、L115-139 useAutoShield（专注开始自动屏蔽、结束自动停止）；调用点 components/focus/pomodoro-timer.tsx L91。
8. **Android 端系统屏蔽**：android-app/android/app/src/main/java/com/focusflow/app/FocusShieldService.java（L30-139，UsageStatsManager 800ms 轮询+全屏拦截页拉起）；ShieldBlockActivity.java（L10-28 全屏拦截页、禁用系统返回键）；NativeBridgePlugin.java L124-151（updateShieldState 写 SharedPreferences 并启停前台服务）；渲染层调用 android-app/src/App.tsx L47-54；应用选择器 android-app/src/pages/FocusShieldPage.tsx（L31-49 列表、L186-239 已装应用选择）；Manifest 声明 android-app/android/app/src/main/AndroidManifest.xml L88-104（specialUse 前台服务）。
9. **状态持久化/备份/同步**：focusShield/focusShieldSchedule 在 persist 白名单（lib/store/index.ts L463-464），focusShield 进云同步 payload（L526、L567）；数据备份/导出包含（components/data-backup.tsx L87、components/data-export.tsx L166）。
10. **开机自启常驻**：electron/main.js L317-337 setLoginItemSettings（openAsHidden）、托盘菜单开关 L295-303、components/views/settings-view.tsx L1183 设置项。
11. **空闲检测（番茄钟自动暂停）**：lib/use-idle-detector.ts L20-49（mousemove/keydown/scroll 等事件，15 秒轮询，上限 120 分钟）。
12. **分心记录（复盘辅助）**：components/focus/distraction-log.tsx（分类模板 L41-88、快捷登记、今日/本次会话聚合统计）。

## 三、需要增强与优化的功能（差距表）

| 优先级 | 领域 | 差距描述 | 对标产品 | 成熟做法参考 | 增强建议（指明文件） | 用户影响 | 工作量 |
|---|---|---|---|---|---|---|---|
| 高 | 绕过/强制退出 | 屏蔽强度不足且易绕过：任务管理器强杀 FocusFlow 后 hosts 残留、用户可直接改 hosts/结束 taskkill 轮询；屏蔽中“结束屏蔽”无任何二次确认（focus-shield.tsx L341-344），无“严格/强硬模式” | Cold Turkey / Freedom 严格模式 | 系统服务+防火墙级拦截、密码/防退出保护、屏蔽期间禁退 | focus-shield.tsx 结束按钮加确认+可选强制定时；electron/main.js 在 before-quit 检测屏蔽活跃时拦截退出并提示；system-shield.js 增加计划任务守护 | 依赖意志力者屏蔽形同虚设 | 中 |
| 高 | 管理员权限 | hosts 写入无提权处理：system-shield.js L219 直接 fs.writeFileSync 到 C:\\Windows\\System32\\drivers\\etc\\hosts，非管理员必然失败，UI 仅置 error（focus-shield.tsx L211/L214），无引导无降级；macOS /etc/hosts 同理；electron 目录检索无任何 UAC/提权代码 | Cold Turkey / Freedom | 首次启动检测可写性并引导 UAC 提权（或建立管理员计划任务/服务）；失败降级“仅应用拦截” | electron/main.js 启动检测 hosts 可写性，不可写时提供 UAC 提权助手（spawn powershell Start-Process -Verb RunAs）或引导手动以管理员运行；system-shield.js startSystemShield 失败返回原因码供 UI 展示与降级 | 普通用户（非管理员）系统级屏蔽完全不可用 | 中 |
| 高 | 定时封锁可靠性 | 时间窗调度只跑在渲染进程 setInterval 30s（use-shield-schedule.ts L73），主窗口 backgroundThrottling 未关闭（main.js L132-139 仅 timerFloat 关闭），窗口最小化/隐藏后定时器被 Chromium 重度节流，进出窗口可能延迟数分钟；应用退出后调度彻底失效 | Freedom 定时会话 | 调度放主进程独立定时器（不受渲染节流、不依赖页面存活） | 新建 electron/shield-scheduler.js（主进程解析时间窗并触发 shieldStart/Stop，窗口判定逻辑迁移自 use-shield-schedule.ts L15-30）；渲染层改为仅同步展示状态 | 定时封锁错过窗口边界，防干扰失效 | 中 |
| 高 | 崩溃恢复 | 屏蔽状态仅存 localStorage“预计到期”（focus-shield.tsx L94-112）；进程被强杀后重启，UI 显示“屏蔽中”但系统 hosts/进程拦截未重新下发（恢复分支只 setState 不调 shieldStart），残留 hosts 块也未清理 | Cold Turkey | 主进程持久化屏蔽状态文件，启动时若“活跃未到期”则重放 start，否则先清残留块 | system-shield.js 增加 onStartupSync（读写 ~/.focusflow/shield-state.json）；electron/main.js app.whenReady 后调用；focus-shield.tsx L94-112 恢复改为调用 shieldStart 保证一致性 | 崩溃后屏蔽名存实亡且 hosts 残留 | 中 |
| 中 | Web 端能力 | Web 浏览器模式仅为提示文案（focus-shield.tsx L463-469），无任何实际拦截手段 | Freedom 浏览器扩展 / Flora | 浏览器扩展（chromium MV3 declarativeNetRequest）跨页面阻断 | 新建 browser-extension/（读同一规则 JSON）；短期可在 Web 端增加“专注期间拦截干扰站点”的覆盖层组件 | Web 用户毫无防护 | 大 |
| 中 | 白名单语义不一致 | system-shield.js computeBlockLists L82-94：白名单=硬编码 16 个默认干扰站 - 允许项；用户自定义的非默认干扰网站不会被系统屏蔽，且默认干扰列表不可编辑 | Freedom / OneSec | 白名单=只放行清单（其余全拦）；干扰库可编辑 | system-shield.js 白名单分支改为“除允许项外全拦”或将默认干扰库落库可编辑（focus-shield-defaults.ts 增加可编辑干扰库） | 白名单用户发现漏网之鱼 | 中 |
| 中 | 封锁统计/复盘 | 无任何“屏蔽会话记录”落库：开始/结束时间、被拦截尝试次数（OneSec 核心指标）、屏蔽总时长均无；分心记录为手动登记 | OneSec / Freedom / Cold Turkey 报表 | 每次拦截自动计数，会话级统计（次数/时长/绕过）进统计与复盘 | 新增 lib/store/slices/shield-stats-slice.ts（shieldSessions/blockedAttempts/bypassCount）；system-shield.js 拦截与杀进程时自增计数回传；ShieldBlockActivity 弹出时上报 | 无法度量屏蔽效果与坚持度 | 中 |
| 中 | 临时解禁/例外 | 无 Freedom 式“暂停 5 分钟”、无会话级白名单例外；专注中临时查资料只能整体结束屏蔽 | Freedom 暂停 / Opal 忽略一次 | 倒计时暂停按钮+会话内例外 | focus-shield.tsx 增加“暂停 5 分钟”（暂停 hosts 块/进程轮询并倒计时自动恢复）；Android FocusShieldService 增加 pauseWindow | 工作流被打断时无处泄压，只能放弃屏蔽 | 中 |
| 中 | 与奖励联动 | 成就/等级（store.userLevel/achievements，lib/store/index.ts L445-446）与屏蔽零联动，无“坚持封锁 X 分钟”的量化与激励 | Forest / 番茄ToDo | 专注坚持→成就/奖励；中途放弃有惩罚反馈 | 在 achievements/focusGoals 增加“完成封锁会话/连续封锁天数”成就与积分；focus-shield.tsx 会话结算时触发 | 缺乏正反馈，屏蔽沦为纯限制工具 | 中 |
| 低 | Android 拦截页 | ShieldBlockActivity 直接 finish() 退出无犹豫期（L20），Home 键/最近任务可轻易绕过（返回键禁用 L24-27 但其他入口未封），绕过无记录无惩罚；800ms 无脑轮询（FocusShieldService.java L39-49）锁屏/后台持续耗电 | OneSec 呼吸屏 / Opal 严格退出 | 3-5 秒“确认放弃”犹豫屏，退出即记一次绕过；轮询间隔按屏幕状态动态调整 | android-app/.../ShieldBlockActivity.java 增加犹豫倒计时+绕过上报；FocusShieldService.java 空闲时拉长轮询间隔 | 移动端防干扰形同虚设且耗电 | 中 |
| 低 | 多端配置同步 | Web UI 用独立 localStorage key（focusflow-focus-shield-v2，focus-shield.tsx L40-44），而 store.focusShield 同时持久化并进云同步 payload（lib/store/index.ts L526/L567）——云同步写入不作用于 UI；Android 端独立 store，与 Web 无互通 | Freedom 云同步 | 单一规则事实源（store），UI 读写同一数据，跨端云同步一致 | focus-shield.tsx 改为读写 store.focusShield（保留 localStorage 兼容读）；android-app 与 Web 规则通过现有同步通道互通 | 换设备后屏蔽清单丢失/不一致 | 中 |
| 低 | 模板与快捷键 | 无预设模板库（“社交媒体”“娱乐”一键模板，Freedom 有 50+ 预设）；无全局快捷键一键启停屏蔽（现 Ctrl+Shift+F/P 仅窗口/番茄钟，main.js L521-535） | Freedom 预设 / Opal 类别 | 模板分组批量添加；全局热键切换 | lib/focus-shield-defaults.ts 增加模板分组；focus-shield.tsx 增加“从模板添加”；electron/main.js registerGlobalShortcuts 增加 shield-toggle（如 Ctrl+Shift+D）与托盘“暂停屏蔽” | 冷启动成本高、操作繁琐 | 小 |

## 四、发现的隐患与问题（可注明文件行号）

1. **hosts 直写无权限兜底**：electron/system-shield.js L219 直接写系统 hosts，非管理员抛错，startSystemShield 返回 success:false（L280-293），前端仅置 error（focus-shield.tsx L211/L214），定时封锁/番茄钟自动屏蔽全部静默失败——桌面端核心能力对多数普通用户实际不可用（electron 目录 grep RunAs/管理员 无任何结果）。
2. **强杀后 hosts 残留+状态错位**：cleanupShield 只在正常 before-quit/will-quit 执行（main.js L818-829）；任务管理器强杀时残留屏蔽块。下次启动若 localStorage until 未过期（focus-shield.tsx L94-102）只置状态不重发 shieldStart，出现“UI 屏蔽中、系统未屏蔽”假象；过期分支 L104-111 会调 shieldStop 清残留，但依赖页面渲染。
3. **双数据源漂移**：UI 写 localStorage key（focus-shield.tsx L40-44），store.focusShield 独立持久化并参与云同步（lib/store/index.ts L526/L567），两处可长期不一致；readActiveShieldConfig（focus-shield-defaults.ts L58-93）与 dnd.ts getUserShieldConfig（L91-109）又各读一份，共三处清单来源，逻辑重复易出偏差。
4. **渲染进程节流**：main.js 主窗口未设 backgroundThrottling:false（仅 timerFloat L249 设置），窗口最小化/隐藏后 30s 调度轮询与 1s 倒计时刷新可能被 Chromium 节流到 1 次/分钟，倒计时显示与定时封锁都会失真。
5. **tasklist CSV 解析脆弱**：system-shield.js L249-256 用 split('","') 手工解析 /FO CSV，进程名含逗号/引号时可能错位；/F 强杀无确认，精确名匹配（L242-246）已尽量防误杀，但多进程应用（QQ 系）仍有漏网面。
6. **整文件恢复覆盖用户编辑**：restoreHosts（L120-135）用备份文件整文件复制回 hosts，屏蔽期间用户手动添加的 hosts 条目会被覆盖丢失。
7. **白名单语义偏差**：computeBlockLists（L82-94）仅拦截硬编码默认干扰站，用户自定义站点漏拦（详见差距表）。
8. **Android 拦截可轻易绕过+耗电**：ShieldBlockActivity 返回键禁用（L24-27）但 Home 键/最近任务可离开，弹出无犹豫期、无惩罚；ForegroundService 800ms 无脑轮询（FocusShieldService.java L39-49）锁屏/后台持续耗电；Android 12+ 通知权限与特殊使用权限的首次引导缺失（只有设置页文字提示 FocusShieldPage.tsx L136-139）。
9. **iOS 空洞**：nativeAvailable = Capacitor.isNativePlatform()（android-app/src/lib/native-bridge.ts L35）对 iOS 同为 true，但 FocusShieldService/ShieldBlockActivity 为 Android 专属，iOS 端 setShieldState 静默失败且无界面提示。
10. **自定义时长用 window.prompt**：focus-shield.tsx L367 原生 prompt 输入分钟数，Electron 无边框窗口下体验割裂，且仅 NaN 校验。
11. **macOS 应用拦截缺失**：killBlockedApps/scanAndKillBlockedApps 仅 Windows（system-shield.js L230/L243），macOS 只能拦网站且 /etc/hosts 写权限问题未处理。
12. **跨夜窗口空 days 语义模糊**：use-shield-schedule.ts L25-29 中 days 为空数组时 prevDayOk 恒为 true，且“cur < end 且无条件”分支（L29）实际等同整夜成立，语义依赖注释，无 UI 校验空周几组合。

## 五、本模块已有亮点

1. **三层防干扰架构**：Web 提示层（focus-shield.tsx L463-469）+ Electron 系统级（hosts+进程终止）+ Android 原生前台服务（UsageStats 轮询+全屏拦截），一套规则在桌面/移动双端落地，起点高于多数同类应用。
2. **定时封锁会话设计严谨**：跳变沿触发（use-shield-schedule.ts L32-35）避免窗口内手动停止后被立刻重启；跨夜窗口归属日判定（L15-30）逻辑完整；UI 支持周几+跨夜。
3. **安全工程到位**：IPC 全部经 isTrustedSender（main.js L71-79、system-shield.js L351-373）、域名/进程名双重 sanitize 防 hosts/命令注入（L59-79）、spawn 全 argv 数组不经 shell（L236/L259），屏蔽这种高风险能力无明显注入面。
4. **hosts 保护机制**：标记块+备份双保险（system-shield.js L107-166），先清自身块再备份，避免污染用户原始 hosts；DNS flush 双平台（L169-175）。
5. **自动联动闭环**：番茄钟开始自动屏蔽（dnd.ts L115-139 引用计数防多入口重复停启）、Android 专注运行自动拉起拦截服务（App.tsx L47-54）。
6. **配套能力齐全**：开机自启（main.js L317-337）、空闲检测自动暂停番茄钟（use-idle-detector.ts L35-49）、分心记录（distraction-log.tsx）与屏蔽形成互补闭环。