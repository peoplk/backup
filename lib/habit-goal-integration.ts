import { useAppStore } from '@/lib/store'
import type { Habit, Goal, HabitCheckIn } from '@/lib/types'
import { calculateHabitStreak } from '@/lib/habit-streak'

export interface HabitGoalLink {
  habitId: string
  goalId: string
  contributionWeight: number
  milestoneId?: string
}

export interface HabitContribution {
  habitId: string
  habitName: string
  contribution: number
  streak: number
  lastCheckIn?: Date
}

/**
 * 习惯-目标关联的唯一数据源是 goal.linkedHabits + habit.linkedGoalId
 * （写入统一走 data-link-service）。本类仅提供兼容的查询/贡献度视图，
 * 旧的 localStorage 私有注册表（focusflow-habit-goal-links）已移除。
 */
export class HabitGoalIntegration {

  static linkHabitToGoal(
    habitId: string,
    goalId: string,
    _contributionWeight: number = 1,
    _milestoneId?: string
  ): void {
    import('@/lib/data-link-service').then(({ dataLinkService }) => {
      dataLinkService.linkHabitToGoal(habitId, goalId)
    })
  }

  static unlinkHabitFromGoal(habitId: string, goalId: string): void {
    import('@/lib/data-link-service').then(({ dataLinkService }) => {
      dataLinkService.unlinkHabitFromGoal(habitId, goalId)
    })
  }

  static getHabitsForGoal(goalId: string): HabitGoalLink[] {
    const { goals } = useAppStore.getState()
    const goal = goals.find(g => g.id === goalId)
    return (goal?.linkedHabits ?? []).map(habitId => ({
      habitId,
      goalId,
      contributionWeight: 1,
    }))
  }

  static getGoalsForHabit(habitId: string): HabitGoalLink[] {
    const { goals, habits } = useAppStore.getState()
    const habit = habits.find(h => h.id === habitId)
    const goalIds = new Set<string>()
    if (habit?.linkedGoalId) goalIds.add(habit.linkedGoalId)
    for (const g of goals) {
      if (g.linkedHabits?.includes(habitId)) goalIds.add(g.id)
    }
    return [...goalIds].map(goalId => ({
      habitId,
      goalId,
      contributionWeight: 1,
    }))
  }
  
  static calculateHabitContribution(habitId: string, days: number = 30): number {
    const { habitCheckIns } = useAppStore.getState()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const recentCheckIns = habitCheckIns.filter(
      c => c.habitId === habitId && 
           c.completed && 
           new Date(c.date) >= startDate
    )
    
    return recentCheckIns.length / days
  }
  
  /**
   * @deprecated 目标进度已统一由 data-link-service 单一公式重算
   * （goal.linkedHabits 为唯一注册表）。此方法仅作兼容保留并转发。
   */
  static updateGoalProgressFromHabit(habitId: string): void {
    const { habits, goals } = useAppStore.getState()
    const habit = habits.find(h => h.id === habitId)
    const goalIds = new Set<string>()
    if (habit?.linkedGoalId) goalIds.add(habit.linkedGoalId)
    for (const g of goals) {
      if (g.linkedHabits?.includes(habitId)) goalIds.add(g.id)
    }
    if (goalIds.size === 0) return
    import('@/lib/data-link-service').then(({ dataLinkService }) => {
      for (const goalId of goalIds) {
        dataLinkService.updateGoalProgressAfterLink(goalId)
      }
    })
  }
  
  static getHabitGoalContributions(goalId: string): HabitContribution[] {
    const { habits } = useAppStore.getState()
    const links = this.getHabitsForGoal(goalId)
    
    const contributions: HabitContribution[] = []
    
    links.forEach(link => {
      const habit = habits.find(h => h.id === link.habitId)
      if (!habit) return
      
      const contribution = this.calculateHabitContribution(link.habitId)
      const streak = this.getHabitStreak(link.habitId)
      const lastCheckIn = this.getLastCheckIn(link.habitId)
      
      contributions.push({
        habitId: link.habitId,
        habitName: habit.name,
        contribution: contribution * link.contributionWeight,
        streak,
        lastCheckIn
      })
    })
    
    return contributions
  }
  
