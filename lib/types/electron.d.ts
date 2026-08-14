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

export interface ElectronAPI {
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  isMaximized: () => Promise<boolean>
  toggleWidget: () => void
  closeWidget: () => void
  quitApp: () => void
  onMenuNavigate: (callback: (view: string) => void) => void
  onMenuNewTask: (callback: () => void) => void
  onMenuQuickAdd: (callback: () => void) => void
  onMenuStartFocus: (callback: () => void) => void
  setFullScreen: (fullscreen: boolean) => void
  isFullScreen: () => Promise<boolean>
  onFullScreenChange: (callback: (isFullScreen: boolean) => void) => void

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
  onTrayTogglePomodoro: (callback: () => void) => void
  onClipboardCapture: (callback: (data: { text: string; type: string }) => void) => void
  onSystemSuspend: (callback: () => void) => void
  onSystemResume: (callback: () => void) => void
  sendPomodoroState: (state?: PomodoroSyncState) => void
  onPomodoroSync: (callback: (state: PomodoroSyncState) => void) => void
  sendFloatControl: (action: string) => void
  onFloatControl: (callback: (action: string) => void) => void
  printToPDF?: (opts: { html: string; fileName: string }) => Promise<{ success: boolean }>

  // 凭据安全存储（safeStorage）
  credentialVaultAvailable: () => Promise<boolean>
  credentialEncrypt: (plain: string) => Promise<string>
  credentialDecrypt: (sealed: string) => Promise<string>
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
