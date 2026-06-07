import { useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
}

export function useKeyboardShortcuts() {
  const {
    setActiveView,
    tasks,
    addTask,
    stopTimeEntry,
    activeTimeEntry,
    toggleSidebar,
    sidebarCollapsed,
    activeView,
    pomodoroTimerState,
    updatePomodoroTimerState,
    pomodoroSettings,
    isFullscreen,
    setIsFullscreen,
  } = useAppStore()

  const shortcuts: Shortcut[] = [
    {
      key: 'n',
      ctrl: true,
      action: () => {
        const input = document.querySelector<HTMLInputElement>('[data-task-input]')
        if (input) input.focus()
      },
      description: '新建任务',
    },
    {
      key: 't',
      ctrl: true,
      action: () => setActiveView('tasks'),
      description: '跳转到任务',
    },
    {
      key: 'p',
      ctrl: true,
      action: () => setActiveView('focus'),
      description: '跳转到专注',
    },
    {
      key: 'h',
      ctrl: true,
      action: () => setActiveView('habits'),
      description: '跳转到习惯',
    },
    {
      key: 'g',
      ctrl: true,
      action: () => setActiveView('goals'),
      description: '跳转到目标',
    },
    {
      key: 'a',
      ctrl: true,
      action: () => setActiveView('analytics'),
      description: '跳转到分析',
    },
    {
      key: 's',
      ctrl: true,
      action: () => setActiveView('settings'),
      description: '跳转到设置',
    },
    {
      key: 'd',
      ctrl: true,
      action: () => setActiveView('dashboard'),
      description: '跳转到仪表板',
    },
    {
      key: 'b',
      ctrl: true,
      action: () => toggleSidebar(),
      description: '切换侧边栏',
    },
    {
      key: ' ',
      ctrl: true,
      action: () => {
        if (activeTimeEntry) {
          stopTimeEntry()
        }
      },
      description: '停止计时',
    },
    {
      key: '/',
      action: () => {
        const searchBtn = document.querySelector<HTMLButtonElement>('[data-search-trigger]')
        if (searchBtn) searchBtn.click()
      },
      description: '打开搜索',
    },
    {
      key: '?',
      shift: true,
      action: () => {
        const shortcutsDialog = document.querySelector<HTMLButtonElement>('[data-shortcuts-trigger]')
        if (shortcutsDialog) shortcutsDialog.click()
      },
      description: '显示快捷键帮助',
    },
    {
      key: '1',
      ctrl: true,
      action: () => setActiveView('dashboard'),
      description: '跳转到仪表板',
    },
    {
      key: '2',
      ctrl: true,
      action: () => setActiveView('tasks'),
      description: '跳转到任务',
    },
    {
      key: '3',
      ctrl: true,
      action: () => setActiveView('focus'),
      description: '跳转到专注',
    },
    {
      key: '4',
      ctrl: true,
      action: () => setActiveView('habits'),
      description: '跳转到习惯',
    },
    {
      key: '5',
      ctrl: true,
      action: () => setActiveView('goals'),
      description: '跳转到目标',
    },
    {
      key: 'a',
      ctrl: true,
      shift: true,
      action: () => {
        if (typeof window !== 'undefined') {
          ;(window as any).__openQuickCapture?.()
        }
      },
      description: '快速捕获任务',
    },
  ]

  // 番茄钟快捷键（仅在专注页生效，且不在全屏模式时由全屏页内部处理）
  const pomodoroShortcuts: Shortcut[] = [
    {
      key: ' ',
      action: () => {
        if (isFullscreen) return
        if (activeView !== 'focus') return
        updatePomodoroTimerState({ isRunning: !pomodoroTimerState.isRunning })
      },
      description: '开始/暂停番茄钟',
    },
    {
      key: 'r',
      action: () => {
        if (isFullscreen) return
        if (activeView !== 'focus') return
        const mode = pomodoroTimerState.mode
        const totalDuration =
          mode === 'work'
            ? pomodoroSettings.workDuration
            : mode === 'short-break'
            ? pomodoroSettings.shortBreakDuration
            : pomodoroSettings.longBreakDuration
        updatePomodoroTimerState({ isRunning: false, timeLeft: totalDuration })
      },
      description: '重置番茄钟',
    },
    {
      key: 's',
      action: () => {
        if (isFullscreen) return
        if (activeView !== 'focus') return
        const mode = pomodoroTimerState.mode
        const completedSessions = pomodoroTimerState.completedSessions
        if (mode === 'work') {
          const nextBreak = (completedSessions + 1) % pomodoroSettings.sessionsBeforeLongBreak === 0
          updatePomodoroTimerState({
            isRunning: false,
            mode: nextBreak ? 'long-break' : 'short-break',
            timeLeft: nextBreak ? pomodoroSettings.longBreakDuration : pomodoroSettings.shortBreakDuration,
          })
        } else {
          updatePomodoroTimerState({
            isRunning: false,
            mode: 'work',
            timeLeft: pomodoroSettings.workDuration,
          })
        }
      },
      description: '跳过当前阶段',
    },
    {
      key: 'f',
      action: () => {
        if (activeView !== 'focus') return
        if (!isFullscreen) {
          setIsFullscreen(true)
          if (typeof window !== 'undefined' && window.electronAPI?.setFullScreen) {
            window.electronAPI.setFullScreen(true)
          } else if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {
              setIsFullscreen(false)
            })
          } else {
            setIsFullscreen(false)
          }
        } else {
          setIsFullscreen(false)
          if (typeof window !== 'undefined' && window.electronAPI?.setFullScreen) {
            window.electronAPI.setFullScreen(false)
          } else if (document.fullscreenElement) {
            document.exitFullscreen()
          }
        }
      },
      description: '切换全屏专注模式',
    },
    {
      key: '1',
      action: () => {
        if (isFullscreen) return
        if (activeView !== 'focus') return
        updatePomodoroTimerState({
          mode: 'work',
          timeLeft: pomodoroSettings.workDuration,
        })
      },
      description: '切换到专注模式',
    },
    {
      key: '2',
      action: () => {
        if (isFullscreen) return
        if (activeView !== 'focus') return
        updatePomodoroTimerState({
          mode: 'short-break',
          timeLeft: pomodoroSettings.shortBreakDuration,
        })
      },
      description: '切换到短休息',
    },
    {
      key: '3',
      action: () => {
        if (isFullscreen) return
        if (activeView !== 'focus') return
        updatePomodoroTimerState({
          mode: 'long-break',
          timeLeft: pomodoroSettings.longBreakDuration,
        })
      },
      description: '切换到长休息',
    },
  ]

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      if (e.key === 'Escape') {
        ;(e.target as HTMLElement).blur()
      }
      return
    }

    const allShortcuts = [...shortcuts, ...pomodoroShortcuts]
    for (const shortcut of allShortcuts) {
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
      const altMatch = shortcut.alt ? e.altKey : !e.altKey
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        e.preventDefault()
        shortcut.action()
        break
      }
    }
  }, [shortcuts, pomodoroShortcuts, activeTimeEntry, stopTimeEntry, activeView, pomodoroTimerState, pomodoroSettings, isFullscreen])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { shortcuts }
}

