export interface PomodoroSyncState {
  timeLeft: number
  totalDuration: number
  isRunning: boolean
  mode: 'work' | 'short-break' | 'long-break'
}

/** hosts 写入自检结果。reason 为 'ok' 之外的值都意味着屏蔽没有真正生效。 */
export interface ShieldHealth {
  ok: boolean
  reason:
    | 'ok'
    | 'uac_declined'
    | 'write_failed'
    | 'reverted'
    | 'exception'
    | 'never_run'
    | 'stopped'
    | 'denied'
  elevated: boolean
  verified: boolean
  blockedCount: number
  at: number | null
}

export interface ShieldStatus {
  active: boolean
  websitesBlocked: string[]
  appsBlocked: string[]
  health?: ShieldHealth
}

export interface ActivitySampleData {
  app: string
  title: string
  intervalSec: number
}

export interface ActivityStatusData {
  state: 'idle' | 'sampling' | 'unsupported' | 'error'
  message?: string
}

/** 主进程可配置全局快捷键的快照项 */
export interface GlobalShortcutInfo {
  id: string
  label: string
  /** 出厂默认组合 */
  default: string
  /** 当前生效组合 */
  accelerator: string
  /** 是否注册成功（false = 与其他应用冲突） */
  registered: boolean
}

export interface UpdateCheckResult {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'unavailable'
  version?: string | null
  message?: string
}

export interface ReminderJobPayload {
  key: string
  fireAt: number
  title: string
  body?: string
  meta?: { kind?: 'task' | 'habit' | 'review' | 'goal'; taskId?: string; reminderId?: string; habitId?: string; goalId?: string }
}

