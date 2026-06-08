'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { APP_COLORS } from '@/lib/config'
import {
  Target, Plus, X, CheckCircle2, Circle, Clock,
  TrendingUp, Calendar, Flag, Pause, Play,
  Award, Trash2, Edit, ChevronDown, ChevronUp,
  Sparkles, Link2, Minus, ListTodo,
} from 'lucide-react'
import type { Goal } from '@/lib/types'

const goalTypeConfig: Record<Goal['type'], { label: string; color: string; icon: typeof Flag }> = {
  yearly: { label: '年度', color: 'bg-blue-500', icon: Flag },
  quarterly: { label: '季度', color: 'bg-purple-500', icon: Target },
  monthly: { label: '月度', color: 'bg-amber-500', icon: Calendar },
  weekly: { label: '周', color: 'bg-emerald-500', icon: Clock },
}

const goalCategoryConfig: Record<Goal['category'], { label: string; color: string; icon: string }> = {
  work: { label: '工作', color: APP_COLORS.blue, icon: '💼' },
  personal: { label: '个人', color: APP_COLORS.green, icon: '🌟' },
  health: { label: '健康', color: APP_COLORS.pink, icon: '💪' },
  learning: { label: '学习', color: APP_COLORS.purple, icon: '📚' },
  finance: { label: '财务', color: APP_COLORS.orange, icon: '💰' },
  other: { label: '其他', color: APP_COLORS.gray, icon: '📌' },
}

type StatusFilter = 'all' | 'in-progress' | 'not-started' | 'completed' | 'paused'

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'in-progress', label: '进行中' },
  { id: 'not-started', label: '未开始' },
  { id: 'completed', label: '已完成' },
  { id: 'paused', label: '已暂停' },
]

interface GoalFormData {
  title: string
  description: string
  type: Goal['type']
  category: Goal['category']
  targetValue: number
  unit: string
  startDate: string
  endDate: string
}

const defaultFormData: GoalFormData = {
  title: '',
  description: '',
  type: 'monthly',
  category: 'work',
  targetValue: 0,
  unit: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
}

