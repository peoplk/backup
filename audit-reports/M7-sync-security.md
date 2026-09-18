# 同步 / 备份 / 安全 —— 对标成熟软件排查报告

> 审计依据：本会话真实读取代码文件（read/grep/glob），每条现状与问题均注明文件路径与行号；未读到的能力一律不声称存在。
> 对标产品使用内置知识（环境无法联网）。

## 一、对标产品

| 对标产品 | 参照维度 |
| --- | --- |
| Todoist / TickTick(滴答清单) | 多设备云同步、合并正确性(ID/时间戳/删除墓碑)、离线队列与失败重试、版本保留、增量同步 |
| Notion | 单账号多设备实时同步、历史版本回滚、在线/离线冲突处理 |
| 1Password / KeePass | 全库端到端加密(主密码派生)、启动即锁、凭据保险库、备份完整性(KDBX 校验)与保留策略 |

## 二、现状能力盘点（逐条注明文件路径）

### 1. 云同步（双后端 + 统一状态机）
- 统一工厂抽象：createSyncStore 封装 enable/disable/forceSync/logout/conflict 等通用逻辑，Firebase 与 S3 各自提供策略实现（lib/sync-store-factory.ts L117-311；lib/sync-store.ts；lib/s3-store.ts）。
- Firebase 后端：users/{uid} 单文档整体写入 data 字段（lib/firebase.ts L217-233）；onSnapshot 实时订阅（L244-269）；匿名/Google 账号登录（L172-215）；离线时 disableNetwork（L271-279）。
- S3 后端：AWS SigV4 手写签名（lib/s3-sync.ts L288-366），请求带 15s 超时（L364）；单对象整文件 PUT/GET（L437-470）；定时轮询订阅（默认 30s，L472-497）；预置存储服务列表（L52-65）；连接测试 HEAD 探测 + CORS 错误提示（L390-435）。
- 集合级合并：mergeLocalAndCloud / mergeLocalAndS3 按数组条目 id 合并、以条目 updatedAt 比较取舍（lib/firebase.ts L281-334；lib/s3-sync.ts L499-551）。
- 冲突检测：detectDataConflicts 对比 6 类实体(tasks/habits/goals/anniversaries/projects/tags)差异生成冲突列表（lib/sync-store-factory.ts L84-108）；设置页冲突面板（components/views/settings-view.tsx L1310-1368）。
- 自动推送：cloudSyncMiddleware 包裹所有 store set，2s 防抖后序列化全库并推送（lib/store/utils.ts L73-129），并对内容快照比对、无变化跳过（L121-128）。
- 手动同步 UI：推/拉按钮（settings-view.tsx L1586-1637 Firebase；L1952+ S3）；同步开关（L1277-1305）。
- 离线监测：系统 offline/online 事件切换状态并调用 setOfflineMode（lib/network-monitor.ts L7-25）。

### 2. 本地备份与导入导出
- 备份：手动创建快照，最多保留 10 份，全部存入 localStorage（components/data-backup.tsx L25-26、L52-103）；恢复为整包 JSON.parse 后 restoreDataToStore（L105-116）。
- 恢复管线：restoreDataToStore 对 tasks/habits/goals/anniversaries/projects/tags/reminders/timeEntries/pomodoroSessions 及 EXTRA_KEYS 做字段级缺省回填与日期还原（lib/data-restore.ts L53-78、L80-279）。
- 导出：JSON 全量导出（含 exportInfo 版本 1.1、时间范围筛选、归档/完成包含开关），CSV 分段导出（components/data-export.tsx L38-73、L112-224）。
- 导入：JSON 走 restoreDataToStore 追加式恢复；CSV 按表头解析逐行 addTask（components/data-import.tsx L26-108），支持拖拽（L117-129）。
- ICS 导出/订阅（lib/ics-export.ts、lib/ics-parse.ts、lib/calendar-subscriptions.ts）属日历模块，不在本模块展开。

