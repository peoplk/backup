import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import type { Task, Goal, Habit, PomodoroSession, TimeEntry } from '@/lib/types'
import { calculateHabitStreak, getScheduledCompletionRate } from '@/lib/habit-streak'
import { XP_RULES, pomodoroXp } from '@/lib/xp-rules'

export interface DataLinkEvent {
  type: 'task_completed' | 'pomodoro_completed' | 'habit_checked' | 'goal_progress' | 'time_entry_added'
  payload: unknown
  timestamp: Date
}

export interface TaskCompletionContext {
  taskId: string
  task: Task
  completedPomodoros: number
  totalTimeSpent: number
  linkedGoals: string[]
  project?: string
}

export interface PomodoroCompletionContext {
  sessionId: string
  taskId?: string
  duration: number
  mode: 'work' | 'short-break' | 'long-break'
  completedSessions: number
}

export interface HabitCheckContext {
  habitId: string
  date: Date
  completed: boolean
  streak: number
  linkedGoalId?: string
}

class DataLinkService {
  private static instance: DataLinkService
  private eventListeners: Map<string, Array<(event: DataLinkEvent) => void>> = new Map()
  // 防重复计分：taskId -> 已发过积分的完成时间戳（ISO）
  private awardedCompletionKeys = new Map<string, string>()
  // 项目时长增量记账：taskId -> 已计入项目的总时长，只补记增量
  private creditedTaskTime = new Map<string, number>()

  static getInstance(): DataLinkService {
    if (!DataLinkService.instance) {
      DataLinkService.instance = new DataLinkService()
    }
    return DataLinkService.instance
  }

  subscribe(eventType: string, callback: (event: DataLinkEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, [])
    }
    this.eventListeners.get(eventType)!.push(callback)
    
