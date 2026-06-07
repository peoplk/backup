'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { MobileBottomSheet } from './mobile-bottom-sheet'
import { PRIORITY_CONFIG } from './mobile-priority-dot'
import type { Project, Tag } from '@/lib/types'
import {
  CalendarDays, FlagTriangleRight, Folder, RotateCcw,
  Tag as TagIcon, StickyNote, Timer, Minus, Plus, X, Flag
} from 'lucide-react'

type PriorityType = 'urgent' | 'high' | 'medium' | 'low'
type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly'

const REPEAT_OPTIONS: { id: RepeatType; label: string }[] = [
  { id: 'none', label: '不重复' },
  { id: 'daily', label: '每天' },
  { id: 'weekly', label: '每周' },
  { id: 'monthly', label: '每月' },
]

const PRIORITY_OPTIONS: PriorityType[] = ['urgent', 'high', 'medium', 'low']

export interface AddTaskData {
  title: string
  priority: PriorityType
  dueDate?: Date
  project?: string
  tags: string[]
  notes: string
  repeatRule: RepeatType
  pomodoros: number
}

interface MobileAddTaskSheetProps {
  open: boolean
  onClose: () => void
  initialTitle?: string
  initialPriority?: PriorityType
  onAdd: (data: AddTaskData) => void
  projects: Project[]
  tags: Tag[]
  formatDate: (date: Date | string | undefined) => string
}

export function MobileAddTaskSheet({
  open, onClose, initialTitle = '', initialPriority = 'medium',
  onAdd, projects, tags, formatDate
}: MobileAddTaskSheetProps) {
  const [title, setTitle] = useState(initialTitle)
  const [priority, setPriority] = useState<PriorityType>(initialPriority)
  const [dueDate, setDueDate] = useState('')
  const [projectId, setProjectId] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [repeatRule, setRepeatRule] = useState<RepeatType>('none')
  const [pomodoros, setPomodoros] = useState(1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setPriority(initialPriority)
    }
  }, [open, initialTitle, initialPriority])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  const handleSubmit = () => {
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      project: projectId || undefined,
      tags: selectedTags,
      notes,
      repeatRule,
      pomodoros,
    })
    resetForm()
    onClose()
  }

  const resetForm = () => {
    setTitle('')
    setPriority('medium')
    setDueDate('')
    setProjectId('')
    setSelectedTags([])
    setNotes('')
    setRepeatRule('none')
    setPomodoros(1)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <MobileBottomSheet
      open={open}
      onClose={handleClose}
      title="新建任务"
      action={{ label: '添加', onClick: handleSubmit, disabled: !title.trim() }}
    >
      <div className="px-5 pb-8 space-y-5">
        <input
          ref={inputRef}
          type="text"
          className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/40"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="任务标题"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        <div className="flex items-center gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95',
              dueDate ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
            )}
            onClick={() => { if (!dueDate) setDueDate(new Date().toISOString().split('T')[0]) }}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {dueDate ? formatDate(dueDate) : '日期'}
            {dueDate && <span onClick={(e) => { e.stopPropagation(); setDueDate('') }}><X className="h-3 w-3 ml-0.5" /></span>}
          </button>

          <button className={cn(
            'shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95',
            priority !== 'medium' ? cn(PRIORITY_CONFIG[priority].bg, PRIORITY_CONFIG[priority].color) : 'bg-muted/50 text-muted-foreground'
          )}>
            <FlagTriangleRight className="h-3.5 w-3.5" />
            {PRIORITY_CONFIG[priority].label}
          </button>

          <button className={cn(
            'shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95',
            projectId ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
          )}>
            <Folder className="h-3.5 w-3.5" />
            {projectId ? projects.find(p => p.id === projectId)?.name || '项目' : '项目'}
          </button>

          <button className={cn(
            'shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95',
            repeatRule !== 'none' ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
          )}>
            <RotateCcw className="h-3.5 w-3.5" />
            {repeatRule !== 'none' ? REPEAT_OPTIONS.find(r => r.id === repeatRule)?.label : '重复'}
          </button>
        </div>

        {dueDate && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> 截止日期
            </label>
            <input
              type="date"
              className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
            <Flag className="h-3 w-3" /> 优先级
          </label>
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map(p => (
              <button
                key={p}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95',
                  priority === p
                    ? cn(PRIORITY_CONFIG[p].bg, PRIORITY_CONFIG[p].color, 'ring-1 ring-current/20')
                    : 'bg-muted/50 text-muted-foreground'
                )}
                onClick={() => setPriority(p)}
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', PRIORITY_CONFIG[p].dot)} />
                {PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
            <Folder className="h-3 w-3" /> 项目
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95', !projectId ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')}
              onClick={() => setProjectId('')}
            >无</button>
            {projects.map(project => (
              <button
                key={project.id}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95', projectId === project.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')}
                onClick={() => setProjectId(project.id)}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
              </button>
            ))}
          </div>
        </div>

        {tags.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
              <TagIcon className="h-3 w-3" /> 标签
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95', selectedTags.includes(tag.name) ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')}
                  onClick={() => setSelectedTags(prev => prev.includes(tag.name) ? prev.filter(t => t !== tag.name) : [...prev, tag.name])}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> 重复
          </label>
          <div className="flex gap-1.5">
            {REPEAT_OPTIONS.map(option => (
              <button
                key={option.id}
                className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95', repeatRule === option.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')}
                onClick={() => setRepeatRule(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
            <StickyNote className="h-3 w-3" /> 备注
          </label>
          <textarea
            className="w-full min-h-[60px] px-3 py-2 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-muted-foreground/50"
            placeholder="添加备注..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
            <Timer className="h-3 w-3" /> 预计番茄数
          </label>
          <div className="flex items-center gap-3">
            <button className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center active:scale-90 transition-transform" onClick={() => setPomodoros(Math.max(1, pomodoros - 1))}>
              <Minus className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-lg font-bold">{pomodoros}</span>
            <button className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center active:scale-90 transition-transform" onClick={() => setPomodoros(pomodoros + 1)}>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </MobileBottomSheet>
  )
}
