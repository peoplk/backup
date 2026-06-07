'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  Target,
  Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ExportFormat = 'json' | 'csv'
type ExportRange = 'all' | 'today' | 'week' | 'month' | 'custom'
type ExportType = 'tasks' | 'pomodoros' | 'habits' | 'goals' | 'all'

interface ExportOptions {
  format: ExportFormat
  range: ExportRange
  types: ExportType[]
  includeArchived: boolean
  includeCompleted: boolean
}

const EXPORT_TYPES = [
  { id: 'tasks', label: '任务', icon: CheckCircle2, color: 'text-chart-2' },
  { id: 'pomodoros', label: '番茄钟记录', icon: Clock, color: 'text-chart-1' },
  { id: 'habits', label: '习惯打卡', icon: Target, color: 'text-chart-4' },
  { id: 'goals', label: '目标进度', icon: Flame, color: 'text-chart-3' },
]

export function DataExport() {
  const { tasks, pomodoroSessions, habits, habitCheckIns, goals } = useAppStore(useShallow((state) => ({
    tasks: state.tasks,
    pomodoroSessions: state.pomodoroSessions,
    habits: state.habits,
    habitCheckIns: state.habitCheckIns,
    goals: state.goals,
  })))

  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ExportOptions>({
    format: 'json',
    range: 'all',
    types: ['all'],
    includeArchived: false,
    includeCompleted: true,
  })

  const getDateRange = (range: ExportRange) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (range) {
      case 'today':
        return { start: today, end: now }
      case 'week': {
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay() + 1)
        return { start: startOfWeek, end: now }
      }
      case 'month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        return { start: startOfMonth, end: now }
      }
      default:
        return null
    }
  }

  const filterByDateRange = <T extends { createdAt?: Date; completedAt?: Date; date?: Date; timestamp?: Date }>(
    items: T[],
    range: ExportRange
  ) => {
    if (range === 'all') return items
    const dateRange = getDateRange(range)
    if (!dateRange) return items

    return items.filter(item => {
      const itemDate = item.createdAt || item.completedAt || item.date || item.timestamp
      if (!itemDate) return false
      const d = new Date(itemDate)
      return d >= dateRange.start && d <= dateRange.end
    })
  }

  const exportToJSON = () => {
    const data: Record<string, unknown> = {}
    const dateRange = getDateRange(options.range)

    if (options.types.includes('all') || options.types.includes('tasks')) {
      let filteredTasks = filterByDateRange(tasks, options.range)
      if (!options.includeArchived) filteredTasks = filteredTasks.filter(t => !t.archived)
      if (!options.includeCompleted) filteredTasks = filteredTasks.filter(t => t.status !== 'done')
      data.tasks = filteredTasks
    }

    if (options.types.includes('all') || options.types.includes('pomodoros')) {
      data.pomodoroSessions = filterByDateRange(pomodoroSessions, options.range)
    }

    if (options.types.includes('all') || options.types.includes('habits')) {
      let filteredHabits = habits
      if (!options.includeArchived) filteredHabits = filteredHabits.filter(h => !h.archived)
      data.habits = filteredHabits
      data.habitCheckIns = filterByDateRange(habitCheckIns, options.range)
    }

    if (options.types.includes('all') || options.types.includes('goals')) {
      data.goals = goals
    }

    data.exportInfo = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      range: options.range,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadFile(blob, `focusflow-export-${new Date().toISOString().split('T')[0]}.json`)
  }

  const exportToCSV = () => {
    const csvParts: string[] = []

    if (options.types.includes('all') || options.types.includes('tasks')) {
      let filteredTasks = filterByDateRange(tasks, options.range)
      if (!options.includeArchived) filteredTasks = filteredTasks.filter(t => !t.archived)
      if (!options.includeCompleted) filteredTasks = filteredTasks.filter(t => t.status !== 'done')

      if (filteredTasks.length > 0) {
        csvParts.push('任务')
        csvParts.push('标题,优先级,状态,项目,标签,截止日期,创建日期,完成日期')
        filteredTasks.forEach(t => {
          csvParts.push(`"${t.title}","${t.priority}","${t.status}","${t.project || ''}","${t.tags.join(';')}","${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ''}","${new Date(t.createdAt).toLocaleDateString()}","${t.completedAt ? new Date(t.completedAt).toLocaleDateString() : ''}"`)
        })
        csvParts.push('')
      }
    }

    if (options.types.includes('all') || options.types.includes('pomodoros')) {
      const filteredSessions = filterByDateRange(pomodoroSessions, options.range)
      if (filteredSessions.length > 0) {
        csvParts.push('番茄钟记录')
        csvParts.push('类型,时长(分钟),完成时间,关联任务')
        filteredSessions.forEach(s => {
          csvParts.push(`"${s.type}","${Math.round(s.duration / 60)}","${new Date(s.completedAt).toLocaleString()}","${s.taskId || ''}"`)
        })
        csvParts.push('')
      }
    }

    if (options.types.includes('all') || options.types.includes('habits')) {
      const filteredCheckIns = filterByDateRange(habitCheckIns, options.range)
      if (filteredCheckIns.length > 0) {
        csvParts.push('习惯打卡')
        csvParts.push('习惯ID,日期,是否完成,备注')
        filteredCheckIns.forEach(c => {
          csvParts.push(`"${c.habitId}","${new Date(c.date).toLocaleDateString()}","${c.completed ? '是' : '否'}","${c.note || ''}"`)
        })
      }
    }

    const blob = new Blob(['\uFEFF' + csvParts.join('\n')], { type: 'text/csv;charset=utf-8' })
    downloadFile(blob, `focusflow-export-${new Date().toISOString().split('T')[0]}.csv`)
  }

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  const handleExport = () => {
    if (options.format === 'json') {
      exportToJSON()
    } else {
      exportToCSV()
    }
  }

  const toggleType = (type: ExportType) => {
    if (type === 'all') {
      setOptions(prev => ({
        ...prev,
        types: prev.types.includes('all') ? [] : ['all']
      }))
    } else {
      setOptions(prev => {
        const newTypes = prev.types.includes('all')
          ? [type]
          : prev.types.includes(type)
            ? prev.types.filter(t => t !== type)
            : [...prev.types.filter(t => t !== 'all'), type]
        return { ...prev, types: newTypes.length === 4 ? ['all'] : newTypes }
      })
    }
  }

  const getExportStats = () => {
    const stats = {
      tasks: 0,
      pomodoros: 0,
      habits: 0,
      goals: 0,
    }

    if (options.types.includes('all') || options.types.includes('tasks')) {
      let filteredTasks = filterByDateRange(tasks, options.range)
      if (!options.includeArchived) filteredTasks = filteredTasks.filter(t => !t.archived)
      if (!options.includeCompleted) filteredTasks = filteredTasks.filter(t => t.status !== 'done')
      stats.tasks = filteredTasks.length
    }

    if (options.types.includes('all') || options.types.includes('pomodoros')) {
      stats.pomodoros = filterByDateRange(pomodoroSessions, options.range).length
    }

    if (options.types.includes('all') || options.types.includes('habits')) {
      stats.habits = filterByDateRange(habitCheckIns, options.range).length
    }

    if (options.types.includes('all') || options.types.includes('goals')) {
      stats.goals = goals.length
    }

    return stats
  }

  const stats = getExportStats()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          导出数据
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            导出数据
          </DialogTitle>
          <DialogDescription>
            选择导出格式和数据范围，将您的数据导出到本地文件
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">导出格式</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOptions(prev => ({ ...prev, format: 'json' }))}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 transition-all',
                  options.format === 'json'
                    ? 'border-primary bg-primary/5'
                    : 'border-border/50 hover:border-primary/30'
                )}
              >
                <FileJson className="h-5 w-5 text-chart-1" />
                <div className="text-left">
                  <p className="text-sm font-medium">JSON</p>
                  <p className="text-[10px] text-muted-foreground">完整数据结构</p>
                </div>
              </button>
              <button
                onClick={() => setOptions(prev => ({ ...prev, format: 'csv' }))}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 transition-all',
                  options.format === 'csv'
                    ? 'border-primary bg-primary/5'
                    : 'border-border/50 hover:border-primary/30'
                )}
              >
                <FileSpreadsheet className="h-5 w-5 text-chart-2" />
                <div className="text-left">
                  <p className="text-sm font-medium">CSV</p>
                  <p className="text-[10px] text-muted-foreground">表格格式</p>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">时间范围</label>
            <Select
              value={options.range}
              onValueChange={(value) => setOptions(prev => ({ ...prev, range: value as ExportRange }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部数据</SelectItem>
                <SelectItem value="today">今天</SelectItem>
                <SelectItem value="week">本周</SelectItem>
                <SelectItem value="month">本月</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">导出内容</label>
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_TYPES.map((type) => {
                const Icon = type.icon
                const isSelected = options.types.includes('all') || options.types.includes(type.id as ExportType)
                return (
                  <button
                    key={type.id}
                    onClick={() => toggleType(type.id as ExportType)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-2.5 transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border/50 hover:border-primary/30'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', type.color)} />
                    <span className="text-sm">{type.label}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {stats[type.id as keyof typeof stats]}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">其他选项</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeArchived"
                  checked={options.includeArchived}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeArchived: !!checked }))}
                />
                <label htmlFor="includeArchived" className="text-sm text-muted-foreground">
                  包含已归档的项目
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeCompleted"
                  checked={options.includeCompleted}
                  onCheckedChange={(checked) => setOptions(prev => ({ ...prev, includeCompleted: !!checked }))}
                />
                <label htmlFor="includeCompleted" className="text-sm text-muted-foreground">
                  包含已完成的项目
                </label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={options.types.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