    return () => {
      const listeners = this.eventListeners.get(eventType)
      if (listeners) {
        const index = listeners.indexOf(callback)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }

  private emit(event: DataLinkEvent): void {
    // 单个订阅者抛错不应中断其余监听者与调用方流程
    for (const callback of this.eventListeners.get(event.type) ?? []) {
      try {
        callback(event)
      } catch (err) {
        console.error(`[data-link] listener for "${event.type}" failed:`, err)
      }
    }
    for (const callback of this.eventListeners.get('*') ?? []) {
      try {
        callback(event)
      } catch (err) {
        console.error(`[data-link] wildcard listener failed:`, err)
      }
    }
  }

  handleTaskCompletion(taskId: string): TaskCompletionContext | null {
    const state = useAppStore.getState()
    const task = state.tasks.find(t => t.id === taskId)
    
    if (!task) return null

    const pomodoroSessions = state.pomodoroSessions.filter(s => s.taskId === taskId && s.type === 'work')
    const completedPomodoros = pomodoroSessions.length
    const totalTimeSpent = pomodoroSessions.reduce((acc, s) => acc + s.duration, 0)

    const linkedGoals = state.goals
      .filter(g => g.linkedTasks.includes(taskId))
      .map(g => g.id)

    const context: TaskCompletionContext = {
      taskId,
      task,
      completedPomodoros,
      totalTimeSpent,
      linkedGoals,
      project: task.project,
    }

    this.emit({
      type: 'task_completed',
      payload: context,
      timestamp: new Date(),
    })

    linkedGoals.forEach(goalId => {
      this.updateGoalProgress(goalId)
    })

    // 项目时长按增量入账：只补记上次记账后的新增时长，
    // 避免反复切换完成态时把全部历史 session 时长重复累加
    if (task.project) {
      const credited = this.creditedTaskTime.get(taskId) ?? 0
      const delta = Math.max(0, totalTimeSpent - credited)
      if (delta > 0) {
        this.updateProjectTime(task.project, delta)
        this.creditedTaskTime.set(taskId, credited + delta)
      }
    }

    // 积分只在新完成事件时发放一次（同一 completedAt 不重复计 10 分）
    const completionKey = task.completedAt ? new Date(task.completedAt).toISOString() : ''
    if (completionKey && this.awardedCompletionKeys.get(taskId) !== completionKey) {
      this.awardedCompletionKeys.set(taskId, completionKey)
      state.addPoints(XP_RULES.completeTask)
    }

    state.checkAchievements?.()

    return context
  }

  handlePomodoroCompletion(sessionId: string, duration: number, mode: 'work' | 'short-break' | 'long-break', taskId?: string): PomodoroCompletionContext | null {
    const state = useAppStore.getState()
    const completedSessions = state.pomodoroSessions.filter(s => s.type === 'work').length + 1

    const context: PomodoroCompletionContext = {
      sessionId,
      taskId,
      duration,
      mode,
      completedSessions,
    }

    if (mode === 'work') {
      state.addPoints(pomodoroXp(duration))
    }

    this.emit({
      type: 'pomodoro_completed',
      payload: context,
      timestamp: new Date(),
    })

    if (taskId && mode === 'work') {
      this.checkTaskPomodoroProgress(taskId)
    }

    state.checkAchievements()

    return context
  }

  handleTimeEntryAdded(entry: TimeEntry): void {
    const state = useAppStore.getState()
    if (entry.taskId) {
      const task = state.tasks.find(t => t.id === entry.taskId)
      if (task) {
        this.emit({
          type: 'time_entry_added',
          payload: { entry, taskId: entry.taskId, duration: entry.duration },
          timestamp: new Date(),
        })
      }
    }
    // 项目时长只按一个来源累加，避免同一 entry 双计
    const projectId = entry.projectId
      ?? (entry.project ? state.projects.find(p => p.name === entry.project)?.id : undefined)
    if (projectId) {
      this.updateProjectTimeById(projectId, entry.duration)
    } else if (entry.project) {
      this.updateProjectTime(entry.project, entry.duration)
    }
    // 零时长条目不计分，避免空记录刷分
    if (entry.duration > 0) {
      state.addPoints(Math.max(1, Math.round(entry.duration / 60 / 5)))
    }
  }

  handleHabitCheck(habitId: string, date: Date, completed: boolean): HabitCheckContext | null {
    const state = useAppStore.getState()
    const habit = state.habits.find(h => h.id === habitId)

    if (!habit) return null

    // 统一连胜引擎（应做日感知 + 最佳纪录维护）
    let streak = 0
    let bestStreakUpdate: { bestStreak: number } | null = null
    if (completed) {
      const result = calculateHabitStreak(
        habit,
        state.habitCheckIns.filter(c => c.habitId === habitId),
        date
      )
      streak = result.current
      if (result.best > (habit.bestStreak || 0)) {
        bestStreakUpdate = { bestStreak: result.best }
      }
    }

    let linkedGoalId: string | undefined
    if (habit.linkedGoalId && state.goals.some(g => g.id === habit.linkedGoalId)) {
      linkedGoalId = habit.linkedGoalId
    } else {
      linkedGoalId = state.goals.find(g => g.linkedHabits?.includes(habitId))?.id
    }

    const context: HabitCheckContext = {
      habitId,
      date,
      completed,
      streak,
      linkedGoalId,
    }

    this.emit({
      type: 'habit_checked',
      payload: context,
      timestamp: new Date(),
    })

    if (completed) {
      if (bestStreakUpdate) {
        state.updateHabit(habitId, bestStreakUpdate)
      }
      // 打卡积分：每次有效打卡 +5
      state.addPoints(XP_RULES.habitCheckIn)
      if (linkedGoalId) {
        this.updateGoalProgress(linkedGoalId)
      }
      state.checkAchievements?.()
    }

    return context
  }

  private checkTaskPomodoroProgress(taskId: string): void {
    const state = useAppStore.getState()
    const task = state.tasks.find(t => t.id === taskId)
    
    if (!task || !task.estimatedPomodoros) return

    if (task.completedPomodoros >= task.estimatedPomodoros && task.status !== 'done') {
      state.addNotification({
        type: 'achievement',
        title: '任务进度达成',
        message: `「${task.title}」已完成预估番茄钟数`,
        relatedType: 'task',
        relatedId: task.id,
      })
    }
  }

  /** 重算某个目标的进度（任务完成率 + 里程碑完成率）。 */
  updateGoalProgressAfterLink(goalId: string): void {
    this.updateGoalProgress(goalId)
  }

  /**
   * 重算某个目标的进度（单一公式，避免多来源互相覆盖）：
   * 进度 = 可用分量的平均（任务完成率 / 里程碑完成率 / 习惯调度完成率）
   * 习惯分量按 goal.linkedHabits 注册表计算（30 天应做日完成率）。
   */
  private updateGoalProgress(goalId: string): void {
    const state = useAppStore.getState()
    const goal = state.goals.find(g => g.id === goalId)

    if (!goal) return

    const components: number[] = []

    if (goal.linkedTasks.length > 0) {
      const completedTasks = goal.linkedTasks.filter(taskId => {
        const task = state.tasks.find(t => t.id === taskId)
        return task && task.status === 'done'
      }).length
      components.push((completedTasks / goal.linkedTasks.length) * 100)
    }

    if (goal.milestones.length > 0) {
      const completedMilestones = goal.milestones.filter(m => m.completed).length
      components.push((completedMilestones / goal.milestones.length) * 100)
    }

    // 习惯注册表：goal.linkedHabits + habit.linkedGoalId 反向引用
    const linkedHabitIds = new Set([
      ...(goal.linkedHabits ?? []),
      ...state.habits.filter(h => h.linkedGoalId === goalId).map(h => h.id),
    ])
    if (linkedHabitIds.size > 0) {
      let rateSum = 0
      let counted = 0
      for (const habitId of linkedHabitIds) {
        const habit = state.habits.find(h => h.id === habitId)
        if (!habit || habit.archived) continue
        rateSum += getScheduledCompletionRate(
          habit,
          state.habitCheckIns.filter(c => c.habitId === habitId),
          30
        )
        counted++
      }
      if (counted > 0) components.push(rateSum / counted)
    }

    // 没有任何关联内容时不覆盖用户手动设置的进度
    if (components.length === 0) return

    const finalProgress = Math.min(
      Math.round(components.reduce((a, b) => a + b, 0) / components.length),
      100
    )

    state.updateGoal(goalId, { progress: finalProgress })

    if (finalProgress >= 100 && goal.status !== 'completed') {
      state.updateGoal(goalId, {
        status: 'completed',
        completedAt: new Date()
      })
      state.addNotification({
        type: 'achievement',
        title: '目标达成',
        message: `恭喜完成目标「${goal.title}」！`,
        relatedType: 'goal',
        relatedId: goal.id,
      })
      state.addPoints(XP_RULES.completeGoal)
    }
    state.checkAchievements?.()
  }

  private updateProjectTime(projectName: string, additionalTime: number): void {
    const state = useAppStore.getState()
    const project = state.projects.find(p => p.name === projectName)

    if (project) {
      state.updateProject(project.id, {
        totalTime: project.totalTime + additionalTime
      })
    }
  }

  private updateProjectTimeById(projectId: string, additionalTime: number): void {
    const state = useAppStore.getState()
    const project = state.projects.find(p => p.id === projectId)

    if (project) {
      state.updateProject(project.id, {
        totalTime: project.totalTime + additionalTime
      })
    }
  }

  getTaskStats(taskId: string): {
    totalPomodoros: number
    totalTime: number
    avgSessionDuration: number
    lastSessionDate: Date | null
  } {
    const state = useAppStore.getState()
    const sessions = state.pomodoroSessions.filter(s => s.taskId === taskId && s.type === 'work')
    const timeEntries = state.timeEntries.filter(e => e.taskId === taskId)

    const totalPomodoros = sessions.length
    const sessionTime = sessions.reduce((acc, s) => acc + s.duration, 0)
    const manualEntryTime = timeEntries.reduce((acc, e) => acc + e.duration, 0)
    // 番茄钟会同时写入 session 和 timeEntry（pomodoro-completion.ts），
    // 取两者较大值避免同一段专注被双计；手动计时只写 timeEntry。
    const totalTime = Math.max(sessionTime, manualEntryTime)
    const avgSessionDuration = sessions.length > 0 ? sessionTime / sessions.length : 0
    const lastSession = sessions.sort((a, b) => 
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    )[0]

    return {
      totalPomodoros,
      totalTime,
      avgSessionDuration,
      lastSessionDate: lastSession ? new Date(lastSession.completedAt) : null,
    }
  }

  getDailyStats(date: Date): {
    pomodoros: number
    focusTime: number
    tasksCompleted: number
    habitsCompleted: number
  } {
    const state = useAppStore.getState()
    const dateStr = date.toDateString()

    const daySessions = state.pomodoroSessions.filter(s => 
      new Date(s.completedAt).toDateString() === dateStr && s.type === 'work'
    )
    const dayTasks = state.tasks.filter(t => 
      t.completedAt && new Date(t.completedAt).toDateString() === dateStr
    )
    const dayHabits = state.habitCheckIns.filter(c => 
      new Date(c.date).toDateString() === dateStr && c.completed
    )

    return {
      pomodoros: daySessions.length,
      focusTime: daySessions.reduce((acc, s) => acc + s.duration, 0),
      tasksCompleted: dayTasks.length,
      habitsCompleted: dayHabits.length,
    }
  }

  getWeeklyStats(): {
    totalPomodoros: number
    totalFocusTime: number
    totalTasks: number
    totalHabits: number
    dailyBreakdown: Array<{ date: string; pomodoros: number; focusTime: number }>
  } {
    const state = useAppStore.getState()
    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(today.getDate() - 7)

    const weekSessions = state.pomodoroSessions.filter(s => {
      const sessionDate = new Date(s.completedAt)
      return sessionDate >= weekAgo && s.type === 'work'
    })

    const weekTasks = state.tasks.filter(t => {
      if (!t.completedAt) return false
      const completedDate = new Date(t.completedAt)
      return completedDate >= weekAgo
    })

    const dailyBreakdown: Array<{ date: string; pomodoros: number; focusTime: number }> = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const dateStr = date.toDateString()
      
      const daySessions = weekSessions.filter(s => 
        new Date(s.completedAt).toDateString() === dateStr
      )
      
      dailyBreakdown.push({
        date: dateStr,
        pomodoros: daySessions.length,
        focusTime: daySessions.reduce((acc, s) => acc + s.duration, 0),
      })
    }

    return {
      totalPomodoros: weekSessions.length,
      totalFocusTime: weekSessions.reduce((acc, s) => acc + s.duration, 0),
      totalTasks: weekTasks.length,
      totalHabits: 0,
      dailyBreakdown,
    }
  }

