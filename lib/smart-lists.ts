'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import type { Task } from '@/lib/types'
import { isRepeatTaskCompletedToday } from '@/lib/hooks'
import type { RepeatTaskCompletion } from '@/lib/types'

export interface SmartList {
  id: string
  name: string
  icon: string
  color: string
  filter: (tasks: Task[]) => Task[]
  count: number
}

function isRepeatTaskDueForDate(t: Task, targetDate: Date, mode: 'equal' | 'lte' | 'range' = 'lte', endDate?: Date): boolean {
  if (!t.repeatRule) return false
  if (t.repeatRule.paused) return false
  if (t.repeatRule.endDate && new Date(t.repeatRule.endDate) < new Date()) return false
  if (!t.dueDate) return true
  const dueDate = new Date(t.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)

  switch (mode) {
    case 'equal':
      return dueDate.getTime() === target.getTime()
    case 'range':
      return dueDate >= target && dueDate <= (endDate ? endDate : target)
    case 'lte':
    default:
      return dueDate <= target
  }
}

export function useSmartLists() {
  // 用 useShallow 只订阅 tasks/repeatCompletions，避免整个 store 的每次 setState 都触发重渲染
  const { tasks, repeatCompletions } = useAppStore(
    useShallow((state) => ({
      tasks: state.tasks,
      repeatCompletions: state.repeatCompletions,
    }))
  )

  const [dateKey, setDateKey] = useState(() => new Date().toDateString())

  useEffect(() => {
    const checkDateChange = () => {
      const currentKey = new Date().toDateString()
      if (currentKey !== dateKey) {
        setDateKey(currentKey)
      }
    }
    const interval = setInterval(checkDateChange, 60000)
    return () => clearInterval(interval)
  }, [dateKey])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [dateKey])

  const tomorrow = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return d
  }, [today])

  const next7Days = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    return d
  }, [today])

  const smartLists: SmartList[] = useMemo(() => {
    const lists: SmartList[] = [
      {
        id: 'today',
        name: '今天',
        icon: '📅',
        color: '#4A90E2',
        filter: (tasks: Task[]) => tasks.filter(t => {
          if (t.status === 'done' && !t.repeatRule) return false
          if (t.repeatRule) {
            if (isRepeatTaskCompletedToday(t, repeatCompletions)) return true
            return isRepeatTaskDueForDate(t, today, 'lte')
          }
          if (!t.dueDate) return false
          const dueDate = new Date(t.dueDate)
          dueDate.setHours(0, 0, 0, 0)
          return dueDate.getTime() === today.getTime()
        }),
        count: 0,
      },
      {
        id: 'tomorrow',
        name: '明天',
        icon: '📆',
        color: '#7ED321',
        filter: (tasks: Task[]) => tasks.filter(t => {
          if (t.status === 'done' && !t.repeatRule) return false
          if (t.repeatRule) return isRepeatTaskDueForDate(t, tomorrow, 'equal')
          if (!t.dueDate) return false
          const dueDate = new Date(t.dueDate)
          dueDate.setHours(0, 0, 0, 0)
          return dueDate.getTime() === tomorrow.getTime()
        }),
        count: 0,
      },
      {
        id: 'next7days',
        name: '最近7天',
        icon: '📊',
        color: '#F5A623',
        filter: (tasks: Task[]) => tasks.filter(t => {
          if (t.status === 'done' && !t.repeatRule) return false
          if (t.repeatRule) return isRepeatTaskDueForDate(t, today, 'range', next7Days)
          if (!t.dueDate) return false
          const dueDate = new Date(t.dueDate)
          dueDate.setHours(0, 0, 0, 0)
          return dueDate >= today && dueDate <= next7Days
        }),
        count: 0,
      },
      {
        id: 'overdue',
        name: '已逾期',
        icon: '⚠️',
        color: '#E91E63',
        filter: (tasks: Task[]) => tasks.filter(t => {
          if (t.status === 'done' && !t.repeatRule) return false
          if (t.repeatRule) {
            if (!t.dueDate) return false
            const dueDate = new Date(t.dueDate)
            dueDate.setHours(0, 0, 0, 0)
            return dueDate < today
          }
          if (!t.dueDate) return false
          const dueDate = new Date(t.dueDate)
          dueDate.setHours(0, 0, 0, 0)
          return dueDate < today
        }),
        count: 0,
      },
      {
        id: 'inbox',
        name: '收集箱',
        icon: '📥',
        color: '#9B59B6',
        filter: (tasks: Task[]) => tasks.filter(t => {
          if (t.status === 'done' && !t.repeatRule) return false
          return !t.project && t.tags.length === 0
        }),
        count: 0,
      },
      {
        id: 'completed',
        name: '已完成',
        icon: '✅',
        color: '#00CED1',
        filter: (tasks: Task[]) => tasks.filter(t => {
          if (t.repeatRule) return false
          return t.status === 'done'
        }),
        count: 0,
      },
      {
        id: 'all',
        name: '所有任务',
        icon: '📋',
        color: '#607D8B',
        filter: (tasks: Task[]) => tasks.filter(t => {
          if (t.repeatRule) return true
          return t.status !== 'done'
        }),
        count: 0,
      },
    ]

    return lists.map(list => ({
      ...list,
      count: list.filter(tasks).length,
    }))
  }, [tasks, repeatCompletions, today, tomorrow, next7Days])

  // 稳定引用，避免下游 useMemo 依赖被每次渲染的新函数击穿
  const getSmartListTasks = useCallback(
    (listId: string) => {
      const list = smartLists.find(l => l.id === listId)
      return list ? list.filter(tasks) : []
    },
    [smartLists, tasks]
  )

  return { smartLists, getSmartListTasks }
}
