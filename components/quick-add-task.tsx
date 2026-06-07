'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { parseSmartInput, getSmartInputHint } from '@/lib/smart-input'
import { useShallow } from 'zustand/react/shallow'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Zap, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickAddTaskProps {
  onClose?: () => void
  className?: string
}

export function QuickAddTask({ onClose, className }: QuickAddTaskProps) {
  const { addTask, projects } = useAppStore(useShallow((state) => ({
    addTask: state.addTask,
    projects: state.projects,
  })))
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const hints = getSmartInputHint(input)
  const parsed = input ? parseSmartInput(input) : null

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isFocused])

  const handleSubmit = () => {
    if (!input.trim()) return

    const parsedTask = parseSmartInput(input)
    if (!parsedTask.title.trim()) return

    addTask({
      title: parsedTask.title,
      description: undefined,
      type: parsedTask.type || 'task',
      priority: parsedTask.priority || 'medium',
      project: parsedTask.project || '',
      tags: parsedTask.tags,
      dueDate: parsedTask.dueDate,
      startTime: parsedTask.startTime,
      endTime: parsedTask.endTime,
      status: 'todo',
      estimatedPomodoros: 1,
    })

    setInput('')
    onClose?.()
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-2xl border bg-card px-4 py-2.5 transition-all duration-200',
          isFocused
            ? 'border-primary/50 shadow-lg shadow-primary/10 ring-2 ring-primary/20'
            : 'border-border/50 hover:border-primary/30'
        )}
      >
        <Zap className={cn('h-4 w-4 shrink-0 transition-colors', isFocused ? 'text-primary' : 'text-muted-foreground')} />
        <Input
          ref={inputRef}
          placeholder="快速添加：明天3点开会 p1 #工作 +项目A"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
            if (e.key === 'Escape') {
              setInput('')
              onClose?.()
            }
          }}
          className="h-8 border-none bg-transparent px-0 shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/60"
        />
        {input.trim() && (
          <Button
            size="sm"
            className="h-7 gap-1.5 px-3 shrink-0"
            onClick={handleSubmit}
          >
            <Plus className="h-3.5 w-3.5" />
            添加
          </Button>
        )}
      </div>

      {isFocused && input && parsed && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border bg-card p-3 shadow-xl animate-fade-in-up">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground">解析预览</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{parsed.title || '任务标题'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {parsed.dueDate && (
                <Badge variant="outline" className="text-xs gap-1">
                  📅 {parsed.dueDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  {parsed.startTime && ` ${parsed.startTime}${parsed.endTime ? `-${parsed.endTime}` : ''}`}
                </Badge>
              )}
              {parsed.priority && (
                <Badge variant="outline" className="text-xs gap-1">
                  {parsed.priority === 'urgent' ? '🔴' : parsed.priority === 'high' ? '🟠' : parsed.priority === 'medium' ? '🔵' : '⚪'}
                  {parsed.priority === 'urgent' ? '紧急' : parsed.priority === 'high' ? '高' : parsed.priority === 'medium' ? '中' : '低'}
                </Badge>
              )}
              {parsed.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs gap-1">
                  🏷️ {tag}
                </Badge>
              ))}
              {parsed.project && (
                <Badge variant="outline" className="text-xs gap-1">
                  📁 {parsed.project}
                </Badge>
              )}
              {parsed.type === 'event' && (
                <Badge variant="outline" className="text-xs gap-1">📋 日程</Badge>
              )}
              {parsed.type === 'reminder' && (
                <Badge variant="outline" className="text-xs gap-1">🔔 提醒</Badge>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hints.map((hint, i) => (
              <span key={i} className="text-[10px] text-muted-foreground">{hint}</span>
            ))}
          </div>
        </div>
      )}

      {isFocused && !input && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border bg-card p-3 shadow-xl animate-fade-in-up">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">快速设置日期</p>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const today = new Date()
                const tomorrow = new Date(today)
                tomorrow.setDate(today.getDate() + 1)
                const dayAfter = new Date(today)
                dayAfter.setDate(today.getDate() + 2)
                const nextMonday = new Date(today)
                const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7
                nextMonday.setDate(today.getDate() + daysUntilMonday)
                const nextWeek = new Date(today)
                nextWeek.setDate(today.getDate() + 7)
                const quickDates = [
                  { label: '今天', date: today },
                  { label: '明天', date: tomorrow },
                  { label: '后天', date: dayAfter },
                  { label: '下周一', date: nextMonday },
                  { label: '下周', date: nextWeek },
                ]
                return quickDates.map(qd => (
                  <button
                    key={qd.label}
                    className="text-[10px] px-2 py-1 rounded-md border border-border/50 hover:bg-muted/50 hover:border-primary/30 transition-all"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      const dateStr = `${qd.date.getMonth() + 1}月${qd.date.getDate()}日`
                      setInput(prev => prev + (prev ? ' ' : '') + dateStr)
                    }}
                  >
                    {qd.label}
                  </button>
                ))
              })()}
            </div>
            <div className="border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground">智能输入语法</p>
              <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground mt-1.5">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">明天</Badge>
                  <span>日期关键词</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">p1</Badge>
                  <span>优先级 (1-4)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">#标签</Badge>
                  <span>添加标签</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">+项目</Badge>
                  <span>关联项目</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">14:00-16:00</Badge>
                  <span>时间范围</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">!日程</Badge>
                  <span>创建日程</span>
                </div>
              </div>
              <div className="border-t pt-2 mt-2">
                <p className="text-[10px] text-muted-foreground">
                  示例：<span className="text-foreground">明天3点开会 p1 #工作 +项目A</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  示例：<span className="text-foreground">下周一14:00-16:00评审 !日程 #项目</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
