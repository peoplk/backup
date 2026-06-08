import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import type { Task, Goal, Habit, PomodoroSession, TimeEntry } from '@/lib/types'

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
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      listeners.forEach(callback => callback(event))
    }
    const allListeners = this.eventListeners.get('*')
    if (allListeners) {
      allListeners.forEach(callback => callback(event))
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

    if (task.project) {
      this.updateProjectTime(task.project, totalTimeSpent)
    }

    state.checkAchievements()
    state.addPoints(10)

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
      state.addPoints(Math.max(1, Math.round(duration / 60)))
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
        if (task.project) {
          this.updateProjectTime(task.project, entry.duration)
        }
      }
    }
    const projectId = entry.projectId
      ?? (entry.project ? state.projects.find(p => p.name === entry.project)?.id : undefined)
    if (projectId) {
      this.updateProjectTimeById(projectId, entry.duration)
    } else if (entry.project) {
      this.updateProjectTime(entry.project, entry.duration)
    }
    state.addPoints(Math.max(1, Math.round(entry.duration / 60 / 5)))
  }

  handleHabitCheck(habitId: string, date: Date, completed: boolean): HabitCheckContext | null {
    const state = useAppStore.getState()
    const habit = state.habits.find(h => h.id === habitId)
    
    if (!habit) return null

    let streak = 0
    if (completed) {
      const checkDate = new Date(date)
      while (true) {
        const dStr = checkDate.toDateString()
        const checkIn = state.habitCheckIns.find(
          c => c.habitId === habitId && new Date(c.date).toDateString() === dStr
        )
        if (checkIn?.completed || dStr === date.toDateString()) {
          streak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else {
          break
        }
      }
    }

    let linkedGoalId: string | undefined
    if (habit.linkedGoalId && state.goals.some(g => g.id === habit.linkedGoalId)) {
      linkedGoalId = habit.linkedGoalId
    } else {
      const habitNameKey = habit.name.trim().toLowerCase()
      linkedGoalId = state.goals.find(g => {
        if (g.linkedHabits?.includes(habitId)) return true
        if (g.title && habitNameKey && g.title.trim().toLowerCase() === habitNameKey) return true
        return false
      })?.id
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

    if (linkedGoalId && completed) {
      this.updateGoalProgress(linkedGoalId)
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
      })
    }
  }

  private updateGoalProgress(goalId: string): void {
    const state = useAppStore.getState()
    const goal = state.goals.find(g => g.id === goalId)
    
    if (!goal) return

    const completedTasks = goal.linkedTasks.filter(taskId => {
      const task = state.tasks.find(t => t.id === taskId)
      return task && task.status === 'done'
    }).length

    const totalTasks = goal.linkedTasks.length
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : goal.progress

    const completedMilestones = goal.milestones.filter(m => m.completed).length
    const milestoneProgress = goal.milestones.length > 0 
      ? (completedMilestones / goal.milestones.length) * 100 
      : 0

    const finalProgress = (progress + milestoneProgress) / 2

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
      })
      state.addPoints(50)
    }
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
    const totalTime = sessions.reduce((acc, s) => acc + s.duration, 0) + 
                      timeEntries.reduce((acc, e) => acc + e.duration, 0)
    const avgSessionDuration = sessions.length > 0 ? totalTime / sessions.length : 0
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
      suggestTaskForPomodoro: () => dataLinkService.suggestTaskForPomodoro(),
      subscribe: (eventType: string, callback: (event: DataLinkEvent) => void) =>
        dataLinkService.subscribe(eventType, callback),
    }),
    []
  )
}
