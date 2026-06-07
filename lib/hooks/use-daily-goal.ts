'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'

/**
 * 监听每日目标达成情况：
 * - 当今日首次达成时返回 { justReached: true }
 * - 用 localStorage 记忆今天是否已庆祝过，避免重复弹窗
 */
export function useDailyGoalWatcher() {
  const { focusGoals, pomodoroSessions } = useAppStore()
  const [show, setShow] = useState(false)
  const [streakDays, setStreakDays] = useState(0)

  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayMs = today.getTime()

    const workToday = pomodoroSessions.filter((s) => {
      if (s.type !== 'work') return false
      return new Date(s.completedAt).getTime() >= todayMs
    })
    const count = workToday.length
    const minutes = Math.round(workToday.reduce((acc, s) => acc + s.duration / 60, 0))

    const pomodoroRatio = count / Math.max(1, focusGoals.dailyPomodoros)
    const minuteRatio = minutes / Math.max(1, focusGoals.dailyMinutes)
    const reached = pomodoroRatio * 0.6 + minuteRatio * 0.4 >= 1

    if (!reached) return

    const dateKey = today.toISOString().slice(0, 10)
    const key = 'focusflow-goal-celebrated'
    let celebratedDates: string[] = []
    try {
      celebratedDates = JSON.parse(localStorage.getItem(key) || '[]')
    } catch {
      celebratedDates = []
    }
    if (celebratedDates.includes(dateKey)) return

    celebratedDates.push(dateKey)
    celebratedDates = celebratedDates.slice(-30)
    localStorage.setItem(key, JSON.stringify(celebratedDates))

    // 计算连续达成天数
    let streak = 1
    const d = new Date(today)
    for (let i = 1; i < 30; i++) {
      d.setDate(d.getDate() - 1)
      const k = d.toISOString().slice(0, 10)
      if (!celebratedDates.includes(k)) break
      streak++
    }
    setStreakDays(streak)
    setShow(true)
  }, [pomodoroSessions, focusGoals.dailyPomodoros, focusGoals.dailyMinutes])

  return { show, setShow, streakDays }
}
