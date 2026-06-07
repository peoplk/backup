'use client'

import { useAppStore } from '@/lib/store'
import { RepeatRule } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'

export function DataImport() {
  const store = useAppStore()
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
    counts?: Record<string, number>
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        const counts: Record<string, number> = {}

        if (data.tasks && Array.isArray(data.tasks)) {
          let taskCount = 0
          data.tasks.forEach((t: Record<string, unknown>) => {
            try {
              store.addTask({
                title: (t.title as string) || '未命名任务',
                description: t.description as string | undefined,
                type: (t.type as 'task' | 'event' | 'reminder') || 'task',
                priority: (t.priority as 'urgent' | 'high' | 'medium' | 'low') || 'medium',
                status: 'todo',
                project: t.project as string | undefined,
                tags: Array.isArray(t.tags) ? t.tags as string[] : [],
                dueDate: t.dueDate ? new Date(t.dueDate as string) : undefined,
                estimatedPomodoros: t.estimatedPomodoros as number | undefined,
                repeatRule: t.repeatRule as RepeatRule | undefined,
              })
              taskCount++
            } catch { /* skip invalid tasks */ }
          })
          counts.tasks = taskCount
        }

        if (data.habits && Array.isArray(data.habits)) {
          let habitCount = 0
          data.habits.forEach((h: Record<string, unknown>) => {
            try {
              store.addHabit({
                name: (h.name as string) || '未命名习惯',
                icon: (h.icon as string) || '🎯',
                color: (h.color as string) || '#4A90E2',
                frequency: (h.frequency as 'daily' | 'weekly' | 'monthly') || 'daily',
                category: h.category as string | undefined,
                reminderTime: h.reminderTime as string | undefined,
                reminderEnabled: h.reminderEnabled as boolean | undefined,
                trackingType: (h.trackingType as 'boolean' | 'quantity') || 'boolean',
                targetValue: h.targetValue as number | undefined,
                unit: h.unit as string | undefined,
              })
              habitCount++
            } catch { /* skip invalid habits */ }
          })
          counts.habits = habitCount
        }

        if (data.anniversaries && Array.isArray(data.anniversaries)) {
          let annivCount = 0
          data.anniversaries.forEach((a: Record<string, unknown>) => {
            try {
              store.addAnniversary({
                title: (a.title as string) || '未命名纪念日',
                date: a.date ? new Date(a.date as string) : new Date(),
                type: (a.type as 'birthday' | 'anniversary' | 'countdown' | 'custom' | 'festival') || 'custom',
                repeat: (a.repeat as boolean) ?? true,
                remindDays: (a.remindDays as number) ?? 1,
                color: (a.color as string) || '#4A90E2',
                icon: (a.icon as string) || '📅',
                note: a.note as string | undefined,
              })
              annivCount++
            } catch { /* skip invalid anniversaries */ }
          })
          counts.anniversaries = annivCount
        }

        if (data.projects && Array.isArray(data.projects)) {
          let projectCount = 0
          data.projects.forEach((p: Record<string, unknown>) => {
            try {
              store.addProject({
                name: (p.name as string) || '未命名项目',
                color: (p.color as string) || '#4A90E2',
              })
              projectCount++
            } catch { /* skip invalid projects */ }
          })
          counts.projects = projectCount
        }

        const totalImported = Object.values(counts).reduce((a, b) => a + b, 0)
        setImportResult({
          success: true,
          message: totalImported > 0 ? `成功导入 ${totalImported} 条数据` : '未找到可导入的数据',
          counts,
        })
      } catch {
        setImportResult({
          success: false,
          message: '文件格式错误，请确保上传有效的 JSON 文件',
        })
      }
    }
    reader.readAsText(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImport(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type === 'application/json') {
      handleImport(file)
    } else {
      setImportResult({
        success: false,
        message: '请上传 JSON 格式的文件',
      })
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open) setImportResult(null) }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          导入数据
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>导入数据</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div
            className={cn(
              'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all duration-200 cursor-pointer',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileJson className={cn('h-10 w-10 mb-3', isDragging ? 'text-primary' : 'text-muted-foreground/50')} />
            <p className="text-sm font-medium">
              {isDragging ? '松开以上传文件' : '拖拽 JSON 文件到此处'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">或点击选择文件</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {importResult && (
            <div className={cn(
              'flex items-start gap-3 rounded-xl p-4',
              importResult.success ? 'bg-chart-2/10' : 'bg-destructive/10'
            )}>
              {importResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-chart-2 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div>
                <p className={cn('text-sm font-medium', importResult.success ? 'text-chart-2' : 'text-destructive')}>
                  {importResult.message}
                </p>
                {importResult.counts && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {importResult.counts.tasks && <span>任务: {importResult.counts.tasks} </span>}
                    {importResult.counts.habits && <span>习惯: {importResult.counts.habits} </span>}
                    {importResult.counts.anniversaries && <span>纪念日: {importResult.counts.anniversaries} </span>}
                    {importResult.counts.projects && <span>项目: {importResult.counts.projects} </span>}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              支持导入 FocusFlow 导出的 JSON 文件。导入的数据将追加到现有数据中，不会覆盖。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