### 3. 安全
- 凭据保险库：Electron 主进程用 safeStorage(DPAPI/Keychain) 加密解密（electron/main.js L751-781）；渲染层 sealSecret/unsealSecret 带 seal:v1: 前缀与显式明文降级标记（lib/credential-vault.ts L14-89）；S3 Secret、LLM API Key 均通过该通道落盘（lib/s3-sync.ts L96-120、L152-167；lib/llm-assistant.ts L57、L77）。
- 隐私锁：密码经 PBKDF2(210k)+盐哈希存储（lib/crypto.ts L101-146）；设置与解锁对话框（components/privacy-lock.tsx）、全屏锁定遮罩（components/privacy-lock-overlay.tsx L116-150）；自动锁定 1/5/10/30 分钟无操作（privacy-lock.tsx L85-115，overlay L61-95）。
- E2E 加密备份：AES-256-GCM + PBKDF2(100k) 加密导出/恢复 .ffb（components/privacy-lock.tsx L204-262；lib/crypto.ts L35-92）。
- 持久化防线：persist 白名单/数组类型校验，损坏数据丢弃（lib/store/index.ts L90-119）；跨窗口 storage 事件合并（L121-150）；2s 节流落盘 + pagehide 刷盘（L152-217）。

## 三、需要增强与优化的功能

