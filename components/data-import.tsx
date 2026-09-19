'use client'

import { importDataToStore } from '@/lib/data-restore'
import { importTasksFromCSV } from '@/lib/csv'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Upload, FileJson, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'

export function DataImport() {
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
    counts?: Record<string, number>
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const importCSV = (content: string) => {
    const taskCount = importTasksFromCSV(content, (task) => useAppStore.getState().addTask(task))
    setImportResult({
      success: true,
      message: taskCount > 0 ? `成功导入 ${taskCount} 条任务` : '未找到可导入的数据',
      counts: { tasks: taskCount },
    })
  }

  const importJSON = (content: string) => {
    const data = JSON.parse(content)
    const counts = importDataToStore(data)

    const totalImported = Object.values(counts).reduce((a, b) => a + b, 0)
    setImportResult({
      success: true,
      message: totalImported > 0 ? `成功导入 ${totalImported} 条数据` : '未找到可导入的数据',
      counts,
    })
  }

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        if (file.name.endsWith('.csv')) {
          importCSV(content)
        } else {
          importJSON(content)
        }
      } catch {
        setImportResult({
          success: false,
          message: '文件格式错误，请确保上传有效的 JSON 或 CSV 文件',
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
    if (file && (file.type === 'application/json' || file.name.endsWith('.csv'))) {
      handleImport(file)
    } else {
      setImportResult({
        success: false,
        message: '请上传 JSON 或 CSV 格式的文件',
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
      <DialogContent aria-describedby={undefined} className="sm:max-w-[400px]">
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
            {isDragging ? (
              <FileSpreadsheet className="h-10 w-10 mb-3 text-primary" />
            ) : (
              <FileJson className="h-10 w-10 mb-3 text-muted-foreground/50" />
            )}
            <p className="text-sm font-medium">
              {isDragging ? '松开以上传文件' : '拖拽 JSON/CSV 文件到此处'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">或点击选择文件</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
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
              支持 JSON 和 CSV 格式导入。CSV 文件以第一行为表头，支持 title、priority、status、dueDate、project、tags（分号或竖线分隔）、notes 等列，兼容 Todoist / TickTick 导出格式。导入的数据将追加到现有数据中（按 id 去重），不会覆盖。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
