'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { MobileBottomSheet } from './mobile-bottom-sheet'
import { PRIORITY_CONFIG } from './mobile-priority-dot'
import type { Project, Tag, SubTask } from '@/lib/types'
import {
  Flag, CalendarDays, FolderOpen, Tag as TagIcon, StickyNote,
  ListChecks, RotateCcw, Timer, Minus, Plus, X, CheckCircle2,
  Circle, AlertCircle, Trash2
} from 'lucide-react'

type PriorityType = 'urgent' | 'high' | 'medium' | 'low'
type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

const REPEAT_OPTIONS: { id: RepeatType; label: string }[] = [
  { id: 'none', label: '不重复' }, { id: 'daily', label: '每天' },
  { id: 'weekly', label: '每周' }, { id: 'monthly', label: '每月' },
  { id: 'yearly', label: '每年' },
]
const PRIORITY_OPTIONS: PriorityType[] = ['urgent', 'high', 'medium', 'low']

interface MobileTaskDetailSheetProps {
  open: boolean
  onClose: () => void
  taskId: string | null
  projects: Project[]
  tags: Tag[]
  today: Date
}

export function MobileTaskDetailSheet({ open, onClose, taskId, projects, tags, today }: MobileTaskDetailSheetProps) {
  const { updateTask, deleteTask, completeTask, uncompleteTask, toggleSubTask, deleteSubTask, addSubTask, tasks } = useAppStore(
    useShallow(state => ({
      updateTask: state.updateTask, deleteTask: state.deleteTask,
      completeTask: state.completeTask, uncompleteTask: state.uncompleteTask,
      toggleSubTask: state.toggleSubTask, deleteSubTask: state.deleteSubTask,
      addSubTask: state.addSubTask, tasks: state.tasks,
    }))
  )

  const [editTitle, setEditTitle] = useState('')
  const [editPriority, setEditPriority] = useState<PriorityType>('medium')
  const [editDueDate, setEditDueDate] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editNotes, setEditNotes] = useState('')
  const [editRepeatRule, setEditRepeatRule] = useState<RepeatType>('none')
  const [editPomodoros, setEditPomodoros] = useState(1)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

  const detailTask = useMemo(() => taskId ? tasks.find(t => t.id === taskId) : null, [taskId, tasks])

  useEffect(() => {
    if (open && detailTask) {
      setEditTitle(detailTask.title)
      setEditPriority(detailTask.priority)
      setEditDueDate(detailTask.dueDate ? new Date(detailTask.dueDate).toISOString().split('T')[0] : '')
      setEditProjectId(detailTask.project || '')
      setEditTags(detailTask.tags || [])
      setEditNotes(detailTask.notes || detailTask.description || '')
      setEditRepeatRule(detailTask.repeatRule ? (detailTask.repeatRule.type as RepeatType) : 'none')
      setEditPomodoros(detailTask.estimatedPomodoros || 1)
      setNewSubtaskTitle('')
    }
  }, [open, detailTask])

  const handleSave = useCallback(() => {
    if (!taskId) return
    const ct = tasks.find(t => t.id === taskId)
    updateTask(taskId, {
      title: editTitle, priority: editPriority,
      dueDate: editDueDate ? new Date(editDueDate) : undefined,
      project: editProjectId || undefined, tags: editTags,
      notes: editNotes || undefined, description: editNotes || undefined,
      repeatRule: editRepeatRule !== 'none' ? {
        type: editRepeatRule, interval: 1,
        ...(ct?.repeatRule?.paused != null ? { paused: ct.repeatRule.paused } : {}),
        ...(ct?.repeatRule?.completedCount != null ? { completedCount: ct.repeatRule.completedCount } : {}),
        ...(ct?.repeatRule?.endDate != null ? { endDate: ct.repeatRule.endDate } : {}),
        ...(ct?.repeatRule?.endAfterCount != null ? { endAfterCount: ct.repeatRule.endAfterCount } : {}),
      } : undefined,
      estimatedPomodoros: editPomodoros,
    })
  }, [taskId, editTitle, editPriority, editDueDate, editProjectId, editTags, editNotes, editRepeatRule, editPomodoros, updateTask, tasks])

  const handleClose = useCallback(() => { handleSave(); onClose() }, [handleSave, onClose])
  const handleDelete = useCallback(() => { if (!taskId) return; deleteTask(taskId); onClose() }, [taskId, deleteTask, onClose])
  const handleComplete = useCallback(() => { if (!taskId) return; completeTask(taskId); onClose() }, [taskId, completeTask, onClose])
  const handleUncomplete = useCallback(() => { if (!taskId) return; uncompleteTask(taskId); onClose() }, [taskId, uncompleteTask, onClose])
  const handleAddSubtask = useCallback(() => {
    if (!taskId || !newSubtaskTitle.trim()) return
    addSubTask(taskId, newSubtaskTitle.trim()); setNewSubtaskTitle('')
  }, [taskId, newSubtaskTitle, addSubTask])
  const handleToggleTag = useCallback((name: string) => {
    setEditTags(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name])
  }, [])

  const isOverdue = (date: string) => {
    if (!date) return false
    const d = new Date(date); d.setHours(0, 0, 0, 0)
    return d.getTime() < today.getTime()
  }

  return (
    <MobileBottomSheet open={open} onClose={handleClose} title="任务详情" maxHeight="85vh">
      <div className="px-5 pb-8 space-y-5">
        <input type="text" className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/40"
          value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="任务标题" />

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1"><Flag className="h-3 w-3" /> 优先级</label>
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map(p => (
              <button key={p} className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95',
                editPriority === p ? cn(PRIORITY_CONFIG[p].bg, PRIORITY_CONFIG[p].color, 'ring-1 ring-current/20') : 'bg-muted/50 text-muted-foreground'
              )} onClick={() => setEditPriority(p)}>
                <span className={cn('h-2.5 w-2.5 rounded-full', PRIORITY_CONFIG[p].dot)} />{PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1"><CalendarDays className="h-3 w-3" /> 截止日期</label>
          <div className="flex items-center gap-2">
            <input type="date" className="flex-1 h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
            {editDueDate && <button className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center active:scale-90 transition-transform" onClick={() => setEditDueDate('')}><X className="h-4 w-4 text-muted-foreground" /></button>}
          </div>
          {editDueDate && isOverdue(editDueDate) && (
            <p className="text-[10px] text-red-500 mt-1 flex items-center gap-0.5"><AlertCircle className="h-3 w-3" /> 已逾期</p>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1"><FolderOpen className="h-3 w-3" /> 项目</label>
          <div className="flex flex-wrap gap-1.5">
            <button className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95', !editProjectId ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')} onClick={() => setEditProjectId('')}>无</button>
            {projects.map(p => (
              <button key={p.id} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95', editProjectId === p.id || editProjectId === p.name ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')} onClick={() => setEditProjectId(p.id)}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />{p.name}
              </button>
            ))}
          </div>
        </div>

        {tags.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1"><TagIcon className="h-3 w-3" /> 标签</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <button key={tag.id} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95', editTags.includes(tag.name) ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')} onClick={() => handleToggleTag(tag.name)}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />{tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1"><StickyNote className="h-3 w-3" /> 备注</label>
          <textarea className="w-full min-h-[80px] px-3 py-2 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-muted-foreground/50"
            placeholder="添加备注..." value={editNotes} onChange={e => setEditNotes(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
            <ListChecks className="h-3 w-3" /> 子任务
            {detailTask?.subTasks?.length ? (
              <>
                <span className="text-muted-foreground/50">({detailTask.subTasks.filter(s => s.completed).length}/{detailTask.subTasks.length})</span>
                {detailTask.subTasks.length > 0 && (
                  <div className="flex-1 h-1.5 rounded-full bg-muted/50 ml-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(detailTask.subTasks.filter(s => s.completed).length / detailTask.subTasks.length) * 100}%` }}
                    />
                  </div>
                )}
              </>
            ) : null}
          </label>
          {detailTask?.subTasks?.length ? (
            <div className="space-y-1 mb-2">
              {detailTask.subTasks.map(st => (
                <SubTaskItem key={st.id} subTask={st} taskId={taskId} onToggle={toggleSubTask} onDelete={deleteSubTask} />
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <input type="text" placeholder="添加子任务..." className="flex-1 h-9 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
              value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddSubtask()} />
            <button className={cn('h-9 w-9 rounded-xl flex items-center justify-center transition-all active:scale-90', newSubtaskTitle.trim() ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')}
              onClick={handleAddSubtask} disabled={!newSubtaskTitle.trim()}><Plus className="h-4 w-4" /></button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1"><RotateCcw className="h-3 w-3" /> 重复</label>
          <div className="flex gap-1.5">
            {REPEAT_OPTIONS.map(opt => (
              <button key={opt.id} className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95', editRepeatRule === opt.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')} onClick={() => setEditRepeatRule(opt.id)}>{opt.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1"><Timer className="h-3 w-3" /> 预计番茄数</label>
          <div className="flex items-center gap-3">
            <button className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center active:scale-90 transition-transform" onClick={() => setEditPomodoros(Math.max(1, editPomodoros - 1))}><Minus className="h-4 w-4 text-muted-foreground" /></button>
            <div className="flex items-center gap-1.5"><span className="text-lg font-bold">{editPomodoros}</span><span className="text-xs text-muted-foreground">个番茄</span></div>
            <button className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center active:scale-90 transition-transform" onClick={() => setEditPomodoros(editPomodoros + 1)}><Plus className="h-4 w-4 text-muted-foreground" /></button>
            {detailTask && detailTask.completedPomodoros > 0 && <span className="text-xs text-muted-foreground ml-2">已完成 {detailTask.completedPomodoros}</span>}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {detailTask && detailTask.status !== 'done' && (
            <button className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform" onClick={handleComplete}>
              <CheckCircle2 className="h-4 w-4" /> 完成任务
            </button>
          )}
          {detailTask && detailTask.status === 'done' && (
            <button className="flex-1 h-12 rounded-2xl bg-muted/50 text-muted-foreground font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform" onClick={handleUncomplete}>
              <RotateCcw className="h-4 w-4" /> 恢复任务
            </button>
          )}
          <button className="h-12 px-5 rounded-2xl bg-red-500/10 text-red-500 font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" /> 删除
          </button>
        </div>
      </div>
    </MobileBottomSheet>
  )
}

interface SubTaskItemProps {
  subTask: SubTask
  taskId: string | null
  onToggle: (taskId: string, subTaskId: string) => void
  onDelete: (taskId: string, subTaskId: string) => void
}

function SubTaskItem({ subTask, taskId, onToggle, onDelete }: SubTaskItemProps) {
  const [offsetX, setOffsetX] = useState(0)
  const touchStartX = useRef(0)
  const touchCurrentX = useRef(0)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchCurrentX.current = e.touches[0].clientX
    longPressTimer.current = setTimeout(() => {
      if (taskId) onDelete(taskId, subTask.id)
    }, 600)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX
    const diff = touchCurrentX.current - touchStartX.current
    if (longPressTimer.current && Math.abs(diff) > 10) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (diff < 0) {
      setOffsetX(Math.max(diff, -80))
    } else {
      setOffsetX(Math.min(diff, 0))
    }
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (offsetX < -40) {
      setOffsetX(-80)
    } else {
      setOffsetX(0)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (taskId) onDelete(taskId, subTask.id)
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-red-500 rounded-r-xl"
        onClick={() => { if (taskId) onDelete(taskId, subTask.id) }}
      >
        <Trash2 className="h-4 w-4 text-white" />
      </div>
      <div
        className="flex items-center gap-2 px-3 py-2 bg-muted/30 relative transition-transform"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
      >
        <button className="shrink-0 active:scale-90 transition-transform" onClick={() => taskId && onToggle(taskId, subTask.id)}>
          {subTask.completed ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
        </button>
        <span className={cn('flex-1 text-sm', subTask.completed && 'line-through text-muted-foreground')}>{subTask.title}</span>
      </div>
    </div>
  )
}
