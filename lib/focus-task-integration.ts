import { useAppStore } from './store'
import { useDataLink } from './data-link-service'
import { completePomodoroSession } from './pomodoro-completion'
import { recommendTasksForFocus, calculateSuggestedDuration } from './smart-recommendation'
import type { Task } from './types'

export interface FocusTaskRecommendation {
  task: Task
  score: number
  reasons: string[]
  suggestedDuration?: number
}

export interface FocusSessionContext {
  taskId: string | null
  taskTitle?: string
  project?: string
  priority?: Task['priority']
  estimatedPomodoros?: number
  completedPomodoros?: number
}

export class FocusTaskIntegration {
  static getTaskRecommendations(limit: number = 5): FocusTaskRecommendation[] {
    const recommended = recommendTasksForFocus(limit)
    return recommended.map(r => ({
      task: r,
      score: r.recommendationScore,
      reasons: r.reasons,
      suggestedDuration: calculateSuggestedDuration(r),
    }))
  }

  static calculateSuggestedDuration(task: Task): number {
    return calculateSuggestedDuration(task)
  }

  static shouldSuggestTaskCompletion(taskId: string): boolean {
    const { tasks } = useAppStore.getState()
    const task = tasks.find(t => t.id === taskId)

    if (!task || task.status === 'done') return false

    if (task.estimatedPomodoros && task.completedPomodoros >= task.estimatedPomodoros) {
      return true
    }

    return false
  }

  static getFocusContext(taskId: string | null): FocusSessionContext | null {
    if (!taskId) return null

    const { tasks } = useAppStore.getState()
    const task = tasks.find(t => t.id === taskId)

    if (!task) return null

    return {
      taskId: task.id,
      taskTitle: task.title,
      project: task.project,
      priority: task.priority,
      estimatedPomodoros: task.estimatedPomodoros,
      completedPomodoros: task.completedPomodoros
    }
  }

  static handleSessionComplete(
    taskId: string | null,
    duration: number,
    mode: 'work' | 'short-break' | 'long-break'
  ): { sessionId?: string; taskEstimatedReached?: boolean } {
    const result = completePomodoroSession({
      mode,
      duration,
      selectedTaskId: taskId,
    })

    if (result.sessionId) {
      const dataLink = useDataLink()
      dataLink.handlePomodoroCompletion(result.sessionId, duration, mode, taskId || undefined)
    }

    if (result.taskEstimatedReached && taskId) {
      const { tasks, addNotification } = useAppStore.getState()
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        addNotification({
          type: 'achievement',
          title: '任务进度更新',
          message: `「${task.title}」已完成预估番茄钟数（${task.estimatedPomodoros}个）`,
        })
      }
    }

    return {
      sessionId: result.sessionId,
      taskEstimatedReached: result.taskEstimatedReached,
    }
  }

  static getTaskFocusStats(taskId: string) {
    const { pomodoroSessions, timeEntries } = useAppStore.getState()

    const taskSessions = pomodoroSessions.filter(s => s.taskId === taskId && s.type === 'work')
    const totalTime = taskSessions.reduce((acc, s) => acc + s.duration, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todaySessions = taskSessions.filter(s => new Date(s.completedAt) >= today)
    const todayTime = todaySessions.reduce((acc, s) => acc + s.duration, 0)

    return {
      totalSessions: taskSessions.length,
      totalTime,
      todaySessions: todaySessions.length,
      todayTime,
      avgSessionDuration: taskSessions.length > 0 ? totalTime / taskSessions.length : 0
    }
  }
}

export function useFocusTaskIntegration() {
  return {
    getRecommendations: FocusTaskIntegration.getTaskRecommendations,
    calculateSuggestedDuration: FocusTaskIntegration.calculateSuggestedDuration,
    shouldSuggestTaskCompletion: FocusTaskIntegration.shouldSuggestTaskCompletion,
    getFocusContext: FocusTaskIntegration.getFocusContext,
    handleSessionComplete: FocusTaskIntegration.handleSessionComplete,
    getTaskFocusStats: FocusTaskIntegration.getTaskFocusStats
  }
}