  linkTaskToGoal(taskId: string, goalId: string): void {
    const state = useAppStore.getState()
    const goal = state.goals.find(g => g.id === goalId)
    
    if (goal && !goal.linkedTasks.includes(taskId)) {
      state.updateGoal(goalId, {
        linkedTasks: [...goal.linkedTasks, taskId]
      })
    }
  }

  unlinkTaskFromGoal(taskId: string, goalId: string): void {
    const state = useAppStore.getState()
    const goal = state.goals.find(g => g.id === goalId)
    
    if (goal) {
      state.updateGoal(goalId, {
        linkedTasks: goal.linkedTasks.filter(id => id !== taskId)
      })
    }
  }

  linkHabitToGoal(habitId: string, goalId: string): void {
    const state = useAppStore.getState()
    const goal = state.goals.find(g => g.id === goalId)
    const habit = state.habits.find(h => h.id === habitId)

    if (goal && habit && !(goal.linkedHabits ?? []).includes(habitId)) {
      state.updateGoal(goalId, {
        linkedHabits: [...(goal.linkedHabits ?? []), habitId]
      })
      state.updateHabit(habitId, { linkedGoalId: goalId })
    }
  }

  unlinkHabitFromGoal(habitId: string, goalId: string): void {
    const state = useAppStore.getState()
    const goal = state.goals.find(g => g.id === goalId)
    const habit = state.habits.find(h => h.id === habitId)

    if (goal) {
      state.updateGoal(goalId, {
        linkedHabits: (goal.linkedHabits ?? []).filter(id => id !== habitId)
      })
    }
    if (habit?.linkedGoalId === goalId) {
      state.updateHabit(habitId, { linkedGoalId: undefined })
    }
  }

