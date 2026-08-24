export interface PomodoroSyncState {
  timeLeft: number
  totalDuration: number
  isRunning: boolean
  mode: 'work' | 'short-break' | 'long-break'
}

export interface ShieldStatus {
  active: boolean
  websitesBlocked: string[]
  appsBlocked: string[]
}

export interface ActivitySampleData {
  app: string
  title: string
  intervalSec: number
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
  ) => Promise<{ success: boolean; mode?: string }>
  shieldStop: () => Promise<{ success: boolean; mode: string }>
  shieldUpdate: (
    websites: string[],
    apps: string[],
    mode?: string
  ) => Promise<{ success: boolean }>
  shieldStatus: () => Promise<ShieldStatus>

  notify: (options: { title: string; body: string }) => Promise<void>
  setAutoLaunch: (enabled: boolean) => Promise<boolean>
  getAutoLaunch: () => Promise<boolean>
  setAutoStart: (enabled: boolean) => Promise<boolean>
  getAutoStart: () => Promise<boolean>
  reportTrayState: (state: { todayCount?: number; pomodoroStatus?: string }) => void
  toggleTimerFloat: () => void
  closeTimerFloat: () => void
  getAppVersion: () => Promise<string>
  onTrayTogglePomodoro: (callback: () => void) => (() => void) | undefined
  onClipboardCapture: (callback: (data: { text: string; type: string }) => void) => (() => void) | undefined
  onSystemSuspend: (callback: () => void) => (() => void) | undefined
  onSystemResume: (callback: () => void) => (() => void) | undefined
  sendPomodoroState: (state?: PomodoroSyncState) => void
  onPomodoroSync: (callback: (state: PomodoroSyncState) => void) => (() => void) | undefined
  sendFloatControl: (action: string) => void
  onFloatControl: (callback: (action: string) => void) => (() => void) | undefined
  printToPDF?: (opts: { html: string; fileName: string }) => Promise<{ success: boolean }>

  // 凭据安全存储（safeStorage）
  credentialVaultAvailable: () => Promise<boolean>
  credentialEncrypt: (plain: string) => Promise<string>
  credentialDecrypt: (sealed: string) => Promise<string>

  // 自动时间线追踪（仅 Windows 生效，本地存储）
  setActivityTracking?: (enabled: boolean) => void
  onActivitySample?: (callback: (data: ActivitySampleData) => void) => (() => void) | undefined
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
    webkitAudioContext?: typeof AudioContext
    __openQuickCapture?: () => void
    __openKeyboardShortcuts?: () => void
    __openDailyReview?: () => void
    __SYNC_DATA__?: Record<string, unknown>
  }
}

export {}
