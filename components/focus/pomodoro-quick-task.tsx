'use client'

import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Plus, Timer, ChevronDown, Zap, Target, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PomodoroQuickTaskProps {
  onTaskCreated?: (taskId: string) => void
  className?: string
}

const priorityConfig = {
  urgent: { label: '紧急', color: 'bg-red-500', textColor: 'text-red-500' },
  high: { label: '高', color: 'bg-orange-500', textColor: 'text-orange-500' },
  medium: { label: '中', color: 'bg-blue-500', textColor: 'text-blue-500' },
  low: { label: '低', color: 'bg-gray-400', textColor: 'text-gray-400' },
}

export function PomodoroQuickTask({ onTaskCreated, className }: PomodoroQuickTaskProps) {
  const { addTask, projects, updatePomodoroTimerState } = useAppStore(useShallow((state) => ({
    addTask: state.addTask,
    projects: state.projects,
    updatePomodoroTimerState: state.updatePomodoroTimerState,
  })))
  
  const [title, setTitle] = useState('')
  const [estimatedPomodoros, setEstimatedPomodoros] = useState(1)
  const [priority, setPriority] = useState<'urgent' | 'high' | 'medium' | 'low'>('medium')
  const [project, setProject] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isExpanded])

  const handleCreateTask = () => {
    if (!title.trim()) return

    const newTask = {
      title: title.trim(),
      type: 'task' as const,
      priority,
      project: project || undefined,
      tags: [],
      status: 'todo' as const,
      estimatedPomodoros,
    }

    addTask(newTask)
    
    const state = useAppStore.getState()
    const newTaskId = state.tasks[state.tasks.length - 1]?.id
    
    if (newTaskId) {
      updatePomodoroTimerState({ selectedTaskId: newTaskId })
      onTaskCreated?.(newTaskId)
    }
    
    resetForm()
  }

  const resetForm = () => {
    setTitle('')
    setEstimatedPomodoros(1)
    setPriority('medium')
    setProject('')
    setShowOptions(false)
    setIsExpanded(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCreateTask()
    }
    if (e.key === 'Escape') {
      resetForm()
    }
  }

  const quickPomodoroOptions = [1, 2, 3, 4, 5, 6, 7, 8]

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          'flex items-center gap-2 w-full rounded-lg border border-dashed border-border/50 px-3 py-2 text-sm text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all',
          className
        )}
      >
        <Plus className="h-4 w-4" />
        <span>快速添加待办...</span>
        <Badge variant="outline" className="ml-auto text-2xs px-1.5">
          Enter
        </Badge>
      </button>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            placeholder="输入待办事项..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pr-20"
            autoFocus
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Badge 
              variant="outline" 
              className={cn('text-2xs px-1.5 cursor-pointer', priorityConfig[priority].textColor)}
              onClick={() => setShowOptions(!showOptions)}
            >
              {priorityConfig[priority].label}
            </Badge>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleCreateTask}
          disabled={!title.trim()}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          添加
        </Button>
      </div>

      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center gap-2">
          <Timer className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">预估:</span>
          <div className="flex items-center gap-1">
            {quickPomodoroOptions.slice(0, 4).map((num) => (
              <button
                key={num}
                onClick={() => setEstimatedPomodoros(num)}
                className={cn(
                  'w-6 h-6 rounded text-xs font-medium transition-all',
                  estimatedPomodoros === num
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {num}
              </button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'w-6 h-6 rounded text-xs font-medium transition-all flex items-center justify-center',
                    estimatedPomodoros > 4
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {estimatedPomodoros > 4 ? estimatedPomodoros : '...'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3" align="start">
                <div className="space-y-2">
                  <label className="text-xs font-medium">预估番茄钟数</label>
                  <Slider
                    value={[estimatedPomodoros]}
                    min={1}
                    max={12}
                    step={1}
                    onValueChange={([value]) => setEstimatedPomodoros(value)}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>1</span>
                    <span className="font-medium text-foreground">{estimatedPomodoros} 个</span>
                    <span>12</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="h-4 w-px bg-border" />

        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Target className="h-3.5 w-3.5" />
              <span>{priorityConfig[priority].label}优先级</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-2" align="start">
            <div className="space-y-1">
              {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                    priority === p ? 'bg-muted' : 'hover:bg-muted/50'
                  )}
                >
                  <div className={cn('w-2 h-2 rounded-full', priorityConfig[p].color)} />
                  <span>{priorityConfig[p].label}优先级</span>
                  {priority === p && (
                    <Badge variant="secondary" className="ml-auto text-2xs px-1">
                      ✓
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {projects.length > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs border-none bg-transparent p-0 h-auto">
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">无项目</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-chart-3" />
          <span>创建后将自动关联到当前番茄钟</span>
        </div>
        <button
          onClick={resetForm}
          className="hover:text-foreground transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}
