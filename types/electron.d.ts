declare global {
  interface Window {
    electronAPI?: {
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      isMaximized: () => Promise<boolean>
      toggleWidget: () => void
      closeWidget: () => void
      onMenuNavigate: (callback: (view: string) => void) => void
      onMenuNewTask: (callback: () => void) => void
      onMenuQuickAdd: (callback: () => void) => void
      onMenuStartFocus: (callback: () => void) => void
      setFullScreen: (fullscreen: boolean) => void
      isFullScreen: () => Promise<boolean>
      onFullScreenChange: (callback: (isFullScreen: boolean) => void) => void
      setAutoStart: (enable: boolean) => Promise<void>
      getAutoStart: () => Promise<boolean>
    }
  }
}

export {}
