'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAppStore, Project } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { useDataLink } from '@/lib/data-link-service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Play,
  Pause,
  Clock,
  Calendar,
  Tag,
  ChevronLeft,
  ChevronRight,
  Timer,
  TrendingUp,
  Plus,
  Trash2,
  Edit,
  FolderPlus,
  MoreVertical,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, formatDurationShort } from '@/lib/format'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const projectColors = [
  '#4A90E2', '#7ED321', '#F5A623', '#9B59B6', '#E91E63', 
  '#00CED1', '#FF5722', '#607D8B', '#8BC34A', '#FF9800'
]

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const getDayName = (date: Date) => {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[date.getDay()]
}

export function TimeTracker() {
  const {
    projects,
    timeEntries,
    activeTimeEntry,
    startTimeEntry,
    stopTimeEntry,
    addTimeEntry,
    addProject,
    updateProject,
    deleteProject,
    tasks,
  } = useAppStore(
    useShallow((state) => ({
      projects: state.projects,
      timeEntries: state.timeEntries,
      activeTimeEntry: state.activeTimeEntry,
      startTimeEntry: state.startTimeEntry,
      stopTimeEntry: state.stopTimeEntry,
      addTimeEntry: state.addTimeEntry,
      addProject: state.addProject,
      updateProject: state.updateProject,
      deleteProject: state.deleteProject,
      tasks: state.tasks,
    }))
  )

  const [currentTime, setCurrentTime] = useState(0)
  const [description, setDescription] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [newProject, setNewProject] = useState({ name: '', color: '#4A90E2' })
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null)
  const [manualEntryError, setManualEntryError] = useState<string | null>(null)
  const [manualEntry, setManualEntry] = useState({
    projectId: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
  })

  const activeStartTime = activeTimeEntry?.startTime
  useEffect(() => {
    if (!activeStartTime) {
      setCurrentTime(0)
      return
    }
    const start = new Date(activeStartTime).getTime()
    const tick = () => setCurrentTime(Math.floor((Date.now() - start) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeStartTime])

  const dataLink = useDataLink()

  useEffect(() => {
    if (projects.length > 0 && !projects.some(p => p.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id)
    } else if (projects.length === 0) {
      setSelectedProjectId('')
    }
  }, [projects, selectedProjectId])

  const selectedProject = useMemo(
    () => projects.find(p => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  )
  const selectedProjectName = selectedProject?.name || ''

  const handleStart = () => {
    const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null
    startTimeEntry({
      project: selectedProjectName,
      projectId: selectedProjectId || undefined,
      description: description || selectedTask?.title || '',
      tags: selectedTask?.tags || [],
      taskId: selectedTaskId || undefined,
    })
  }

  const handleStop = () => {
    const stoppedId = activeTimeEntry?.id
    stopTimeEntry()
    setCurrentTime(0)
    setDescription('')
    if (stoppedId) {
      const stored = useAppStore.getState().timeEntries.find(e => e.id === stoppedId)
      if (stored) dataLink.handleTimeEntryAdded(stored)
    }
  }

  const handleAddProject = () => {
    if (!newProject.name.trim()) return
    const created = addProject(newProject)
    if (created) {
      setSelectedProjectId(created.id)
    } else {
      const matched = projects.find(p => p.name === newProject.name)
      if (matched) setSelectedProjectId(matched.id)
    }
    setNewProject({ name: '', color: '#4A90E2' })
    setIsProjectDialogOpen(false)
  }

  const handleEditProject = () => {
    if (!editingProject || !newProject.name.trim()) return
    updateProject(editingProject.id, { name: newProject.name, color: newProject.color })
    setEditingProject(null)
    setNewProject({ name: '', color: '#4A90E2' })
    setIsProjectDialogOpen(false)
  }

  const openEditDialog = (project: Project) => {
    setEditingProject(project)
    setNewProject({ name: project.name, color: project.color })
    setIsProjectDialogOpen(true)
  }

  const matchesProject = (entry: { projectId?: string; project: string }, projectId: string) => {
    if (entry.projectId) return entry.projectId === projectId
    const legacy = projects.find(p => p.id === projectId)
    return legacy ? legacy.name === entry.project : false
  }

  const getProjectStats = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return { taskCount: 0, entryCount: 0, totalTime: 0 }
    const projectTasks = tasks.filter(t => t.project === project.name)
    const projectEntries = timeEntries.filter(e => matchesProject(e, projectId))
    const totalTime = projectEntries.reduce((acc, e) => acc + e.duration, 0)
    return {
      taskCount: projectTasks.length,
      entryCount: projectEntries.length,
      totalTime,
    }
  }

  const handleDeleteProject = (project: Project) => {
    const stats = getProjectStats(project.id)
    if (stats.entryCount > 0 || stats.taskCount > 0) {
      setDeleteConfirmProject(project)
    } else {
      deleteProject(project.id)
      if (selectedProjectId === project.id && projects.length > 0) {
        setSelectedProjectId(projects[0].id)
      }
    }
  }

  const confirmDeleteProject = () => {
    if (!deleteConfirmProject) return
    const removedId = deleteConfirmProject.id
    deleteProject(removedId)
    if (selectedProjectId === removedId && projects.length > 0) {
      setSelectedProjectId(projects[0].id)
    }
    setDeleteConfirmProject(null)
  }

  const todayEntries = useMemo(
    () =>
      timeEntries.filter(
        (entry) =>
          new Date(entry.startTime).toDateString() === selectedDate.toDateString()
      ),
    [timeEntries, selectedDate]
  )

  const totalTodayTime = todayEntries.reduce((acc, entry) => acc + entry.duration, 0)
  const dailyGoal = 8 * 60 * 60
  const goalProgress = Math.min((totalTodayTime / dailyGoal) * 100, 100)

  const projectStats = useMemo(
    () =>
      projects.map((project) => {
        const projectEntries = todayEntries.filter((e) => matchesProject(e, project.id))
        const totalTime = projectEntries.reduce((acc, e) => acc + e.duration, 0)
        return { ...project, todayTime: totalTime }
      }),
    [projects, todayEntries]
  )

  const weeklyData = useMemo(() => {
    const result = []
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1)

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      const dateStr = date.toDateString()

      const dayEntries = timeEntries.filter(
        (e) => new Date(e.startTime).toDateString() === dateStr
      )
      const hours = dayEntries.reduce((acc, e) => acc + e.duration, 0) / 3600

      const isToday = date.toDateString() === today.toDateString()
      const isWeekend = date.getDay() === 0 || date.getDay() === 6

      result.push({
        name: getDayName(date),
        hours: Math.round(hours * 10) / 10,
        color: isToday ? '#7ED321' : isWeekend ? '#F5A623' : '#4A90E2',
      })
    }
    return result
  }, [timeEntries])

  const weekStats = useMemo(() => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1)
    startOfWeek.setHours(0, 0, 0, 0)

    const weekEntries = timeEntries.filter(
      (e) => new Date(e.startTime) >= startOfWeek
    )
    const weekHours = weekEntries.reduce((acc, e) => acc + e.duration, 0) / 3600

    const lastWeekStart = new Date(startOfWeek)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const lastWeekEntries = timeEntries.filter(
      (e) => new Date(e.startTime) >= lastWeekStart && new Date(e.startTime) < startOfWeek
    )
    const lastWeekHours = lastWeekEntries.reduce((acc, e) => acc + e.duration, 0) / 3600

    const hoursChange = lastWeekHours > 0
      ? Math.round(((weekHours - lastWeekHours) / lastWeekHours) * 100)
      : 0

    const daysWithEntries = new Set(
      weekEntries.map((e) => new Date(e.startTime).toDateString())
    ).size
    const avgDailyHours = daysWithEntries > 0 ? weekHours / daysWithEntries : 0

    return { weekHours, hoursChange, avgDailyHours }
  }, [timeEntries])

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    setSelectedDate(newDate)
  }

  const parseTimeOnDate = (dateStr: string, timeStr: string): Date | null => {
    const parts = timeStr.split(':')
    if (parts.length < 2) return null
    const hours = Number(parts[0])
    const minutes = Number(parts[1])
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return null
    d.setHours(hours, minutes, 0, 0)
    return d
  }

  const handleManualEntry = () => {
    setManualEntryError(null)
    if (!manualEntry.projectId) {
      setManualEntryError('请选择项目')
      return
    }
    const project = projects.find(p => p.id === manualEntry.projectId)
    if (!project) {
      setManualEntryError('项目不存在或已删除')
      return
    }
    const startDate = parseTimeOnDate(manualEntry.date, manualEntry.startTime)
    const endDate = parseTimeOnDate(manualEntry.date, manualEntry.endTime)
    if (!startDate || !endDate) {
      setManualEntryError('时间格式无效')
      return
    }
    const duration = Math.floor((endDate.getTime() - startDate.getTime()) / 1000)
    if (duration <= 0) {
      setManualEntryError('结束时间必须晚于开始时间')
      return
    }
    const newId = addTimeEntry({
      project: project.name,
      projectId: project.id,
      description: manualEntry.description || undefined,
      startTime: startDate,
      endTime: endDate,
      duration,
      tags: [],
    })
    if (newId) {
      const newEntry = useAppStore.getState().timeEntries.find(e => e.id === newId)
      if (newEntry) dataLink.handleTimeEntryAdded(newEntry)
    }
    setIsManualEntryOpen(false)
    setManualEntry({
      projectId: projects[0]?.id || '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:00',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            setManualEntryError(null)
            setManualEntry(prev => ({ ...prev, projectId: projects[0]?.id || '' }))
            setIsManualEntryOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          手动添加
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/8 via-primary/4 to-transparent p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'flex h-20 w-20 items-center justify-center rounded-2xl',
                    activeTimeEntry
                      ? 'bg-chart-2/20 text-chart-2'
                      : 'bg-primary/10 text-primary'
                  )}
                >
                  {activeTimeEntry ? (
                    <Timer className="h-10 w-10 animate-pulse-soft" />
                  ) : (
                    <Clock className="h-10 w-10" />
                  )}
                </div>
                <div>
                  <p className="text-5xl font-bold font-[var(--font-timer)] tracking-tight tabular-nums">
                    {formatTime(activeTimeEntry ? currentTime : 0)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeTimeEntry
                      ? `正在记录: ${activeTimeEntry.project}`
                      : '准备开始记录'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:w-[400px]">
              <Input
                placeholder="你正在做什么？"
                value={activeTimeEntry ? activeTimeEntry.description : description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!!activeTimeEntry}
                className="h-12"
              />
              <Select
                value={selectedTaskId || 'none'}
                onValueChange={(v) => setSelectedTaskId(v === 'none' ? null : v)}
                disabled={!!activeTimeEntry}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="关联任务（可选）" />
                </SelectTrigger>
                <SelectContent align="center" className="min-w-[200px]">
                  <SelectItem value="none">不关联任务</SelectItem>
                  {tasks.filter(t => t.status !== 'done').map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px]">{task.title}</span>
                        {task.project && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {task.project}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select
                  value={selectedProjectId || 'none'}
                  onValueChange={(v) => setSelectedProjectId(v === 'none' ? '' : v)}
                  disabled={!!activeTimeEntry}
                >
                  <SelectTrigger className="h-12 flex-1">
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent align="center" className="min-w-[160px]">
                    <SelectItem value="none">不选择项目</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => {
                    setEditingProject(null)
                    setNewProject({ name: '', color: '#4A90E2' })
                    setIsProjectDialogOpen(true)
                  }}
                >
                  <Plus className="h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  className={cn(
                    'h-12 w-12',
                    activeTimeEntry
                      ? 'bg-destructive hover:bg-destructive/90'
                      : 'bg-chart-2 hover:bg-chart-2/90'
                  )}
                  onClick={activeTimeEntry ? handleStop : handleStart}
                  disabled={projects.length === 0 && !activeTimeEntry}
                >
                  {activeTimeEntry ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-1/10 p-3">
                <Clock className="h-5 w-5 text-chart-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">今日工时</p>
                <p className="text-xl font-bold tracking-tight">{formatDuration(totalTodayTime)}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>日目标进度</span>
                <span>{Math.round(goalProgress)}%</span>
              </div>
              <Progress value={goalProgress} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-2/10 p-3">
                <Calendar className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">本周工时</p>
                <p className="text-xl font-bold tracking-tight">{weekStats.weekHours.toFixed(1)}h</p>
              </div>
            </div>
            <p className={cn(
              "mt-3 text-xs font-medium",
              weekStats.hoursChange >= 0 ? "text-chart-2" : "text-destructive"
            )}>
              比上周 {weekStats.hoursChange >= 0 ? '+' : ''}{weekStats.hoursChange}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-3/10 p-3">
                <Tag className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">活跃项目</p>
                <p className="text-xl font-bold tracking-tight">{projects.length}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">正在追踪中</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-4/10 p-3">
                <TrendingUp className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">平均日工时</p>
                <p className="text-xl font-bold tracking-tight">{weekStats.avgDailyHours.toFixed(1)}h</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-chart-4 font-medium">
              {weekStats.avgDailyHours >= 6 ? '效率良好' : weekStats.avgDailyHours >= 4 ? '效率稳定' : '有待提升'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">本周工时分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#999', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#999', fontSize: 12 }}
                    tickFormatter={(value) => `${value}h`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value: number) => [`${value} 小时`, '工作时间']}
                  />
                  <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
                    {weeklyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              项目管理
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                setEditingProject(null)
                setNewProject({ name: '', color: '#4A90E2' })
                setIsProjectDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              新建
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {projectStats.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <FolderPlus className="mx-auto h-10 w-10 opacity-50 mb-2" />
                <p className="text-sm">暂无项目</p>
                <p className="text-xs mt-1">点击"新建"创建第一个项目</p>
              </div>
            ) : (
              projectStats.map((project) => {
                const percentage = totalTodayTime > 0
                  ? Math.round((project.todayTime / totalTodayTime) * 100)
                  : 0
                const stats = getProjectStats(project.id)
                return (
                  <div
                    key={project.id}
                    className="rounded-lg border p-3 transition-all hover:border-primary/30 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="h-4 w-4 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{project.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{formatDuration(project.todayTime)} 今日</span>
                            {stats.taskCount > 0 && (
                              <span>· {stats.taskCount} 任务</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(project)}>
                            <Edit className="mr-2 h-4 w-4" />
                            编辑项目
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteProject(project)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除项目
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: project.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg font-semibold">时间记录</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateDate('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">
                {selectedDate.toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateDate('next')}
                disabled={selectedDate.toDateString() === new Date().toDateString()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {todayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-lg font-medium">暂无记录</p>
              <p className="text-sm text-muted-foreground">
                点击上方的开始按钮来记录你的工作时间
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayEntries.map((entry) => {
                const project = entry.projectId
                  ? projects.find(p => p.id === entry.projectId)
                  : projects.find(p => p.name === entry.project)
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 rounded-xl border p-4 transition-all hover:border-primary/30"
                  >
                    <div
                      className="h-10 w-1 rounded-full"
                      style={{ backgroundColor: project?.color || '#999' }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">
                        {entry.description || '无描述'}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {entry.project}
                        </Badge>
                        <span>
                          {new Date(entry.startTime).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {entry.endTime &&
                            ` - ${new Date(entry.endTime).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{formatDuration(entry.duration)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isProjectDialogOpen} onOpenChange={(open) => {
        setIsProjectDialogOpen(open)
        if (!open) {
          setEditingProject(null)
          setNewProject({ name: '', color: '#4A90E2' })
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProject ? '编辑项目' : '新建项目'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">项目名称</label>
              <Input
                placeholder="输入项目名称..."
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">项目颜色</label>
              <div className="flex flex-wrap gap-2">
                {projectColors.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      'h-8 w-8 rounded-full transition-all',
                      newProject.color === color && 'ring-2 ring-offset-2 ring-primary'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewProject({ ...newProject, color })}
                  />
                ))}
              </div>
            </div>
            <Button 
              onClick={editingProject ? handleEditProject : handleAddProject} 
              className="w-full"
            >
              {editingProject ? '保存修改' : '创建项目'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmProject} onOpenChange={() => setDeleteConfirmProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const stats = deleteConfirmProject ? getProjectStats(deleteConfirmProject.id) : null
                return (
                  <>
                    项目 "{deleteConfirmProject?.name}" 包含以下关联数据：
                    <ul className="mt-2 space-y-1 text-sm">
                      {(stats?.taskCount ?? 0) > 0 && (
                        <li>· {stats!.taskCount} 个关联任务</li>
                      )}
                      {(stats?.entryCount ?? 0) > 0 && (
                        <li>· {stats!.entryCount} 条时间记录</li>
                      )}
                    </ul>
                    <p className="mt-3 text-destructive">删除项目后，关联的时间记录将保留但不再显示项目名称。确定要继续吗？</p>
                  </>
                )
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteProject}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isManualEntryOpen} onOpenChange={(open) => {
        setIsManualEntryOpen(open)
        if (!open) setManualEntryError(null)
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>手动添加时间记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">项目</label>
              <Select
                value={manualEntry.projectId || 'none'}
                onValueChange={(v) => setManualEntry({ ...manualEntry, projectId: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent align="center" className="min-w-[180px]">
                  <SelectItem value="none">不选择项目</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">描述</label>
              <Input
                placeholder="你做了什么？"
                value={manualEntry.description}
                onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">日期</label>
              <Input
                type="date"
                value={manualEntry.date}
                onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">开始时间</label>
                <Input
                  type="time"
                  value={manualEntry.startTime}
                  onChange={(e) => setManualEntry({ ...manualEntry, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">结束时间</label>
                <Input
                  type="time"
                  value={manualEntry.endTime}
                  onChange={(e) => setManualEntry({ ...manualEntry, endTime: e.target.value })}
                />
              </div>
            </div>
            {manualEntryError && (
              <p className="text-sm text-destructive">{manualEntryError}</p>
            )}
            <Button onClick={handleManualEntry} className="w-full" disabled={!manualEntry.projectId}>
              添加记录
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
