import { useAppStore } from './store'
import type { Habit, Goal, HabitCheckIn } from './types'

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

export class HabitGoalIntegration {
  private static habitGoalLinks: HabitGoalLink[] = []
  
  static linkHabitToGoal(
    habitId: string,
    goalId: string,
    contributionWeight: number = 1,
    milestoneId?: string
  ): void {
    const existingIndex = this.habitGoalLinks.findIndex(
      link => link.habitId === habitId && link.goalId === goalId
    )
    
    if (existingIndex >= 0) {
      this.habitGoalLinks[existingIndex] = {
        habitId,
        goalId,
        contributionWeight,
        milestoneId
      }
    } else {
      this.habitGoalLinks.push({
        habitId,
        goalId,
        contributionWeight,
        milestoneId
      })
    }
  }
  
  static unlinkHabitFromGoal(habitId: string, goalId: string): void {
    this.habitGoalLinks = this.habitGoalLinks.filter(
      link => !(link.habitId === habitId && link.goalId === goalId)
    )
  }
  
  static getHabitsForGoal(goalId: string): HabitGoalLink[] {
    return this.habitGoalLinks.filter(link => link.goalId === goalId)
  }
  
  static getGoalsForHabit(habitId: string): HabitGoalLink[] {
    return this.habitGoalLinks.filter(link => link.habitId === habitId)
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
  
  static updateGoalProgressFromHabit(habitId: string): void {
    const { goals, updateGoal, addNotification } = useAppStore.getState()
    const links = this.getGoalsForHabit(habitId)
    
    links.forEach(link => {
      const goal = goals.find(g => g.id === link.goalId)
      if (!goal) return
      
      const contribution = this.calculateHabitContribution(habitId)
      const progressIncrement = contribution * link.contributionWeight * 10
      
      const newProgress = Math.min(goal.progress + progressIncrement, 100)
      
      updateGoal(link.goalId, { progress: newProgress })
      
      if (newProgress >= 100 && goal.progress < 100) {
        addNotification({
          type: 'achievement',
          title: '目标达成',
          message: `恭喜！目标「${goal.title}」已完成！`,
        })
      } else if (newProgress >= 75 && goal.progress < 75) {
        addNotification({
          type: 'achievement',
          title: '目标进度更新',
          message: `目标「${goal.title}」已完成 75%！`,
        })
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
  
  static getHabitStreak(habitId: string): number {
    const { habitCheckIns } = useAppStore.getState()
    let streak = 0
    const checkDate = new Date()
    
    while (true) {
      const dateStr = checkDate.toDateString()
      const checkIn = habitCheckIns.find(
        c => c.habitId === habitId && new Date(c.date).toDateString() === dateStr
      )
      
      if (checkIn?.completed) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
    
    return streak
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