export function MobileGoalsView() {
  const { goals, tasks, addGoal, updateGoal, deleteGoal, addMilestone, toggleMilestone } = useAppStore(
    useShallow(state => ({
      goals: state.goals,
      tasks: state.tasks,
      addGoal: state.addGoal,
      updateGoal: state.updateGoal,
      deleteGoal: state.deleteGoal,
      addMilestone: state.addMilestone,
      toggleMilestone: state.toggleMilestone,
    }))
  )

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [formData, setFormData] = useState<GoalFormData>(defaultFormData)
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null)
  const [newMilestoneText, setNewMilestoneText] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showTaskPicker, setShowTaskPicker] = useState<string | null>(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const stats = useMemo(() => {
    const total = goals.length
    const completed = goals.filter(g => g.status === 'completed').length
    const inProgress = goals.filter(g => g.status === 'in-progress').length
    const avgProgress = goals.length > 0
      ? Math.round(goals.reduce((acc, g) => acc + g.progress, 0) / goals.length)
      : 0
    return { total, completed, inProgress, avgProgress }
  }, [goals])

  const filteredGoals = useMemo(() => {
    if (statusFilter === 'all') return goals
    return goals.filter(g => g.status === statusFilter)
  }, [goals, statusFilter])

  const getDaysRemaining = (endDate: Date) => {
    const end = new Date(endDate)
    end.setHours(0, 0, 0, 0)
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const calculateProgress = (goal: Goal) => {
    if (goal.milestones.length === 0) return goal.progress
    const completedMilestones = goal.milestones.filter(m => m.completed).length
    return Math.round((completedMilestones / goal.milestones.length) * 100)
  }

  const handleOpenAdd = () => {
    setEditingGoal(null)
    setFormData(defaultFormData)
    setShowAddSheet(true)
  }

  const handleOpenEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setFormData({
      title: goal.title,
      description: goal.description || '',
      type: goal.type,
      category: goal.category,
      targetValue: goal.targetValue || 0,
      unit: goal.unit || '',
      startDate: new Date(goal.startDate).toISOString().split('T')[0],
      endDate: goal.endDate ? new Date(goal.endDate).toISOString().split('T')[0] : '',
    })
    setShowAddSheet(true)
  }

  const handleCloseSheet = () => {
    setShowAddSheet(false)
    setEditingGoal(null)
    setFormData(defaultFormData)
  }

  const handleSave = () => {
    if (!formData.title.trim()) return

    if (editingGoal) {
      updateGoal(editingGoal.id, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        category: formData.category,
        targetValue: formData.targetValue || undefined,
        unit: formData.unit.trim() || undefined,
        startDate: new Date(formData.startDate),
        endDate: formData.endDate ? new Date(formData.endDate) : editingGoal.endDate,
      })
    } else {
      addGoal({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        category: formData.category,
        status: 'not-started',
        progress: 0,
        targetValue: formData.targetValue || undefined,
        currentValue: 0,
        unit: formData.unit.trim() || undefined,
        startDate: new Date(formData.startDate),
        endDate: formData.endDate ? new Date(formData.endDate) : new Date(),
        milestones: [],
        linkedTasks: [],
      })
    }

    handleCloseSheet()
  }

  const handleAddMilestone = (goalId: string) => {
    if (!newMilestoneText.trim()) return
    addMilestone(goalId, { title: newMilestoneText.trim(), completed: false })
    setNewMilestoneText('')
  }

  const handleDeleteGoal = (goalId: string) => {
    deleteGoal(goalId)
    setShowDeleteConfirm(null)
    setExpandedGoalId(null)
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-emerald-500'
    if (progress >= 50) return 'bg-blue-500'
    if (progress >= 25) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const getStatusBadgeStyle = (status: Goal['status']) => {
    switch (status) {
      case 'in-progress': return 'bg-blue-500/10 text-blue-500'
      case 'not-started': return 'bg-muted text-muted-foreground'
      case 'completed': return 'bg-emerald-500/10 text-emerald-500'
      case 'paused': return 'bg-amber-500/10 text-amber-500'
    }
  }

  const getStatusLabel = (status: Goal['status']) => {
    switch (status) {
      case 'in-progress': return '进行中'
      case 'not-started': return '未开始'
      case 'completed': return '已完成'
      case 'paused': return '已暂停'
    }
  }

  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      <div className="rounded-2xl glass-card p-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-xl font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground">总目标</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-emerald-500">{stats.completed}</p>
            <p className="text-[10px] text-muted-foreground">已完成</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-blue-500">{stats.inProgress}</p>
            <p className="text-[10px] text-muted-foreground">进行中</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-amber-500">{stats.avgProgress}%</p>
            <p className="text-[10px] text-muted-foreground">平均进度</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {STATUS_TABS.map(tab => {
          const count = tab.id === 'all'
            ? goals.length
            : goals.filter(g => g.status === tab.id).length
          return (
            <button
              key={tab.id}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95',
                statusFilter === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground'
              )}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label} {count > 0 && `(${count})`}
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        {filteredGoals.length > 0 ? filteredGoals.map(goal => {
          const typeConfig = goalTypeConfig[goal.type]
          const categoryConfig = goalCategoryConfig[goal.category]
          const progress = calculateProgress(goal)
          const daysRemaining = getDaysRemaining(goal.endDate)
          const isExpanded = expandedGoalId === goal.id
          const isOverdue = daysRemaining < 0 && goal.status !== 'completed'

          return (
            <div
              key={goal.id}
              className={cn(
                'rounded-2xl border overflow-hidden transition-all',
                goal.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-card border-border/40'
              )}
            >
              <div className={cn('h-1', typeConfig.color)} />

              <div className="p-4">
                <div className="flex items-start gap-3">
                  <button
                    className={cn(
                      'shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center transition-all active:scale-90',
                      goal.status === 'completed'
                        ? 'text-emerald-500'
                        : 'text-muted-foreground/40'
                    )}
                    onClick={() => {
                      if (goal.status === 'completed') {
                        updateGoal(goal.id, { status: 'in-progress', completedAt: undefined })
                      } else {
                        updateGoal(goal.id, { status: 'completed', progress: 100, completedAt: new Date() })
                      }
                    }}
                  >
                    {goal.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={cn(
                        'text-sm font-semibold truncate',
                        goal.status === 'completed' && 'line-through text-muted-foreground'
                      )}>
                        {goal.title}
                      </h3>
                      <span className={cn(
                        'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white',
                        typeConfig.color
                      )}>
                        {typeConfig.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${categoryConfig.color}15`,
                          color: categoryConfig.color,
                        }}
                      >
                        {categoryConfig.icon} {categoryConfig.label}
                      </span>
                      <span className={cn(
                        'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                        getStatusBadgeStyle(goal.status)
                      )}>
                        {getStatusLabel(goal.status)}
                      </span>
                    </div>

                    {goal.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        {goal.description}
                      </p>
                    )}

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">进度</span>
                        <span className="font-semibold">{progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', getProgressColor(progress))}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span className={cn('flex items-center gap-0.5', isOverdue && 'text-red-500')}>
                        <Calendar className="h-3 w-3" />
                        {daysRemaining > 0 ? `${daysRemaining}天` : daysRemaining === 0 ? '今天截止' : `过期${Math.abs(daysRemaining)}天`}
                      </span>
                      {goal.targetValue && goal.targetValue > 0 && (
                        <span className="flex items-center gap-0.5">
                          <TrendingUp className="h-3 w-3" />
                          {goal.currentValue || 0}/{goal.targetValue} {goal.unit || ''}
                        </span>
                      )}
                      {goal.milestones.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Target className="h-3 w-3" />
                          {goal.milestones.filter(m => m.completed).length}/{goal.milestones.length}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    className="shrink-0 p-1 text-muted-foreground active:scale-90 transition-transform"
                    onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-border/30">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" />
                        里程碑
                      </h4>
                    </div>

                    {goal.milestones.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {goal.milestones.map(milestone => (
                          <div key={milestone.id} className="flex items-center gap-2 py-1">
                            <button
                              className={cn(
                                'shrink-0 transition-all active:scale-90',
                                milestone.completed ? 'text-emerald-500' : 'text-muted-foreground/40'
                              )}
                              onClick={() => toggleMilestone(goal.id, milestone.id)}
                            >
                              {milestone.completed ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <Circle className="h-4 w-4" />
                              )}
                            </button>
                            <span className={cn(
                              'text-xs flex-1',
                              milestone.completed && 'line-through text-muted-foreground'
                            )}>
                              {milestone.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="text"
                        placeholder="添加里程碑..."
                        className="flex-1 h-8 px-3 rounded-xl bg-muted/50 text-xs outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                        value={newMilestoneText}
                        onChange={e => setNewMilestoneText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddMilestone(goal.id)
                        }}
                      />
                      <button
                        className={cn(
                          'h-8 w-8 rounded-xl flex items-center justify-center transition-all active:scale-90',
                          newMilestoneText.trim()
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground'
                        )}
                        onClick={() => handleAddMilestone(goal.id)}
                        disabled={!newMilestoneText.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 进度更新 - 当有目标值时显示 */}
                    {goal.targetValue && goal.targetValue > 0 && (() => {
                      const cv = goal.currentValue || 0
                      const tv = goal.targetValue
                      const pct = Math.min(Math.round((cv / tv) * 100), 100)
                      return (
                        <div className="mb-4 pt-3 border-t border-border/30">
                          <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                            <TrendingUp className="h-3.5 w-3.5" />
                            进度更新
                          </h4>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-muted-foreground">当前 / 目标</span>
                            <span className="font-semibold">{cv} / {tv} {goal.unit || ''}</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden mb-3">
                            <div
                              className={cn('h-full rounded-full transition-all duration-500', getProgressColor(pct))}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center text-sm font-medium active:scale-90 transition-transform"
                              onClick={() => {
                                const nv = Math.max(0, cv - 1)
                                updateGoal(goal.id, { currentValue: nv, progress: Math.round((nv / tv) * 100) })
                              }}
                            >−</button>
                            <input
                              type="number"
                              className="flex-1 h-8 px-3 rounded-xl bg-muted/50 text-xs text-center outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
                              value={cv}
                              min={0}
                              onChange={e => {
                                const nv = Math.max(0, parseInt(e.target.value) || 0)
                                updateGoal(goal.id, { currentValue: nv, progress: Math.round((nv / tv) * 100) })
                              }}
                            />
                            <button
                              className="h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center text-sm font-medium active:scale-90 transition-transform"
                              onClick={() => {
                                const nv = cv + 1
                                updateGoal(goal.id, { currentValue: nv, progress: Math.round((nv / tv) * 100) })
                              }}
                            >+</button>
                          </div>
                        </div>
                      )
                    })()}

                    {/* 关联任务管理 */}
                    <div className="mb-4 pt-3 border-t border-border/30">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5">
                          <Link2 className="h-3.5 w-3.5" />
                          关联任务
                        </h4>
                        <button
                          className="h-6 px-2 rounded-lg bg-primary/10 text-primary text-[10px] font-medium flex items-center gap-1 active:scale-95 transition-transform"
                          onClick={() => setShowTaskPicker(showTaskPicker === goal.id ? null : goal.id)}
                        >
                          <Plus className="h-3 w-3" /> 添加
                        </button>
                      </div>

                      {goal.linkedTasks.length > 0 ? (
                        <div className="space-y-1 mb-2">
                          {goal.linkedTasks.map(taskId => {
                            const task = tasks.find(t => t.id === taskId)
                            if (!task) return null
                            return (
                              <div key={taskId} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/30">
                                <span className={cn(
                                  'shrink-0 text-[10px]',
                                  task.status === 'done' ? 'text-emerald-500' : 'text-muted-foreground/50'
                                )}>
                                  {task.status === 'done' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                                </span>
                                <span className={cn(
                                  'text-xs flex-1 truncate',
                                  task.status === 'done' && 'line-through text-muted-foreground'
                                )}>
                                  {task.title}
                                </span>
                                <button
                                  className="shrink-0 h-5 w-5 rounded-md bg-red-500/10 text-red-500 flex items-center justify-center active:scale-90 transition-transform"
                                  onClick={() => updateGoal(goal.id, {
                                    linkedTasks: goal.linkedTasks.filter(id => id !== taskId)
                                  })}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground/60 mb-2">暂无关联任务</p>
                      )}

                      {showTaskPicker === goal.id && (() => {
                        const availableTasks = tasks.filter(t =>
                          t.status !== 'done' && !goal.linkedTasks.includes(t.id)
                        )
                        return (
                          <div className="rounded-xl bg-muted/30 p-2 max-h-40 overflow-y-auto">
                            {availableTasks.length > 0 ? availableTasks.map(task => (
                              <button
                                key={task.id}
                                className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 active:scale-[0.98] transition-transform text-left"
                                onClick={() => updateGoal(goal.id, {
                                  linkedTasks: [...goal.linkedTasks, task.id]
                                })}
                              >
                                <ListTodo className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs truncate">{task.title}</span>
                              </button>
                            )) : (
                              <p className="text-[11px] text-muted-foreground/60 text-center py-2">没有可添加的任务</p>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    <div className="flex items-center gap-2">
                      {goal.status !== 'completed' && (
                        <>
                          {goal.status === 'in-progress' ? (
                            <button
                              className="flex-1 h-9 rounded-xl bg-amber-500/10 text-amber-600 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                              onClick={() => updateGoal(goal.id, { status: 'paused' })}
                            >
                              <Pause className="h-3.5 w-3.5" /> 暂停
                            </button>
                          ) : (
                            <button
                              className="flex-1 h-9 rounded-xl bg-blue-500/10 text-blue-600 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                              onClick={() => updateGoal(goal.id, { status: 'in-progress' })}
                            >
                              <Play className="h-3.5 w-3.5" /> 开始
                            </button>
                          )}
                          <button
                            className="flex-1 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                            onClick={() => updateGoal(goal.id, { status: 'completed', progress: 100, completedAt: new Date() })}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> 完成
                          </button>
                        </>
                      )}
                      {goal.status === 'completed' && (
                        <button
                          className="flex-1 h-9 rounded-xl bg-blue-500/10 text-blue-600 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                          onClick={() => updateGoal(goal.id, { status: 'in-progress', progress: goal.progress === 100 ? 0 : goal.progress, completedAt: undefined })}
                        >
                          <Play className="h-3.5 w-3.5" /> 重新开始
                        </button>
                      )}
                      <button
                        className="h-9 px-3 rounded-xl bg-muted/50 text-muted-foreground text-xs font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                        onClick={() => handleOpenEdit(goal)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      {showDeleteConfirm === goal.id ? (
                        <button
                          className="h-9 px-3 rounded-xl bg-red-500 text-white text-xs font-medium flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
                          onClick={() => handleDeleteGoal(goal.id)}
                        >
                          确认
                        </button>
                      ) : (
                        <button
                          className="h-9 px-3 rounded-xl bg-red-500/10 text-red-500 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                          onClick={() => setShowDeleteConfirm(goal.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        }) : (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">
              {statusFilter === 'all' ? '还没有目标' : `没有${STATUS_TABS.find(t => t.id === statusFilter)?.label || ''}目标`}
            </p>
            <p className="text-xs mt-1">点击下方添加你的第一个目标</p>
          </div>
        )}
      </div>

      {stats.completed > 0 && stats.completed === stats.total && goals.length > 0 && (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/20 p-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-600">太棒了！</p>
            <p className="text-xs text-muted-foreground">你已完成所有目标，继续保持！</p>
          </div>
        </div>
      )}

      <button
        className="w-full h-12 rounded-2xl border-2 border-dashed border-border/50 flex items-center justify-center gap-2 text-sm text-muted-foreground active:scale-[0.98] transition-transform"
        onClick={handleOpenAdd}
      >
        <Plus className="h-4 w-4" /> 添加目标
      </button>

      {showAddSheet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={handleCloseSheet}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6 pb-8 safe-area-bottom glass-sheet max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">
                {editingGoal ? '编辑目标' : '添加目标'}
              </h3>
              <button
                className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center"
                onClick={handleCloseSheet}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">标题</label>
                <input
                  type="text"
                  placeholder="目标标题"
                  className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">描述</label>
                <textarea
                  placeholder="描述你的目标..."
                  className="w-full h-20 px-3 py-2 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">类型</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(goalTypeConfig) as [Goal['type'], typeof goalTypeConfig[Goal['type']]][]).map(([key, config]) => (
                    <button
                      key={key}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-transform',
                        formData.type === key
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground'
                      )}
                      onClick={() => setFormData({ ...formData, type: key })}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">分类</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(goalCategoryConfig) as [Goal['category'], typeof goalCategoryConfig[Goal['category']]][]).map(([key, config]) => (
                    <button
                      key={key}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-transform',
                        formData.category === key
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground'
                      )}
                      onClick={() => setFormData({ ...formData, category: key })}
                    >
                      {config.icon} {config.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">目标值与单位</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="目标值"
                    className="flex-1 h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.targetValue || ''}
                    onChange={e => setFormData({ ...formData, targetValue: parseInt(e.target.value) || 0 })}
                  />
                  <input
                    type="text"
                    placeholder="单位"
                    className="w-20 h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">开始日期</label>
                  <input
                    type="date"
                    className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">截止日期</label>
                  <input
                    type="date"
                    className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <button
                className={cn(
                  'w-full h-12 rounded-2xl font-medium text-sm transition-all active:scale-[0.98]',
                  formData.title.trim()
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground'
                )}
                onClick={handleSave}
                disabled={!formData.title.trim()}
              >
                {editingGoal ? '保存修改' : '创建目标'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