export const SHORTCUT_LIST = [
  { keys: ['Ctrl', 'N'], description: '新建任务' },
  { keys: ['Ctrl', 'Shift', 'A'], description: '快速捕获任务' },
  { keys: ['Ctrl', '1-5'], description: '快速切换视图' },
  { keys: ['Ctrl', 'T'], description: '跳转到任务' },
  { keys: ['Ctrl', 'P'], description: '跳转到专注' },
  { keys: ['Ctrl', 'H'], description: '跳转到习惯' },
  { keys: ['Ctrl', 'G'], description: '跳转到目标' },
  { keys: ['Ctrl', 'A'], description: '跳转到分析' },
  { keys: ['Ctrl', 'D'], description: '跳转到仪表板' },
  { keys: ['Ctrl', 'S'], description: '跳转到设置' },
  { keys: ['Ctrl', 'B'], description: '切换侧边栏' },
  { keys: ['Ctrl', 'Space'], description: '停止计时' },
  { keys: ['/'], description: '打开搜索' },
  { keys: ['?'], description: '显示快捷键帮助' },
  { keys: ['Esc'], description: '关闭弹窗/取消编辑' },
  { keys: ['Space'], description: '专注页：开始/暂停番茄钟' },
  { keys: ['R'], description: '专注页：重置番茄钟' },
  { keys: ['S'], description: '专注页：跳过当前阶段' },
  { keys: ['F'], description: '专注页：切换全屏专注模式' },
  { keys: ['1'], description: '专注页：切换到专注模式' },
  { keys: ['2'], description: '专注页：切换到短休息' },
  { keys: ['3'], description: '专注页：切换到长休息' },
]