export interface ElectronAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  isMaximized: () => Promise<boolean>
  toggleWidget: () => void
  closeWidget: () => void
  quitApp: () => void
  onMenuNavigate: (callback: (view: string) => void) => (() => void) | undefined
  onMenuNewTask: (callback: () => void) => (() => void) | undefined
  onMenuQuickAdd: (callback: () => void) => (() => void) | undefined
  onMenuStartFocus: (callback: () => void) => (() => void) | undefined
  setFullScreen: (fullscreen: boolean) => void
  isFullScreen: () => Promise<boolean>
  onFullScreenChange: (callback: (isFullScreen: boolean) => void) => (() => void) | undefined

  shieldStart: (
    websites: string[],
    apps: string[],
    mode?: string
  ) => Promise<{ success: boolean; mode?: string; health?: ShieldHealth }>
  shieldStop: () => Promise<{ success: boolean; mode: string }>
  shieldUpdate: (
    websites: string[],
    apps: string[],
    mode?: string
  ) => Promise<{ success: boolean }>
  shieldStatus: () => Promise<ShieldStatus>
  /** 自检 / 重试：屏蔽中重放一次 hosts 写入，未激活时只回读。返回最新自检结果 */
  shieldVerify?: () => Promise<ShieldHealth>
  /** 把定时封锁窗口清单推送到主进程调度器（主进程负责边界启停与崩溃重放） */
  shieldScheduleSync?: (
    windows: Array<{
      id: string
      start: string
      end: string
      days?: number[]
      websites: string[]
      apps: string[]
      mode: string
    }>
  ) => Promise<{ success: boolean }>
  /** 主进程屏蔽状态变化广播（窗口启停/会话到期） */
  onShieldStatusChanged?: (
    callback: (payload: { type: string; reason?: string; active?: boolean }) => void
  ) => (() => void) | undefined

  notify: (options: {
    title: string
    body: string
    tag?: string | null
    requireInteraction?: boolean
    /** Windows 原生通知动作按钮文案，点击结果经 onNotifyAction 回传 */
    actions?: string[]
  }) => Promise<boolean>
  onNotifyAction?: (
    callback: (payload: { tag: string | null; index: number }) => void
  ) => (() => void) | undefined
  setAutoLaunch: (enabled: boolean) => Promise<boolean>
  getAutoLaunch: () => Promise<boolean>
  setAutoStart: (enabled: boolean) => Promise<boolean>
  getAutoStart: () => Promise<boolean>
  reportTrayState: (state: {
    todayCount?: number
    pomodoroStatus?: string
    todaySessions?: number
    todayFocusMinutes?: number
  }) => void
  /** 桌面小组件置顶开关（窗口真实跟随，不再只是本地状态） */
  setWidgetPinned?: (pinned: boolean) => void
  /** 普通专注期间保持屏幕常亮（独立于严格模式的防休眠） */
  setKeepAwake?: (enabled: boolean) => void
  shortcutsGet?: () => Promise<GlobalShortcutInfo[]>
  shortcutsSet?: (map: Record<string, string>) => Promise<{ success: boolean; message?: string; shortcuts?: GlobalShortcutInfo[] }>
  updateCheck?: () => Promise<UpdateCheckResult>
  updateDownload?: () => Promise<UpdateCheckResult>
  updateInstall?: () => Promise<boolean>
  updateState?: () => Promise<UpdateCheckResult>
  onUpdateDownloaded?: (
    callback: (payload: { version?: string | null }) => void
  ) => (() => void) | undefined
  toggleTimerFloat: () => void
  closeTimerFloat: () => void
  getAppVersion: () => Promise<string>
  onTrayTogglePomodoro: (callback: () => void) => (() => void) | undefined
  onClipboardCapture: (callback: (data: { text: string; type: string }) => void) => (() => void) | undefined
  onSystemSuspend: (callback: () => void) => (() => void) | undefined
  onSystemResume: (callback: () => void) => (() => void) | undefined
  sendPomodoroState: (state?: PomodoroSyncState) => void
  remindersSync?: (jobs: ReminderJobPayload[]) => void
  onReminderFired?: (callback: (job: ReminderJobPayload) => void) => (() => void) | undefined
  onPomodoroSync: (callback: (state: PomodoroSyncState) => void) => (() => void) | undefined
  sendFloatControl: (action: string) => void
  onFloatControl: (callback: (action: string) => void) => (() => void) | undefined
  printToPDF?: (opts: { html: string; fileName: string }) => Promise<{ success: boolean }>
  saveTextFile?: (opts: { content: string; fileName: string; extension?: string }) => Promise<{
    success: boolean
    filePath?: string
    canceled?: boolean
    message?: string
  }>

  // 凭据安全存储（safeStorage）
  credentialVaultAvailable: () => Promise<boolean>
  credentialEncrypt: (plain: string) => Promise<string>
  credentialDecrypt: (sealed: string) => Promise<string>

  // 自动时间线追踪（仅 Windows 生效，本地存储）
  setActivityTracking?: (enabled: boolean) => void
  onActivitySample?: (callback: (data: ActivitySampleData) => void) => (() => void) | undefined
  onActivityStatus?: (callback: (data: ActivityStatusData) => void) => (() => void) | undefined

  // 全屏严格模式：主进程级窗口锁定（kiosk + 置顶 + 防休眠 + 拦截退出）
  setStrictLock?: (opts: {
    locked: boolean
    preventSleep?: boolean
    /** 锁定原因，仅用于日志与事件回传 */
    reason?: string
  }) => Promise<{ success: boolean; locked?: boolean; supported?: boolean }>
  getStrictLockStatus?: () => Promise<{ locked: boolean; supported: boolean }>
  /** 用户尝试绕过锁定（Esc 退出全屏 / 关闭窗口 / 窗口失焦）时的回传 */
  onStrictLockViolation?: (
    callback: (payload: { reason: 'leave-fullscreen' | 'close' | 'blur' }) => void
  ) => (() => void) | undefined
  /** 主进程侧状态变化（如托盘紧急解锁）广播 */
  onStrictLockChanged?: (callback: (payload: { locked: boolean }) => void) => (() => void) | undefined
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
    webkitAudioContext?: typeof AudioContext
    __openQuickCapture?: () => void
    __openKeyboardShortcuts?: () => void
    __openDailyReview?: () => void
    __openOnboarding?: () => void
    __SYNC_DATA__?: Record<string, unknown>
  }
}

export {}