| 优先级 | 领域 | 差距描述 | 对标产品 | 成熟做法参考 | 增强建议(指明文件) | 用户影响 | 工作量 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 高 | 云同步合并正确性 | Task/Habit/Goal/Anniversary 无 updatedAt 字段（lib/types.ts L66-100、L155-176、L215-233，仅 DailyJournal 有），合并比时间戳恒为 0（lib/firebase.ts L306-317；lib/s3-sync.ts L526-536），差异条目总是本地优先，A 设备对 B 设备已编辑条目的修改被静默覆盖 | TickTick/Todoist | 每条记录维护 updatedAt(变更动作时刷新)，merge 按(updatedAt 大者胜，同值再比 createdAt)取舍 | 修改 lib/types.ts 实体定义 + 各 slice 的 add/update 动作 + lib/firebase.ts、lib/s3-sync.ts 的 merge 分支 | 多设备编辑互相覆盖、数据丢失 | 中 |
| 高 | 删除传播/墓碑 | 无删除墓碑：merge 以云端为基底只补缺失本地项（lib/firebase.ts L299-305），设备 A 永久删除后 B 侧拷贝仍存云端，合并时被删条目复活；trash 仅软删列表(也整体同步，lib/store/types.ts L243) | Todoist/TickTick | 删除写 tombstone(deletedAt 保留 30-90 天)，merge 时墓碑优先级最高；S3 可叠加对象版本化回溯 | lib/firebase.ts、lib/s3-sync.ts merge 逻辑 + 各 delete/trash slice 写墓碑 | 单设备删除在其他设备重新出现 | 中 |
| 高 | 端到端加密范围 | 云端数据明文(仅 TLS 传输层)：syncToCloud/syncToS3 直接 JSON.stringify 全库（lib/firebase.ts L221-227；lib/s3-sync.ts L443）；加密仅覆盖凭据字段与手动 .ffb 备份 | 1Password/KeePass | 提供云数据 E2E 加密开关：主密钥(可复用隐私锁密码派生)上传前 AES-GCM 加密全库，云端只存密文；凭据保险库模式推广到主库 | 新增 lib/e2e-sync.ts，接入 lib/firebase.ts syncToCloud/syncFromCloud 与 lib/s3-sync.ts syncToS3/syncFromS3 | 云端/服务器泄露 = 全部数据泄露 | 大 |
| 高 | 失败重试与离线队列 | pushData 捕获失败后静默丢弃（lib/sync-store-factory.ts L280-288）；离线期间变更无暂存队列，network-monitor 恢复在线仅改状态不补推（lib/network-monitor.ts L17-21） | Todoist/TickTick | 变更级 pending 队列(persist 到 localStorage)，失败按指数退避重试，重连后自动补传；UI 显示待同步 N 项 | 新增 lib/offline-sync-queue.ts；改造 sync-store-factory pushData、network-monitor handleOnline | 断网期间改动丢库、重连不自动补传 | 中 |
| 高 | 版本保留与历史回滚 | 单文档/单对象覆盖写，无任何历史版本（lib/firebase.ts L223-226；lib/s3-sync.ts L443-450），误操作/被覆盖后无法恢复 | Notion 页面历史/Todoist | S3 启用对象版本化或 focusflow-sync.v{n}.json 轮转保留 N 份；Firebase 推送前把上一版存入 users/{uid}/history/{ts} 子集合 | lib/s3-sync.ts syncToS3、lib/firebase.ts syncToCloud + 设置页版本列表 UI | 云端数据被覆盖后无法回滚 | 中 |
| 中 | 增量 vs 全量 | 每次推送整库序列化（lib/store/utils.ts L78-128），Firestore 单文档 1MiB 上限，数据增长(日志/时间条目/番茄记录)后写入必然失败，流量费用高 | Todoist/TickTick | Firebase 改子集合按实体类型/按日分文档(每任务一文档)；S3 保留整库但用 ETag/If-None-Match 条件请求、增量补丁 | lib/firebase.ts 存储模型重构 + lib/store/utils.ts | 数据量增大后同步不可用、成本攀升 | 大 |
| 中 | S3 多用户隔离 | remoteKey 默认固定 focusflow-sync.json（lib/s3-sync.ts L6），共用桶的所有用户读写同一对象(L437-470 忽略 userId)；userId 仅由 32 位 FNV 哈希派生(L377-379) | TickTick/Notion | 按 userId 生成对象前缀(形如 userId/data.json)，派生改用 SHA-256 截断避免碰撞 | lib/s3-sync.ts ensureS3Auth/deriveUserId/syncToS3 | 多人共用桶互相覆盖、数据串扰 | 小 |
| 中 | 自动备份周期与保留策略 | 备份仅手动触发，保留固定 10 份（components/data-backup.tsx L25-26），无自动备份、无可配保留策略 | 1Password/KeePass/Todoist | 每日自动快照(保留 7 份)+ 用户可配频率与保留数；或把备份轮转上传到 S3 对象作异地备份 | components/data-backup.tsx + 新增 lib/auto-backup.ts(接入 desktop-app 启动钩子) | 用户忘记备份 → 无回退手段 | 小 |
| 中 | 备份完整性(校验/损坏检测) | 恢复仅 try/catch JSON.parse（components/data-backup.tsx L105-116），无校验和、无 schema 校验、无逐集合容错，损坏备份整包失败 | KeePass KDBX | 备份内嵌校验(如 payload 尾部附加 sha256 摘要与格式版本)，恢复前按集合逐一 schema 校验、坏集合跳过可部分恢复 | components/data-backup.tsx + lib/data-restore.ts 增加 validateAndRestore | 半损坏文件无法恢复、误恢复覆盖现有数据 | 中 |
| 中 | 隐私锁粒度 | 锁仅为 UI 遮罩，本地数据在 localStorage 明文未加密(遮盖文案称数据已加密保护，不准确：privacy-lock-overlay.tsx L130)；启动时若上次退出未锁则开屏即见数据(privacy-lock.tsx L63-68)；无启动即锁、无 Electron 锁屏联动 | 1Password/KeePass | 默认启动即锁策略；Electron 下用 safeStorage 加密本地主库落盘；监听 powerMonitor lock-screen/窗口失焦自动锁定 | components/privacy-lock.tsx、privacy-lock-overlay.tsx + electron/main.js | 共用电脑/设备丢失时数据裸露 | 中 |
| 中 | 加密备份实现隐患 | btoa(String.fromCharCode(...result)) 对大数据展开会栈溢出 RangeError（lib/crypto.ts L58）；.ffb 无文件头魔数/版本/校验(privacy-lock.tsx L221-227) | KeePass | 分块 base64 或 Blob URL 导出；文件头含 magic/version/checksum，导入前先验证 | lib/crypto.ts + components/privacy-lock.tsx | 大型备份加密导出直接失败 | 小 |
| 低 | 手动同步一致性 | 冲突面板保留本地/保留远端只从列表移除冲突（lib/sync-store-factory.ts L259-263；settings-view.tsx L1340-1361），未把选择写入云端；且无时间戳时每次拉取反复检测同一冲突(lib/firebase.ts L312-317) | Todoist 冲突面板 | 每次解决都落地：把所选版本显式推送到云端(含墓碑/时间戳)，冲突条目标记已解决防复发 | lib/sync-store-factory.ts resolveConflictItem + lib/firebase.ts merge | 用户以为已解决、实际反复弹冲突 | 中 |