  /** @deprecated 请直接使用 lib/habit-streak.ts 的统一连胜引擎 */
  static getHabitStreak(habitId: string): number {
    const { habits, habitCheckIns } = useAppStore.getState()
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return 0
    return calculateHabitStreak(
      habit,
      habitCheckIns.filter(c => c.habitId === habitId)
    ).current
  }
  
  static getLastCheckIn(habitId: string): Date | undefined {
    const { habitCheckIns } = useAppStore.getState()
    const checkIns = habitCheckIns
      .filter(c => c.habitId === habitId && c.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    return checkIns[0] ? new Date(checkIns[0].date) : undefined
  }
  
  static suggestHabitsForGoal(goalId: string): Habit[] {
    const { habits, goals } = useAppStore.getState()
    const goal = goals.find(g => g.id === goalId)
    
    if (!goal) return []
    
    const existingHabitIds = this.getHabitsForGoal(goalId).map(l => l.habitId)
    const availableHabits = habits.filter(h => 
      !h.archived && !existingHabitIds.includes(h.id)
    )
    
    const goalKeywords = goal.title.toLowerCase().split(' ')
    const goalDescription = goal.description?.toLowerCase() || ''
    
    return availableHabits.filter(habit => {
      const habitName = habit.name.toLowerCase()
      
      return goalKeywords.some(keyword => 
        habitName.includes(keyword)
      ) || goalDescription.includes(habitName)
    }).slice(0, 5)
  }
  
  static getOverallHabitHealth(): {
    totalHabits: number
    activeHabits: number
    avgStreak: number
    avgCompletionRate: number
    topPerformers: Array<{ habitId: string; streak: number }>
  } {
    const { habits, habitCheckIns } = useAppStore.getState()
    const activeHabits = habits.filter(h => !h.archived)
    
    if (activeHabits.length === 0) {
      return {
        totalHabits: habits.length,
        activeHabits: 0,
        avgStreak: 0,
        avgCompletionRate: 0,
        topPerformers: []
      }
    }
    
    const streaks = activeHabits.map(h => ({
      habitId: h.id,
      streak: this.getHabitStreak(h.id)
    }))
    
    const avgStreak = streaks.reduce((acc, s) => acc + s.streak, 0) / streaks.length
    
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const completionRates = activeHabits.map(habit => {
      const recentCheckIns = habitCheckIns.filter(
        c => c.habitId === habit.id && new Date(c.date) >= thirtyDaysAgo
      )
      const completed = recentCheckIns.filter(c => c.completed).length
      return recentCheckIns.length > 0 ? completed / recentCheckIns.length : 0
    })
    
    const avgCompletionRate = completionRates.reduce((acc, rate) => acc + rate, 0) / completionRates.length
    
    const topPerformers = streaks
      .filter(s => s.streak > 0)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 3)
    
    return {
      totalHabits: habits.length,
      activeHabits: activeHabits.length,
      avgStreak,
      avgCompletionRate,
      topPerformers
    }
  }
}

export function useHabitGoalIntegration() {
  return {
    linkHabitToGoal: HabitGoalIntegration.linkHabitToGoal,
    unlinkHabitFromGoal: HabitGoalIntegration.unlinkHabitFromGoal,
    getHabitsForGoal: HabitGoalIntegration.getHabitsForGoal,
    getGoalsForHabit: HabitGoalIntegration.getGoalsForHabit,
    calculateHabitContribution: HabitGoalIntegration.calculateHabitContribution,
    updateGoalProgressFromHabit: HabitGoalIntegration.updateGoalProgressFromHabit,
    getHabitGoalContributions: HabitGoalIntegration.getHabitGoalContributions,
    suggestHabitsForGoal: HabitGoalIntegration.suggestHabitsForGoal,
    getOverallHabitHealth: HabitGoalIntegration.getOverallHabitHealth
  }
}
