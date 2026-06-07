'use client'

import { Calendar, X } from 'lucide-react'

interface QuickDatePresetsProps {
  value?: Date
  onChange: (date: Date | undefined) => void
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function isSameDay(a: Date | undefined, b: Date | undefined): boolean {
  if (!a || !b) return false
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

const PRESETS = [
  {
    key: 'today',
    label: '今天',
    compute: () => startOfDay(new Date()),
  },
  {
    key: 'tomorrow',
    label: '明天',
    compute: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return startOfDay(d)
    },
  },
  {
    key: 'day-after',
    label: '后天',
    compute: () => {
      const d = new Date()
      d.setDate(d.getDate() + 2)
      return startOfDay(d)
    },
  },
  {
    key: 'this-weekend',
    label: '本周六',
    compute: () => {
      const d = new Date()
      const day = d.getDay() // 0=Sun, 6=Sat
      const offset = (6 - day + 7) % 7 || 7
      d.setDate(d.getDate() + (day === 6 ? 0 : offset))
      return startOfDay(d)
    },
  },
  {
    key: 'next-week',
    label: '下周一',
    compute: () => {
      const d = new Date()
      const day = d.getDay() === 0 ? 7 : d.getDay()
      d.setDate(d.getDate() + (8 - day))
      return startOfDay(d)
    },
  },
  {
    key: 'next-month',
    label: '下个月',
    compute: () => {
      const d = new Date()
      d.setMonth(d.getMonth() + 1, 1)
      return startOfDay(d)
    },
  },
  {
    key: 'no-date',
    label: '无日期',
    compute: () => undefined,
    clear: true,
  },
]

export function QuickDatePresets({ value, onChange }: QuickDatePresetsProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <Calendar className="w-4 h-4" />
        <span className="font-medium">日期</span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="ml-auto text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"
            title="清除日期"
          >
            <X className="w-3 h-3" />
            清除
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => {
          let target: Date | undefined
          if (p.clear) {
            target = undefined
          } else {
            target = p.compute()
          }
          const active = p.clear
            ? !value
            : isSameDay(value, target)
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange(p.clear ? undefined : p.compute())}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                active
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {p.label}
            </button>
          )
        })}
        <label className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 cursor-pointer">
          自定义…
          <input
            type="date"
            value={value ? value.toISOString().slice(0, 10) : ''}
            onChange={e => {
              if (!e.target.value) {
                onChange(undefined)
                return
              }
              const d = new Date(e.target.value)
              d.setHours(0, 0, 0, 0)
              onChange(d)
            }}
            className="hidden"
          />
        </label>
      </div>
    </div>
  )
}