## 四、发现的隐患与问题（可注明文件行号）

1. S3 密钥在浏览器端明文落盘：safeStorage 不可用时 sealSecret 显式降级为 plain: 前缀明文（lib/credential-vault.ts L55-61）；设置页有黄色警告（settings-view.tsx L1712-1716）但无强制门槛，同源 XSS 可直接读取。
2. 非数组键永远云端优先：merged[key] = cloudValue !== undefined ? cloudValue : localValue（lib/firebase.ts L324；lib/s3-sync.ts L541）——设备间偏好类设置(sidebarCollapsed、activeSmartList、activeSavedFilterId、dashboardWidgets 等)互相覆盖且不可合并，以最后一次上云者为准。
3. 匿名账号不可找回：Firebase 匿名 UID 持久化在浏览器本地（lib/firebase.ts L180-182）；清除浏览器数据/换设备后云端数据无法关联，UI 虽有提示（settings-view.tsx L1688）但无升级为正式账号的引导。
4. 同步开关不持久、重启静默停止：sync-store/s3-store 均无 persist，重启后 isEnabled=false，需手动点启用（settings-view.tsx L1295）；不启用时本地改动不上云且无提示。
5. 恢复备份不触发云同步：restoreDataToStore 直接用 useAppStore.setState（lib/data-restore.ts L274-276），绕过 cloudSyncMiddleware 的 scheduleCloudSync；恢复后无任何操作即关闭，恢复结果不会推送云端，下次启动云端旧数据反而覆盖本地。
6. 手动拉取合并不回传：设置页拉取流程 pull→merge→setState（settings-view.tsx L1608-1631），合并结果不立即推送；用户随即关闭应用则本次合并没有上云。
7. 备份容量会撑爆 localStorage：最多 10 份整库快照 + 主库 + 配置同存一个 localStorage(约 5MB 配额，components/data-backup.tsx L47-50)；到达上限后 setItem 抛 QuotaExceededError，createBackup 无 try/catch（L52-103），备份功能静默失效。
8. 隐私锁可被本地脚本绕过：隐私哈希与开关同存 localStorage（components/privacy-lock.tsx L128-129、L175-179），可写 localStorage 的脚本/扩展可删除开关键直接绕过遮罩；锁本身不加密数据。
9. 加密备份跨环境迁移会丢凭据：.ffb 导出的是已密封(seal:v1:)的 S3/LLM 凭据（DATA_KEYS 含 focusflow-s3-secret、focusflow-llm-api-key，privacy-lock.tsx L194-202），在无 safeStorage 的环境恢复后 unsealSecret 返回空（lib/credential-vault.ts L76-78），凭据静默失效。
10. 离线恢复无自动补推：network-monitor 的 handleOnline 仅把状态从 offline 改回 idle（lib/network-monitor.ts L17-21），Firebase enableNetwork 后不触发任何同步动作，离线期间改动需等下次用户操作才推送。

## 五、本模块已有亮点

- 双同步后端 + 统一工厂抽象：Firebase(实时推送)与 S3(轮询)共用一套 enable/merge/conflict/手动同步状态机（lib/sync-store-factory.ts），且同一时段只启用一个提供方，架构清晰可扩展（工厂注释已预留 Supabase）。
- 2s 防抖 + 快照内容比对：无内容变化时跳过推送（lib/store/utils.ts L121-128），避免高频 set(如计时器)触发无意义网络请求。
- S3 凭据安全存储与迁移：AccessKey Secret 经 safeStorage 密封落盘，老版本内联明文自动迁移到密封存储（lib/s3-sync.ts L96-120、L152-167）；getS3Config 不返回明文 Secret（L145-150）。
- 持久化防线完备：persist 白名单 + 数组类型校验 + 跨窗口 storage 合并防 ping-pong + 2s 节流落盘与 pagehide 刷盘（lib/store/index.ts L90-217）。
- 连接测试体验好：S3 HEAD 探测区分对象不存在可自动创建，并给出 403/签名不匹配/CORS 的具体解法（lib/s3-sync.ts L390-435）。
- 冲突检测与 UI 齐备：6 类实体差异检测 + 冲突计数面板 + 手动推拉按钮 + 离线状态展示（settings-view.tsx L1310-1368、L1586-1637）。