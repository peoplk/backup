'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import type { Goal, Milestone } from '@/lib/types'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Dialog,
  DialogContent,
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
import {
  Plus,
  Target,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Circle,
  Trash2,
  Edit,
  Flag,
  Clock,
  ChevronRight,
  Sparkles,
  Award,
  Link,
  GripVertical,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { AchievementsWall } from '@/components/achievements-wall'
import { COLOR_PALETTE } from '@/lib/palette'

const goalTypeConfig = {
  yearly: { label: '年度目标', color: 'bg-chart-1', icon: Flag },
  quarterly: { label: '季度目标', color: 'bg-chart-2', icon: Target },
  monthly: { label: '月度目标', color: 'bg-chart-3', icon: Calendar },
  weekly: { label: '周目标', color: 'bg-chart-4', icon: Clock },
}

const goalCategoryConfig = {
  work: { label: '工作', color: COLOR_PALETTE[0], icon: '💼' },
  personal: { label: '个人', color: COLOR_PALETTE[1], icon: '🌟' },
  health: { label: '健康', color: COLOR_PALETTE[3], icon: '💪' },
  learning: { label: '学习', color: COLOR_PALETTE[4], icon: '📚' },
  finance: { label: '财务', color: COLOR_PALETTE[2], icon: '💰' },
  other: { label: '其他', color: COLOR_PALETTE[6], icon: '📌' },
}

const goalStatusConfig = {
  'not-started': { label: '未开始', color: 'secondary' },
  'in-progress': { label: '进行中', color: 'default' },
  'completed': { label: '已完成', color: 'success' },
  'paused': { label: '已暂停', color: 'warning' },
}

export function GoalsView() {
  const {
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    addMilestone,
    toggleMilestone,
    deleteMilestone,
    reorderMilestones,
    tasks,
    setActiveView,
    undoLastDelete,
  } = useAppStore(useShallow((state) => ({
    goals: state.goals,
    addGoal: state.addGoal,
    updateGoal: state.updateGoal,
    deleteGoal: state.deleteGoal,
    addMilestone: state.addMilestone,
    toggleMilestone: state.toggleMilestone,
    deleteMilestone: state.deleteMilestone,
    reorderMilestones: state.reorderMilestones,
    tasks: state.tasks,
    setActiveView: state.setActiveView,
    undoLastDelete: state.undoLastDelete,
  })))

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    type: 'monthly' as Goal['type'],
    category: 'work' as Goal['category'],
    targetValue: 0,
    unit: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  })
  const [newMilestone, setNewMilestone] = useState('')
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const filteredGoals = useMemo(() => {
    return goals.filter((goal) => {
      if (selectedType !== 'all' && goal.type !== selectedType) return false
      if (selectedCategory !== 'all' && goal.category !== selectedCategory) return false
      return true
    })
  }, [goals, selectedType, selectedCategory])

  const goalsByStatus = useMemo(() => {
    return {
      'in-progress': filteredGoals.filter((g) => g.status === 'in-progress'),
      'not-started': filteredGoals.filter((g) => g.status === 'not-started'),
      'completed': filteredGoals.filter((g) => g.status === 'completed'),
      'paused': filteredGoals.filter((g) => g.status === 'paused'),
    }
  }, [filteredGoals])

  const stats = useMemo(() => {
    const total = goals.length
    const completed = goals.filter((g) => g.status === 'completed').length
    const inProgress = goals.filter((g) => g.status === 'in-progress').length
    const avgProgress = goals.length > 0
      ? Math.round(goals.reduce((acc, g) => acc + g.progress, 0) / goals.length)
      : 0

    return { total, completed, inProgress, avgProgress }
  }, [goals])

  const handleAddGoal = () => {
    if (!newGoal.title.trim()) return

    addGoal({
      ...newGoal,
      status: 'not-started',
      progress: 0,
      milestones: [],
      linkedTasks: [],
      startDate: new Date(newGoal.startDate),
      endDate: newGoal.endDate ? new Date(newGoal.endDate) : new Date(),
    })

    resetNewGoal()
    setIsAddDialogOpen(false)
  }

  const handleEditGoal = () => {
    if (!editingGoal || !newGoal.title.trim()) return

    updateGoal(editingGoal.id, {
      title: newGoal.title,
      description: newGoal.description,
      type: newGoal.type,
      category: newGoal.category,
      targetValue: newGoal.targetValue,
      unit: newGoal.unit,
      startDate: new Date(newGoal.startDate),
      endDate: newGoal.endDate ? new Date(newGoal.endDate) : editingGoal.endDate,
    })

    resetNewGoal()
    setEditingGoal(null)
    setIsAddDialogOpen(false)
  }

  const resetNewGoal = () => {
    setNewGoal({
      title: '',
      description: '',
      type: 'monthly',
      category: 'work',
      targetValue: 0,
      unit: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
    })
  }

  const openEditDialog = (goal: Goal) => {
    setEditingGoal(goal)
    setNewGoal({
      title: goal.title,
      description: goal.description || '',
      type: goal.type,
      category: goal.category,
      targetValue: goal.targetValue || 0,
      unit: goal.unit || '',
      startDate: new Date(goal.startDate).toISOString().split('T')[0],
      endDate: goal.endDate ? new Date(goal.endDate).toISOString().split('T')[0] : '',
    })
    setIsAddDialogOpen(true)
  }

  const handleAddMilestone = (goalId: string) => {
    if (!newMilestone.trim()) return
    addMilestone(goalId, { title: newMilestone.trim(), completed: false })
    setNewMilestone('')
  }

  const calculateProgress = (goal: Goal) => {
    if (goal.milestones.length === 0) return goal.progress
    const completedMilestones = goal.milestones.filter((m) => m.completed).length
    return Math.round((completedMilestones / goal.milestones.length) * 100)
  }

  const getDaysRemaining = (endDate: Date) => {
    const end = new Date(endDate)
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const SortableMilestoneItem = ({ milestone, goalId, toggleMilestone, deleteMilestone }: {
    milestone: Milestone
    goalId: string
    toggleMilestone: (goalId: string, milestoneId: string) => void
    deleteMilestone: (goalId: string, milestoneId: string) => void
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: milestone.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group flex items-center gap-2 p-2 rounded-lg transition-colors',
          'hover:bg-muted/50',
          isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/20 z-10'
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => toggleMilestone(goalId, milestone.id)}
          className={cn(
            'shrink-0 rounded-full transition-colors hover:scale-110',
            milestone.completed ? 'text-chart-2' : 'text-muted-foreground hover:text-chart-2'
          )}
        >
          {milestone.completed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>
        <span className={cn(
          'text-sm flex-1 truncate',
          milestone.completed && 'line-through text-muted-foreground'
        )}>
          {milestone.title}
        </span>
        {milestone.dueDate && (
          <span className="text-xs text-muted-foreground shrink-0">
            {new Date(milestone.dueDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={() => deleteMilestone(goalId, milestone.id)}
          aria-label="删除里程碑"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  const GoalCard = ({ goal }: { goal: Goal }) => {
    const typeConfig = goalTypeConfig[goal.type]
    const categoryConfig = goalCategoryConfig[goal.category]
    const statusConfig = goalStatusConfig[goal.status]
    const progress = calculateProgress(goal)
    const daysRemaining = getDaysRemaining(goal.endDate)
    const isExpanded = selectedGoalId === goal.id

    return (
      <Card className={cn(
        'overflow-hidden transition-all duration-200 hover:shadow-md',
        goal.status === 'completed' && 'opacity-70'
      )}>
        <div className={cn('h-1', typeConfig.color)} />
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <button
                onClick={() => setSelectedGoalId(isExpanded ? null : goal.id)}
                className={cn(
                  'mt-1 shrink-0 rounded-full p-1 transition-all',
                  goal.status === 'completed' ? 'text-chart-2' : 'text-muted-foreground hover:text-primary'
                )}
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
                    'font-semibold truncate',
                    goal.status === 'completed' && 'line-through'
                  )}>
                    {goal.title}
                  </h3>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {categoryConfig.icon} {categoryConfig.label}
                  </Badge>
                </div>
                {goal.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {goal.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {daysRemaining > 0 ? `${daysRemaining} 天后截止` : daysRemaining === 0 ? '今天截止' : '已过期'}
                  </span>
                  {goal.targetValue && goal.targetValue > 0 && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {goal.currentValue || 0}/{goal.targetValue} {goal.unit}
                    </span>
                  )}
                  {goal.milestones.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {goal.milestones.filter(m => m.completed).length}/{goal.milestones.length} 里程碑
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">进度</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openEditDialog(goal)}
                aria-label="编辑目标"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                aria-label="删除目标"
                onClick={() => {
                  deleteGoal(goal.id)
                  toast.success('目标已删除', {
                    description: goal.title,
                    action: {
                      label: '撤销',
                      onClick: () => undoLastDelete(),
                    },
                    duration: 5000,
                  })
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  里程碑
                </h4>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="添加里程碑..."
                    value={newMilestone}
                    onChange={(e) => setNewMilestone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddMilestone(goal.id)
                      }
                    }}
                    className="h-7 w-40 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => handleAddMilestone(goal.id)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {goal.milestones.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  添加里程碑来分解目标
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => {
                    const { active, over } = event
                    if (over && active.id !== over.id) {
                      const oldIndex = goal.milestones.findIndex(m => m.id === active.id)
                      const newIndex = goal.milestones.findIndex(m => m.id === over.id)
                      const newMilestones = arrayMove(goal.milestones, oldIndex, newIndex)
                      reorderMilestones(goal.id, newMilestones.map(m => m.id))
                    }
                  }}
                >
                  <SortableContext
                    items={goal.milestones.map(m => m.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {goal.milestones.map((milestone) => (
                        <SortableMilestoneItem
                          key={milestone.id}
                          milestone={milestone}
                          goalId={goal.id}
                          toggleMilestone={toggleMilestone}
                          deleteMilestone={deleteMilestone}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {goal.linkedTasks.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Link className="h-4 w-4" />
                    关联任务
                  </h4>
                  <div className="space-y-1">
                    {goal.linkedTasks.map((taskId) => {
                      const task = tasks.find((t) => t.id === taskId)
                      if (!task) return null
                      return (
                        <div
                          key={taskId}
                          className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => setActiveView('tasks')}
                        >
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span className={task.status === 'done' ? 'line-through text-muted-foreground' : ''}>
                            {task.title}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => updateGoal(goal.id, {
                    status: goal.status === 'in-progress' ? 'paused' : 'in-progress'
                  })}
                >
                  {goal.status === 'in-progress' ? '暂停' : '开始'}
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1"
                  onClick={() => updateGoal(goal.id, {
                    status: 'completed',
                    progress: 100,
                    completedAt: new Date()
                  })}
                >
                  完成
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">目标管理</h1>
          <p className="text-muted-foreground mt-0.5">设定目标，追踪进度，实现梦想</p>
        </div>
      </div>

      <Tabs defaultValue="goals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="goals" className="gap-2">
            <Target className="h-4 w-4" />
            我的目标
          </TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2">
            <Award className="h-4 w-4" />
            成就墙
          </TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) {
            setEditingGoal(null)
            resetNewGoal()
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              新建目标
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingGoal ? '编辑目标' : '创建新目标'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">目标标题</label>
                <Input
                  placeholder="输入目标标题..."
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">描述</label>
                <Textarea
                  placeholder="描述你的目标..."
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">目标类型</label>
                  <Select
                    value={newGoal.type}
                    onValueChange={(value: Goal['type']) => setNewGoal({ ...newGoal, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(goalTypeConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">分类</label>
                  <Select
                    value={newGoal.category}
                    onValueChange={(value: Goal['category']) => setNewGoal({ ...newGoal, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(goalCategoryConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.icon} {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">目标值（可选）</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="数值"
                      value={newGoal.targetValue || ''}
                      onChange={(e) => setNewGoal({ ...newGoal, targetValue: parseInt(e.target.value) || 0 })}
                    />
                    <Input
                      placeholder="单位"
                      value={newGoal.unit}
                      onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
                      className="w-20"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">开始日期</label>
                  <Input
                    type="date"
                    value={newGoal.startDate}
                    onChange={(e) => setNewGoal({ ...newGoal, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">截止日期</label>
                  <Input
                    type="date"
                    value={newGoal.endDate}
                    onChange={(e) => setNewGoal({ ...newGoal, endDate: e.target.value })}
                  />
                </div>
              </div>
              <Button
                onClick={editingGoal ? handleEditGoal : handleAddGoal}
                className="w-full"
              >
                {editingGoal ? '保存修改' : '创建目标'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-1/10 p-3">
                <Target className="h-5 w-5 text-chart-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总目标</p>
                <p className="text-xl font-bold tracking-tight">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-2/10 p-3">
                <CheckCircle2 className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">已完成</p>
                <p className="text-xl font-bold tracking-tight">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-3/10 p-3">
                <TrendingUp className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">进行中</p>
                <p className="text-xl font-bold tracking-tight">{stats.inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-4/10 p-3">
                <Award className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">平均进度</p>
                <p className="text-xl font-bold tracking-tight">{stats.avgProgress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="目标类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {Object.entries(goalTypeConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {Object.entries(goalCategoryConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.icon} {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="in-progress" className="space-y-4">
        <TabsList>
          <TabsTrigger value="in-progress" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            进行中
            <Badge variant="secondary" className="ml-1">
              {goalsByStatus['in-progress'].length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="not-started" className="gap-2">
            <Circle className="h-4 w-4" />
            未开始
            <Badge variant="secondary" className="ml-1">
              {goalsByStatus['not-started'].length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            已完成
            <Badge variant="secondary" className="ml-1">
              {goalsByStatus['completed'].length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="paused" className="gap-2">
            <Clock className="h-4 w-4" />
            已暂停
            <Badge variant="secondary" className="ml-1">
              {goalsByStatus['paused'].length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {(['in-progress', 'not-started', 'completed', 'paused'] as const).map((status) => (
          <TabsContent key={status} value={status}>
            {goalsByStatus[status].length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Target className="mx-auto h-12 w-12 opacity-50 mb-3" />
                  <p className="text-sm">
                    {status === 'in-progress' && '暂无进行中的目标'}
                    {status === 'not-started' && '暂无未开始的目标'}
                    {status === 'completed' && '暂无已完成的目标'}
                    {status === 'paused' && '暂无已暂停的目标'}
                  </p>
                  <p className="text-xs mt-1">点击上方"新建目标"创建第一个目标</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {goalsByStatus[status].map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <AchievementsWall />
        </TabsContent>
      </Tabs>

      {stats.completed > 0 && stats.completed === stats.total && (
        <Card className="border-chart-2 bg-chart-2/10">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-chart-2/20 p-3">
              <Sparkles className="h-6 w-6 text-chart-2" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-chart-2">太棒了！</p>
              <p className="text-sm text-muted-foreground">
                你已完成所有目标，继续保持！
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
