import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import type { Task } from '@/lib/types'

interface RecommendedTask extends Task {
  recommendationScore: number
  reasons: string[]
}

export function useSmartTaskRecommendation(limit: number = 5): RecommendedTask[] {
  const { tasks, pomodoroSessions, timeEntries } = useAppStore()

  const toDate = (date: Date | string): Date => {
    return date instanceof Date ? date : new Date(date)
  }

  const recommendations = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const activeTasks = tasks.filter(task => 
      task.status !== 'done' && 
      !task.dependsOn?.some(depId => {
        const depTask = tasks.find(t => t.id === depId)
        return depTask && depTask.status !== 'done'
      })
    )

    const scoredTasks: RecommendedTask[] = activeTasks.map(task => {
      let score = 0
      const reasons: string[] = []

      const priorityWeights = {
        urgent: 100,
        high: 75,
        medium: 50,
        low: 25
      }

      score += priorityWeights[task.priority] || 0
      
      if (task.priority === 'urgent') {
        reasons.push('🔴 紧急任务')
      } else if (task.priority === 'high') {
        reasons.push('🟠 高优先级')
      }

      if (task.dueDate) {
        const dueDate = new Date(task.dueDate)
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysUntilDue <= 0) {
          score += 150
          reasons.push('⚠️ 已逾期')
        } else if (daysUntilDue === 1) {
          score += 120
          reasons.push('📅 明天截止')
        } else if (daysUntilDue <= 3) {
          score += 80
          reasons.push(`📅 ${daysUntilDue}天后截止`)
        } else if (daysUntilDue <= 7) {
          score += 40
          reasons.push(`📅 本周截止`)
        }
      }

      if (task.estimatedPomodoros && task.completedPomodoros !== undefined) {
        const remaining = task.estimatedPomodoros - task.completedPomodoros
        if (remaining > 0 && remaining <= 2) {
          score += 60
          reasons.push(`🍅 还剩${remaining}个番茄钟`)
        }
      }

      const recentSessions = pomodoroSessions.filter(s => 
        s.taskId === task.id &&
        new Date(s.completedAt).toDateString() === today.toDateString()
      )
      
      if (recentSessions.length === 0 && task.status === 'todo') {
        score += 30
        reasons.push('🆕 尚未开始')
      } else if (recentSessions.length >= 3) {
        score -= 20
        reasons.push('♻️ 今日已专注多次')
      }

      const taskTimeEntries = timeEntries.filter(e => e.taskId === task.id)
      const totalTrackedTime = taskTimeEntries.reduce((acc, e) => acc + e.duration, 0)
      
      if (totalTrackedTime > 0 && totalTrackedTime < 3600) {
        score += 15
        reasons.push('⏱️ 已有进度')
      }

      if (task.type === 'event' && task.startTime && task.dueDate) {
        const dueDateObj = toDate(task.dueDate)
        const eventStart = new Date(`${dueDateObj.toISOString().split('T')[0]}T${task.startTime}`)
        const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60)
        
        if (hoursUntilEvent > 0 && hoursUntilEvent <= 2) {
          score += 90
          reasons.push('🕐 即将开始的日程')
        }
      }

      if (!task.description || task.description.length < 10) {
        score += 10
        reasons.push('✨ 快速完成任务')
      }

      return {
        ...task,
        recommendationScore: score,
        reasons
      }
    })

    return scoredTasks
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, limit)
  }, [tasks, pomodoroSessions, timeEntries])

  return recommendations
}

export function recommendTasksForFocus(limit: number = 5): RecommendedTask[] {
  const state = useAppStore.getState()
  const { tasks, pomodoroSessions, timeEntries } = state
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const activeTasks = tasks.filter(task =>
    task.status !== 'done' &&
    !task.dependsOn?.some(depId => {
      const depTask = tasks.find(t => t.id === depId)
      return depTask && depTask.status !== 'done'
    })
  )

  const scored: RecommendedTask[] = activeTasks.map(task => {
    let score = 50
    const reasons: string[] = []

    if (task.priority === 'urgent') { score += 40; reasons.push('紧急任务') }
    else if (task.priority === 'high') { score += 25; reasons.push('高优先级') }
    else if (task.priority === 'medium') { score += 10; reasons.push('中等优先级') }

    if (task.dueDate) {
      const dueDate = new Date(task.dueDate)
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hoursUntilDue < 0) { score += 50; reasons.push('已逾期') }
      else if (hoursUntilDue < 24) { score += 35; reasons.push('24小时内到期') }
      else if (hoursUntilDue < 72) { score += 20; reasons.push('3天内到期') }
    }

    if (task.estimatedPomodoros && task.completedPomodoros !== undefined) {
      const remaining = task.estimatedPomodoros - task.completedPomodoros
      if (remaining > 0 && remaining <= 2) {
        score += 30
        reasons.push(`还剩 ${remaining} 个番茄钟`)
      } else if (remaining === 0) {
        score += 10
        reasons.push('已达成番茄钟预估')
      }
    }

    const recentSessions = pomodoroSessions.filter(s =>
      s.taskId === task.id &&
      new Date(s.completedAt).toDateString() === today.toDateString()
    )
    if (recentSessions.length > 0 && recentSessions.length < 3) {
      score += 10
      reasons.push('今日已有专注')
    }

    return {
      ...task,
      recommendationScore: Math.min(100, score),
      reasons,
    }
  })

  return scored.sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, limit)
}

export function calculateSuggestedDuration(task: Task): number {
  const { pomodoroSettings } = useAppStore.getState()
  if (task.estimatedPomodoros && task.completedPomodoros < task.estimatedPomodoros) {
    const remaining = task.estimatedPomodoros - task.completedPomodoros
    if (remaining === 1) {
      return pomodoroSettings.workDuration
    }
  }
  if (task.priority === 'urgent') {
    return pomodoroSettings.workDuration * 2
  }
  return pomodoroSettings.workDuration
}
