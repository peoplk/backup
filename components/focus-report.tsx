'use client'

import { Fragment, useState, useEffect, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { COLOR_PALETTE } from '@/lib/palette'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BarChart3,
  PieChart as PieChartIcon,
  Timer,
  Tag,
  Clock,
  Brain,
  ChevronDown,
  ChevronUp,
  Download,
  Layers,
  ArrowUpRight,
  Calendar,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { subDays, startOfWeek, startOfMonth, startOfDay, endOfDay, format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const CHART_COLORS = COLOR_PALETTE

export function FocusReport() {
  const { pomodoroSessions, projects, tasks } = useAppStore(useShallow((state) => ({
    pomodoroSessions: state.pomodoroSessions,
    projects: state.projects,
    tasks: state.tasks,
  })))

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [groupBy, setGroupBy] = useState<'project' | 'tag' | 'date'>('project')
  const [expandedProject, setExpandedProject] = useState<string | null>(null)

  // 实时时间戳：与单日分析一致，每 30s 刷新一次，保证报表数据随时间实时更新
  const [now, setNow] = useState<Date>(new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const rangeStart = useMemo(() => {
    // 与下方 dateData 迭代保持一致：N 天 = 今天往前 N-1 天的 0 点
    // 例如 "近 7 天" = 6 天前 0 点 ~ 今天 24 点（共 7 个数据点）
    const endOfToday = endOfDay(now)
    switch (timeRange) {
      case '7d': return startOfDay(subDays(endOfToday, 6))
      case '30d': return startOfDay(subDays(endOfToday, 29))
      case '90d': return startOfDay(subDays(endOfToday, 89))
      case 'all': return new Date(0)
    }
  }, [timeRange, now])

  const filteredSessions = useMemo(() =>
    pomodoroSessions.filter(s =>
      s.type === 'work' && new Date(s.completedAt) >= rangeStart
    ),
  [pomodoroSessions, rangeStart])

  const totalFocusMinutes = useMemo(() =>
    Math.round(filteredSessions.reduce((acc, s) => acc + s.duration, 0) / 60),
  [filteredSessions])

  const totalSessions = filteredSessions.length
  const avgDuration = totalSessions > 0 ? Math.round(totalFocusMinutes / totalSessions) : 0

  const projectData = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; color: string; sessions: number; tasks: Set<string> }>()
    const taskById = new Map(tasks.map((t) => [t.id, t]))
    const projectByName = new Map(projects.map((p) => [p.name, p]))

    filteredSessions.forEach((s) => {
      const task = s.taskId ? taskById.get(s.taskId) : null
      const projectName = task?.project || '未分类'
      const project = projectByName.get(projectName)
      const color = project?.color || '#94a3b8'

      if (!map.has(projectName)) {
        map.set(projectName, { name: projectName, minutes: 0, color, sessions: 0, tasks: new Set() })
      }
      const entry = map.get(projectName)!
      entry.minutes += s.duration / 60
      entry.sessions++
      if (s.taskId) entry.tasks.add(s.taskId)
    })

    return Array.from(map.values())
      .map((e) => ({ ...e, minutes: Math.round(e.minutes), taskCount: e.tasks.size }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [filteredSessions, tasks, projects])

  const tagData = useMemo(() => {
    const map = new Map<string, number>()

    filteredSessions.forEach((s) => {
      if (s.tags) {
        s.tags.forEach((tag) => {
          map.set(tag, (map.get(tag) || 0) + s.duration / 60)
        })
      }
      const task = s.taskId ? tasks.find((t) => t.id === s.taskId) : null
      if (task?.tags) {
        task.tags.forEach((tag) => {
          map.set(tag, (map.get(tag) || 0) + s.duration / 60)
        })
      }
    })

    return Array.from(map.entries())
      .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10)
  }, [filteredSessions, tasks])

  const dateData = useMemo(() => {
    const map = new Map<string, number>()
    const endOfToday = endOfDay(now)

    // 计算实际天数：'all' 模式从 rangeStart 到今天
    let days: number
    if (timeRange === 'all') {
      days = Math.max(1, Math.ceil((endOfToday.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)))
      // 限制最多 365 天，避免图表过密
      days = Math.min(days, 365)
    } else {
      days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    }

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(endOfToday, i)
      map.set(format(date, 'MM/dd'), 0)
    }

    filteredSessions.forEach((s) => {
      const key = format(new Date(s.completedAt), 'MM/dd')
      map.set(key, (map.get(key) || 0) + s.duration / 60)
    })

    return Array.from(map.entries()).map(([date, minutes]) => ({
      date,
      minutes: Math.round(minutes),
    }))
  }, [filteredSessions, timeRange, now, rangeStart])

  const projectPieData = useMemo(() =>
    projectData.slice(0, 8).map((p) => ({
      name: p.name,
      value: p.minutes,
      color: p.color,
    })),
  [projectData])

  const exportCSV = () => {
    const headers = '项目,专注分钟数,会话数,任务数\n'
    const rows = projectData.map((p) =>
      `${p.name},${p.minutes},${p.sessions},${p.taskCount}`
    ).join('\n')
    const csv = headers + rows
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `专注报表_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatMinutes = (minutes: number) => {
    if (minutes >= 60) {
      return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">专注报表</h1>
          <p className="text-muted-foreground mt-0.5">详细的专注时间分析，了解你的时间都花在哪里</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
            <Download className="h-4 w-4" />
            导出 CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-500/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Timer className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">总专注时长</p>
            <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{formatMinutes(totalFocusMinutes)}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Brain className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">完成番茄钟</p>
            <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{totalSessions}<span className="text-sm font-normal text-muted-foreground" style={{ fontFamily: 'var(--font-sans)' }}> 个</span></p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">平均每番茄钟</p>
            <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{avgDuration}<span className="text-sm font-normal text-muted-foreground" style={{ fontFamily: 'var(--font-sans)' }}> 分钟</span></p>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-purple-500/10 p-2">
                <Layers className="h-4 w-4 text-purple-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">涉及项目</p>
            <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-timer), "Space Grotesk", "Inter", sans-serif' }}>{projectData.length}<span className="text-sm font-normal text-muted-foreground" style={{ fontFamily: 'var(--font-sans)' }}> 个</span></p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <SelectTrigger className="w-[120px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">近7天</SelectItem>
            <SelectItem value="30d">近30天</SelectItem>
            <SelectItem value="90d">近90天</SelectItem>
            <SelectItem value="all">全部</SelectItem>
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
          <SelectTrigger className="w-[120px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="project">按项目</SelectItem>
            <SelectItem value="tag">按标签</SelectItem>
            <SelectItem value="date">按日期</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              {groupBy === 'project' ? '项目专注分布' : groupBy === 'tag' ? '标签专注分布' : '每日专注趋势'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupBy === 'project' ? projectData.slice(0, 10) : groupBy === 'tag' ? tagData : dateData}
                  layout={groupBy === 'date' ? 'horizontal' : 'vertical'}
                  margin={{ left: 20, right: 20, ...(groupBy === 'date' ? { bottom: 30 } : {}) }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  {groupBy === 'date' ? (
                    <>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        angle={-30}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value}m`}
                      />
                    </>
                  ) : (
                    <>
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value}m`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        width={groupBy === 'project' ? 80 : 60}
                      />
                    </>
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value} 分钟`, '专注时长']}
                  />
                  <Bar
                    dataKey="minutes"
                    radius={groupBy === 'date' ? [4, 4, 0, 0] : [0, 6, 6, 0]}
                    maxBarSize={groupBy === 'date' ? 16 : 24}
                  >
                    {(groupBy === 'project' ? projectData.slice(0, 10) : groupBy === 'tag' ? tagData : dateData).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={'color' in entry ? (entry as { color: string }).color : CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-purple-500" />
              项目占比
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {projectPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value} 分钟 (${((value / totalFocusMinutes) * 100).toFixed(1)}%)`, '专注时长']}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {groupBy === 'project' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">项目详情</CardTitle>
            <CardDescription>点击展开查看每个项目的详细信息</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>项目</TableHead>
                  <TableHead className="text-right">专注时长</TableHead>
                  <TableHead className="text-right">会话数</TableHead>
                  <TableHead className="text-right">任务数</TableHead>
                  <TableHead className="text-right">占比</TableHead>
                  <TableHead>进度</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectData.map((project) => {
                  const percentage = totalFocusMinutes > 0 ? (project.minutes / totalFocusMinutes) * 100 : 0
                  const isExpanded = expandedProject === project.name
                  return (
                    <Fragment key={project.name}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => setExpandedProject(isExpanded ? null : project.name)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: project.color }}
                            />
                            <span className="font-medium">{project.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatMinutes(project.minutes)}</TableCell>
                        <TableCell className="text-right">{project.sessions}</TableCell>
                        <TableCell className="text-right">{project.taskCount}</TableCell>
                        <TableCell className="text-right">{percentage.toFixed(1)}%</TableCell>
                        <TableCell className="w-[120px]">
                          <Progress value={percentage} className="h-1.5" />
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/20 p-4">
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">
                                关联任务
                              </p>
                              <div className="grid gap-1">
                                {tasks
                                  .filter((t) => t.project === project.name)
                                  .slice(0, 10)
                                  .map((task) => {
                                    const taskSessions = filteredSessions.filter(
                                      (s) => s.taskId === task.id
                                    )
                                    const taskMinutes = Math.round(
                                      taskSessions.reduce((acc, s) => acc + s.duration, 0) / 60
                                    )
                                    return (
                                      <div
                                        key={task.id}
                                        className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm hover:bg-muted/50"
                                      >
                                        <span className="truncate flex-1">{task.title}</span>
                                        <span className="text-xs text-muted-foreground ml-3 shrink-0">
                                          {formatMinutes(taskMinutes)} · {taskSessions.length} 番茄钟
                                        </span>
                                      </div>
                                    )
                                  })}
                                {tasks.filter((t) => t.project === project.name).length === 0 && (
                                  <p className="text-xs text-muted-foreground py-2">暂无关联任务</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {groupBy === 'tag' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Tag className="h-5 w-5 text-amber-500" />
              标签详情
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tagData.map((tag, index) => {
                const percentage = totalFocusMinutes > 0 ? (tag.minutes / totalFocusMinutes) * 100 : 0
                return (
                  <div key={tag.name} className="flex items-center gap-4">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    >
                      {tag.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{tag.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatMinutes(tag.minutes)} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  </div>
                )
              })}
              {tagData.length === 0 && (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Tag className="h-8 w-8 opacity-30 mb-2" />
                  <p className="text-sm">暂无标签数据</p>
                  <p className="text-xs mt-1">在番茄钟中添加标签来追踪你的时间去向</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
