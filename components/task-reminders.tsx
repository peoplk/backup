'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Bell, X, Plus, Clock, Calendar } from 'lucide-react'
import type { TaskReminder, Task } from '@/lib/types'

interface TaskRemindersProps {
  task?: Task
  // 用于"新增任务"弹窗中的本地状态
  reminders?: TaskReminder[]
  onChange?: (reminders: TaskReminder[]) => void
  hasDueDate?: boolean
}

type ReminderMode = 'preset' | 'custom' | 'before-due'

const PRESET_TIMES = [
  { label: '同时 (到点)', minutes: 0, type: 'on-due' as const },
  { label: '提前 5 分钟', minutes: 5, type: 'before-due' as const },
  { label: '提前 15 分钟', minutes: 15, type: 'before-due' as const },
  { label: '提前 30 分钟', minutes: 30, type: 'before-due' as const },
  { label: '提前 1 小时', minutes: 60, type: 'before-due' as const },
  { label: '提前 2 小时', minutes: 120, type: 'before-due' as const },
  { label: '提前 1 天', minutes: 1440, type: 'before-due' as const },
]

function formatReminderTime(r: TaskReminder): string {
  if (r.type === 'absolute' && r.triggerAt) {
    const d = new Date(r.triggerAt)
    return d.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  if (r.type === 'before-due' && r.minutesBefore != null) {
    const m = r.minutesBefore
    if (m >= 1440) return `截止前 ${Math.floor(m / 1440)} 天`
    if (m >= 60) return `截止前 ${Math.floor(m / 60)} 小时${m % 60 ? ` ${m % 60} 分` : ''}`
    return `截止前 ${m} 分钟`
  }
  return '到时提醒'
}

function toLocalISO(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function TaskReminders(props: TaskRemindersProps) {
  const { task, reminders: controlledReminders, onChange, hasDueDate: hasDueDateProp } = props
  const { addTaskReminder, updateTaskReminder, removeTaskReminder } = useAppStore()

  const isControlled = controlledReminders !== undefined && !!onChange
  const reminders: TaskReminder[] = isControlled
    ? controlledReminders!
    : task?.reminders || []

  const [showAdd, setShowAdd] = useState(false)
  const [mode, setMode] = useState<ReminderMode>('preset')
  const [customTime, setCustomTime] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() + 1, 0, 0, 0)
    return toLocalISO(d)
  })

  const hasDueDate = hasDueDateProp ?? (isControlled ? false : !!task?.dueDate)

  const addReminder = (r: Omit<TaskReminder, 'id'>) => {
    const newR: TaskReminder = { ...r, id: generateTempId() }
    if (isControlled) {
      onChange!([...reminders, newR])
    } else if (task) {
      addTaskReminder(task.id, r)
    }
  }

  const updateReminder = (id: string, updates: Partial<TaskReminder>) => {
    if (isControlled) {
      onChange!(reminders.map(r => (r.id === id ? { ...r, ...updates } : r)))
    } else if (task) {
      updateTaskReminder(task.id, id, updates)
    }
  }

  const removeReminder = (id: string) => {
    if (isControlled) {
      onChange!(reminders.filter(r => r.id !== id))
    } else if (task) {
      removeTaskReminder(task.id, id)
    }
  }

  const handleAddBeforeDue = (minutes: number) => {
    addReminder({
      type: 'before-due',
      minutesBefore: minutes,
      enabled: true,
      triggered: false,
    })
    setShowAdd(false)
  }

  const handleAddOnDue = () => {
    addReminder({
      type: 'on-due',
      enabled: true,
      triggered: false,
    })
    setShowAdd(false)
  }

  const handleAddAbsolute = () => {
    const dt = new Date(customTime)
    if (isNaN(dt.getTime())) return
    addReminder({
      type: 'absolute',
      triggerAt: dt,
      enabled: true,
      triggered: false,
    })
    setShowAdd(false)
  }

  const toggleEnabled = (r: TaskReminder) => {
    updateReminder(r.id, { enabled: !r.enabled, triggered: false })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <Bell className="w-4 h-4" />
        <span className="font-medium">提醒</span>
        {reminders.length > 0 && (
          <span className="text-xs text-slate-400">({reminders.length} 个)</span>
        )}
      </div>

      {reminders.length === 0 && !showAdd && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full text-left text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />
          添加提醒
        </button>
      )}

      {reminders.length > 0 && (
        <ul className="space-y-1.5">
          {reminders.map(r => (
            <li
              key={r.id}
              className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={() => toggleEnabled(r)}
                className="rounded"
                aria-label="启用提醒"
              />
              {r.type === 'absolute' ? (
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span
                className={`flex-1 ${
                  r.enabled ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 line-through'
                }`}
              >
                {formatReminderTime(r)}
                {r.triggered && (
                  <span className="ml-2 text-xs text-emerald-500">已发送</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => removeReminder(r.id)}
                className="text-slate-400 hover:text-red-500"
                aria-label="删除提醒"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
          {!showAdd && (
            <li>
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="w-full text-left text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" />
                再添加一个
              </button>
            </li>
          )}
        </ul>
      )}

      {showAdd && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-3">
          <div className="flex gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setMode('preset')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                mode === 'preset'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              相对截止
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                mode === 'custom'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              绝对时间
            </button>
          </div>

          {mode === 'preset' ? (
            <div className="space-y-1.5">
              {!hasDueDate && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  请先设置截止日期
                </p>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_TIMES.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      p.type === 'on-due' ? handleAddOnDue() : handleAddBeforeDue(p.minutes)
                    }
                    disabled={!hasDueDate}
                    className="text-xs px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-600 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="datetime-local"
                value={customTime}
                onChange={e => setCustomTime(e.target.value)}
                className="w-full text-sm px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
              <button
                type="button"
                onClick={handleAddAbsolute}
                className="w-full text-sm bg-blue-500 hover:bg-blue-600 text-white rounded px-3 py-1.5"
              >
                添加绝对时间提醒
              </button>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

