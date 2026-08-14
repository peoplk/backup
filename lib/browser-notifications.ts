'use client'

let permissionGranted = false

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }

  if (Notification.permission === 'granted') {
    permissionGranted = true
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  const permission = await Notification.requestPermission()
  permissionGranted = permission === 'granted'
  return permissionGranted
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function isNotificationGranted(): boolean {
  return isNotificationSupported() && Notification.permission === 'granted'
}

export function sendBrowserNotification(
  title: string,
  options?: {
    body?: string
    icon?: string
    tag?: string
    requireInteraction?: boolean
    silent?: boolean
    data?: Record<string, unknown>
    onClick?: () => void
  }
): void {
  const electronAPI = (typeof window !== 'undefined' ? window.electronAPI : null) as
    | { notify?: (opts: { title: string; body?: string; tag?: string }) => Promise<boolean> }
    | null

  if (electronAPI?.notify) {
    electronAPI
      .notify({
        title,
        body: options?.body,
        tag: options?.tag,
      })
      .catch(() => { /* notification may be blocked */ })
    return
  }

  if (!isNotificationGranted()) return

  try {
    const notification = new Notification(title, {
      body: options?.body,
      icon: options?.icon || '/favicon.ico',
      tag: options?.tag,
      requireInteraction: options?.requireInteraction || false,
      silent: options?.silent || false,
      data: options?.data,
    })

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus()
        options.onClick?.()
        notification.close()
      }
    }

    setTimeout(() => notification.close(), 8000)
  } catch {
    // Service Worker fallback
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body: options?.body,
          icon: options?.icon || '/favicon.ico',
          tag: options?.tag,
          requireInteraction: options?.requireInteraction || false,
          silent: options?.silent || false,
          data: options?.data,
        })
      })
    }
  }
}

export function notifyPomodoroComplete(durationMinutes: number, taskTitle?: string): void {
  const emojis = ['🎉', '✅', '🌟', '💪', '🔥', '🏆']
  const emoji = emojis[Math.floor(Math.random() * emojis.length)]
  const messages = [
    '太棒了，继续保持！',
    '又一个番茄钟完成，你离目标更近了！',
    '专注是通往成功的捷径！',
    '每一步积累都是成长！',
    '你已经超越了昨天的自己！',
  ]
  const message = messages[Math.floor(Math.random() * messages.length)]

  sendBrowserNotification(`${emoji} 番茄钟完成！`, {
    body: taskTitle
      ? `完成了「${taskTitle}」的 ${durationMinutes} 分钟专注\n${message}`
      : `${durationMinutes} 分钟专注完成！\n${message}`,
    tag: 'pomodoro-complete',
    requireInteraction: false,
  })
}

export function notifyBreakComplete(nextMode: 'work' | 'long-break'): void {
  if (nextMode === 'work') {
    sendBrowserNotification('☕ 休息结束，准备继续专注！', {
      body: '休息时间到，是时候开始下一个番茄钟了！',
      tag: 'break-complete',
      requireInteraction: false,
    })
  }
}

export function notifyAchievement(name: string, description: string): void {
  sendBrowserNotification(`🏆 成就解锁：${name}`, {
    body: description,
    tag: 'achievement',
    requireInteraction: false,
  })
}

export function notifyDailyGoalReached(goalMinutes: number): void {
  sendBrowserNotification('🎯 每日目标达成！', {
    body: `恭喜！你今天已经专注了 ${goalMinutes} 分钟，达成了每日目标！`,
    tag: 'daily-goal',
    requireInteraction: false,
  })
}

export function notifyStreakMilestone(streak: number): void {
  const messages: Record<number, string> = {
    7: '一周连续专注，习惯正在养成！',
    14: '两周坚持，自律正在成为你的标签！',
    30: '一个月的连续专注，你已经与众不同！',
    60: '两个月的坚持，你是专注的榜样！',
    90: '90天连续专注，习惯已深入骨髓！',
  }

  if (messages[streak]) {
    sendBrowserNotification(`🔥 连续专注 ${streak} 天！`, {
      body: messages[streak],
      tag: 'streak-milestone',
      requireInteraction: false,
    })
  }
}