  suggestTaskForPomodoro(): Task | null {
    const state = useAppStore.getState()
    const activeTasks = state.tasks.filter(t => t.status !== 'done' && !t.archived)

    if (activeTasks.length === 0) return null

    const scoredTasks = activeTasks.map(task => {
      let score = 50

      if (task.priority === 'urgent') score += 30
      else if (task.priority === 'high') score += 20
      else if (task.priority === 'medium') score += 10

      if (task.dueDate) {
        const hoursUntilDue = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60)
        if (hoursUntilDue < 0) score += 40
        else if (hoursUntilDue < 24) score += 30
        else if (hoursUntilDue < 72) score += 15
      }

      if (task.estimatedPomodoros && task.completedPomodoros < task.estimatedPomodoros) {
        const progress = task.completedPomodoros / task.estimatedPomodoros
        if (progress > 0.5) score += 15
      }

      return { task, score }
    })

    scoredTasks.sort((a, b) => b.score - a.score)
    return scoredTasks[0]?.task || null
  }
}

export const dataLinkService = DataLinkService.getInstance()

export function useDataLink() {
  return useMemo(
    () => ({
      handleTaskCompletion: (taskId: string) => dataLinkService.handleTaskCompletion(taskId),
      handlePomodoroCompletion: (sessionId: string, duration: number, mode: 'work' | 'short-break' | 'long-break', taskId?: string) =>
        dataLinkService.handlePomodoroCompletion(sessionId, duration, mode, taskId),
      handleHabitCheck: (habitId: string, date: Date, completed: boolean) =>
        dataLinkService.handleHabitCheck(habitId, date, completed),
      handleTimeEntryAdded: (entry: TimeEntry) => dataLinkService.handleTimeEntryAdded(entry),
      getTaskStats: (taskId: string) => dataLinkService.getTaskStats(taskId),
      getDailyStats: (date: Date) => dataLinkService.getDailyStats(date),
      getWeeklyStats: () => dataLinkService.getWeeklyStats(),
      linkTaskToGoal: (taskId: string, goalId: string) => dataLinkService.linkTaskToGoal(taskId, goalId),
      unlinkTaskFromGoal: (taskId: string, goalId: string) => dataLinkService.unlinkTaskFromGoal(taskId, goalId),
      linkHabitToGoal: (habitId: string, goalId: string) => dataLinkService.linkHabitToGoal(habitId, goalId),
      unlinkHabitFromGoal: (habitId: string, goalId: string) => dataLinkService.unlinkHabitFromGoal(habitId, goalId),
      updateGoalProgressAfterLink: (goalId: string) => dataLinkService.updateGoalProgressAfterLink(goalId),
      suggestTaskForPomodoro: () => dataLinkService.suggestTaskForPomodoro(),
      subscribe: (eventType: string, callback: (event: DataLinkEvent) => void) =>
        dataLinkService.subscribe(eventType, callback),
    }),
    []
  )
}
