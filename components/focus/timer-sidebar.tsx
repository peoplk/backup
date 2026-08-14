'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { PomodoroSession, PomodoroSettings, Task, TreeState } from '@/lib/types'
import { Flame, TreeDeciduous, Target, Clock, CheckCircle2 } from 'lucide-react'
import { getTreeLabel, getTreeColorClass } from '@/lib/forest-tree'

interface TimerSidebarProps {
  todaySessions: number
  focusGoals: { dailyMinutes: number; weeklyMinutes: number; dailyPomodoros: number }
  completedSessions: number
  pomodoroSettings: PomodoroSettings
  treeGrowth: number
  treeState: TreeState
  todayAbandoned: number
  weekStats: {
    weekPomodoros: number
    weekHours: number
    weekTimeHours: number
    weekTasks: number
    startOfWeek: Date
  }
  streak: number
  pomodoroSessions: PomodoroSession[]
  tasks: Task[]
}

export function TimerSidebar({
  todaySessions,
  focusGoals,
  completedSessions,
  pomodoroSettings,
  treeGrowth,
  treeState,
  todayAbandoned,
  weekStats,
  streak,
  pomodoroSessions,
  tasks,
}: TimerSidebarProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-chart-3" />
            今日进度
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{todaySessions}</span>
            <span className="text-muted-foreground">/ {focusGoals.dailyPomodoros || 8} 番茄钟</span>
          </div>
          <Progress value={(todaySessions / (focusGoals.dailyPomodoros || 8)) * 100} className="mt-3 h-2" />
          <div className="mt-4 flex justify-center gap-1">
            {Array.from({ length: pomodoroSettings.sessionsBeforeLongBreak || 4 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-3 w-3 rounded-full transition-all',
                  i < (completedSessions % (pomodoroSettings.sessionsBeforeLongBreak || 4))
                    ? 'bg-chart-1'
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            完成 {pomodoroSettings.sessionsBeforeLongBreak || 4} 个获得长休息
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TreeDeciduous className="h-5 w-5 text-chart-2" />
            专注成就
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mx-auto h-32 w-32">
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 transition-all duration-1000"
              style={{
                height: `${Math.max(treeGrowth, 10)}%`,
                width: `${30 + treeGrowth * 0.5}%`,
              }}
            >
              <TreeDeciduous
                className={cn(
                  'h-full w-full transition-colors duration-500',
                  getTreeColorClass(treeState)
                )}
              />
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm font-medium">
              {treeState === 'withered'
                ? '专注中断，树木枯萎了。点击开始重新种植'
                : treeGrowth >= 100
                ? '你的树已长成!'
                : treeGrowth >= 50
                ? '继续加油!'
                : '开始专注来培育你的树'}
            </p>
            <p className="text-xs text-muted-foreground">
              状态: {getTreeLabel(treeState)} · 成长度: {treeGrowth}%
            </p>
            {todayAbandoned > 0 && (
              <p className="mt-1 text-xs text-destructive">
                今日放弃 {todayAbandoned} 个番茄钟
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">本周统计</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-chart-1" />
              <span className="text-sm">完成番茄钟</span>
            </div>
            <span className="font-medium">{weekStats.weekPomodoros}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-chart-2" />
              <span className="text-sm">专注时长</span>
            </div>
            <span className="font-medium">{weekStats.weekHours.toFixed(1)}h</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-chart-3" />
              <span className="text-sm">完成任务</span>
            </div>
            <span className="font-medium">{weekStats.weekTasks}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-destructive" />
              <span className="text-sm">连续天数</span>
            </div>
            <span className="font-medium">{streak} 天</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-muted-foreground" />
            今日记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {pomodoroSessions
              .filter((s) => new Date(s.completedAt).toDateString() === new Date().toDateString())
              .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
              .map((session) => {
                const sessionTask = session.taskId ? tasks.find((t) => t.id === session.taskId) : null
                const sessionTime = new Date(session.completedAt)
                return (
                  <div key={session.id} className="rounded-lg bg-muted/30 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {sessionTime.getHours().toString().padStart(2, '0')}:{sessionTime.getMinutes().toString().padStart(2, '0')}
                        </span>
                        <span className={cn(
                          'shrink-0 text-xs px-1.5 py-0.5 rounded',
                          session.type === 'work' ? 'bg-chart-1/20 text-chart-1' : 'bg-chart-2/20 text-chart-2'
                        )}>
                          {session.type === 'work' ? '专注' : '休息'}
                        </span>
                      </div>
                      <span className="font-medium">{Math.round(session.duration / 60)} 分钟</span>
                    </div>
                    {session.note && (
                      <p className="mt-1 text-muted-foreground line-clamp-2">{session.note}</p>
                    )}
                    {sessionTask && (
                      <p className="mt-0.5 text-primary/70">📌 {sessionTask.title}</p>
                    )}
                  </div>
                )
              })}
            {pomodoroSessions.filter((s) => new Date(s.completedAt).toDateString() === new Date().toDateString()).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">暂无记录</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
