import { useAppStore } from './store'
import type { Task, Habit, Goal } from './types'
import { FocusTaskIntegration } from './focus-task-integration'
import { HabitGoalIntegration } from './habit-goal-integration'

export interface SmartSuggestion {
  type: 'task' | 'habit' | 'goal' | 'focus' | 'break'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  action: () => void
  metadata?: Record<string, any>
}

export interface QuickAction {
  id: string
  label: string
  icon: string
  shortcut?: string
  action: () => void
  context: 'global' | 'tasks' | 'focus' | 'habits' | 'goals'
}

export class SmartAssistant {
  static getSmartSuggestions(): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = []
    const { tasks, habits, goals, pomodoroSessions, setActiveView } = useAppStore.getState()
    
    const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done')
    if (urgentTasks.length > 0) {
      suggestions.push({
        type: 'task',
        priority: 'high',
        title: `处理 ${urgentTasks.length} 个紧急任务`,
        description: '你有紧急任务需要处理',
        action: () => setActiveView('tasks'),
        metadata: { taskIds: urgentTasks.map(t => t.id) }
      })
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toDateString()
    
    const overdueTasks = tasks.filter(
      t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'done'
    )
    
    if (overdueTasks.length > 0) {
      suggestions.push({
        type: 'task',
        priority: 'high',
        title: `${overdueTasks.length} 个任务已过期`,
        description: '处理过期任务以保持进度',
        action: () => setActiveView('tasks'),
        metadata: { taskIds: overdueTasks.map(t => t.id) }
      })
    }
    
    const activeHabits = habits.filter(h => !h.archived)
    const uncheckedHabits = activeHabits.filter(h => {
      const todayCheckIn = useAppStore.getState().habitCheckIns.find(
        c => c.habitId === h.id && new Date(c.date).toDateString() === todayStr
      )
      return !todayCheckIn?.completed
    })
    
    if (uncheckedHabits.length > 0 && new Date().getHours() >= 18) {
      suggestions.push({
        type: 'habit',
        priority: 'medium',
        title: '完成今日习惯打卡',
        description: `还有 ${uncheckedHabits.length} 个习惯未完成`,
        action: () => setActiveView('habits'),
        metadata: { habitIds: uncheckedHabits.map(h => h.id) }
      })
    }
    
    const todayPomodoros = pomodoroSessions.filter(
      s => new Date(s.completedAt).toDateString() === todayStr && s.type === 'work'
    )
    
    if (todayPomodoros.length === 0 && new Date().getHours() >= 10) {
      const taskRecommendations = FocusTaskIntegration.getTaskRecommendations(1)
      if (taskRecommendations.length > 0) {
        suggestions.push({
          type: 'focus',
          priority: 'medium',
          title: '开始今日专注',
          description: `建议从「${taskRecommendations[0].task.title}」开始`,
          action: () => setActiveView('focus'),
          metadata: { taskId: taskRecommendations[0].task.id }
        })
      }
    }
    
    const recentPomodoros = pomodoroSessions.filter(
      s => s.type === 'work' && 
           new Date(s.completedAt).toDateString() === todayStr &&
           new Date(s.completedAt).getTime() > Date.now() - 90 * 60 * 1000
    )
    
    if (recentPomodoros.length >= 3) {
      suggestions.push({
        type: 'break',
        priority: 'medium',
        title: '休息一下',
        description: '你已经专注了很长时间，建议休息',
        action: () => setActiveView('focus'),
        metadata: { suggestBreak: true }
      })
    }
    
    const goalsNearCompletion = goals.filter(
      g => g.progress >= 75 && g.progress < 100
    )
    
    if (goalsNearCompletion.length > 0) {
      suggestions.push({
        type: 'goal',
        priority: 'medium',
        title: '目标即将达成',
        description: `${goalsNearCompletion.length} 个目标接近完成`,
        action: () => setActiveView('goals'),
        metadata: { goalIds: goalsNearCompletion.map(g => g.id) }
      })
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }
  
  static getQuickActions(context: 'global' | 'tasks' | 'focus' | 'habits' | 'goals' = 'global'): QuickAction[] {
    const { setActiveView, addTask, toggleSidebar } = useAppStore.getState()

    const globalActions: QuickAction[] = [
      {
        id: 'quick-add-task',
        label: '快速添加任务',
        icon: '➕',
        shortcut: '⌘N',
        action: () => {
          setActiveView('tasks')
          // 延迟触发，等待视图切换完成
          setTimeout(() => {
            const event = new CustomEvent('focus-quick-add')
            window.dispatchEvent(event)
          }, 100)
        },
        context: 'global'
      },
      {
        id: 'start-focus',
        label: '开始专注',
        icon: '🍅',
        shortcut: '⌘F',
        action: () => {
          setActiveView('focus')
          // 自动开始番茄钟
          setTimeout(() => {
            const state = useAppStore.getState()
            if (!state.pomodoroTimerState.isRunning) {
              state.updatePomodoroTimerState({ isRunning: true })
            }
          }, 100)
        },
        context: 'global'
      },
      {
        id: 'check-habits',
        label: '习惯打卡',
        icon: '✅',
        shortcut: '⌘H',
        action: () => setActiveView('habits'),
        context: 'global'
      },
      {
        id: 'view-dashboard',
        label: '查看仪表板',
        icon: '📊',
        shortcut: '⌘D',
        action: () => setActiveView('dashboard'),
        context: 'global'
      }
    ]

    const taskActions: QuickAction[] = [
      {
        id: 'add-urgent-task',
        label: '添加紧急任务',
        icon: '🚨',
        action: () => {
          setActiveView('tasks')
          setTimeout(() => {
            const event = new CustomEvent('focus-quick-add', { detail: { priority: 'urgent' } })
            window.dispatchEvent(event)
          }, 100)
        },
        context: 'tasks'
      },
      {
        id: 'view-completed',
        label: '查看已完成',
        icon: '✅',
        action: () => {
          setActiveView('tasks')
          setTimeout(() => {
            const event = new CustomEvent('filter-tasks', { detail: { status: 'done' } })
            window.dispatchEvent(event)
          }, 100)
        },
        context: 'tasks'
      }
    ]

    const focusActions: QuickAction[] = [
      {
        id: 'quick-pomodoro',
        label: '快速番茄钟',
        icon: '🍅',
        action: () => {
          setActiveView('focus')
          setTimeout(() => {
            const state = useAppStore.getState()
            if (!state.pomodoroTimerState.isRunning) {
              state.updatePomodoroTimerState({ isRunning: true })
            }
          }, 100)
        },
        context: 'focus'
      },
      {
        id: 'start-focus-shield',
        label: '开启专注屏蔽',
        icon: '🛡️',
        action: () => {
          setActiveView('focus')
          setTimeout(() => {
            const event = new CustomEvent('activate-focus-shield')
            window.dispatchEvent(event)
          }, 100)
        },
        context: 'focus'
      }
    ]

    const habitActions: QuickAction[] = [
      {
        id: 'check-all-habits',
        label: '批量打卡',
        icon: '✅',
        action: () => setActiveView('habits'),
        context: 'habits'
      }
    ]

    const goalActions: QuickAction[] = [
      {
        id: 'add-goal',
        label: '创建新目标',
        icon: '🎯',
        action: () => setActiveView('goals'),
        context: 'goals'
      }
    ]
    
    switch (context) {
      case 'tasks':
        return [...globalActions, ...taskActions]
      case 'focus':
        return [...globalActions, ...focusActions]
      case 'habits':
        return [...globalActions, ...habitActions]
      case 'goals':
        return [...globalActions, ...goalActions]
      default:
        return globalActions
    }
  }
  
  static getProductivityInsight(): {
    score: number
    level: 'excellent' | 'good' | 'average' | 'needsImprovement'
    message: string
    tips: string[]
  } {
    const { tasks, pomodoroSessions, habitCheckIns } = useAppStore.getState()
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toDateString()
    
    const todayPomodoros = pomodoroSessions.filter(
      s => new Date(s.completedAt).toDateString() === todayStr && s.type === 'work'
    )
    const todayFocusMinutes = todayPomodoros.reduce((acc, s) => acc + s.duration, 0) / 60
    
    const completedTasks = tasks.filter(
      t => t.completedAt && new Date(t.completedAt).toDateString() === todayStr
    ).length
    
    const activeHabits = useAppStore.getState().habits.filter(h => !h.archived)
    const todayHabitCheckIns = habitCheckIns.filter(
      c => new Date(c.date).toDateString() === todayStr && c.completed
    )
    const habitCompletionRate = activeHabits.length > 0 
      ? todayHabitCheckIns.length / activeHabits.length 
      : 0
    
    let score = 0
    score += Math.min(todayFocusMinutes / 120 * 40, 40)
    score += Math.min(completedTasks / 5 * 30, 30)
    score += habitCompletionRate * 30
    
    const level = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'average' : 'needsImprovement'
    
    const messages = {
      excellent: '今天表现出色！继续保持！',
      good: '今天进展不错，继续加油！',
      average: '今天表现一般，还有提升空间',
      needsImprovement: '今天需要更加努力哦'
    }
    
    const tips: string[] = []
    
    if (todayFocusMinutes < 60) {
      tips.push('建议增加专注时间，目标至少1小时')
    }
    
    if (completedTasks < 3) {
      tips.push('尝试完成更多任务，建议每天至少3个')
    }
    
    if (habitCompletionRate < 0.8) {
      tips.push('记得完成今日习惯打卡')
    }
    
    if (todayPomodoros.length > 4) {
      tips.push('专注时间较长，记得适当休息')
    }
    
    return {
      score: Math.round(score),
      level,
      message: messages[level],
      tips
    }
  }
  
  static getNextAction(): SmartSuggestion | null {
    const suggestions = this.getSmartSuggestions()
    return suggestions.length > 0 ? suggestions[0] : null
  }
}

export function useSmartAssistant() {
  return {
    getSmartSuggestions: SmartAssistant.getSmartSuggestions,
    getQuickActions: SmartAssistant.getQuickActions,
    getProductivityInsight: SmartAssistant.getProductivityInsight,
    getNextAction: SmartAssistant.getNextAction
  }
}
