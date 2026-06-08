import { useAppStore } from '@/lib/store'
import type { RepeatRule } from '@/lib/types'

export interface RestoreCounts {
  tasks: number
  habits: number
  habitCheckIns: number
  anniversaries: number
  projects: number
  goals: number
  tags: number
  reminders: number
  [key: string]: number
}

export function restoreDataToStore(data: Record<string, unknown>): RestoreCounts {
  const store = useAppStore.getState()
  const counts: RestoreCounts = {
    tasks: 0,
    habits: 0,
    habitCheckIns: 0,
    anniversaries: 0,
    projects: 0,
    goals: 0,
    tags: 0,
    reminders: 0,
  }

  // 恢复任务
  if (data.tasks && Array.isArray(data.tasks)) {
    data.tasks.forEach((t: Record<string, unknown>) => {
      try {
        store.addTask({
          title: (t.title as string) || '未命名任务',
          description: t.description as string | undefined,
          type: (t.type as 'task' | 'event' | 'reminder') || 'task',
          priority: (t.priority as 'urgent' | 'high' | 'medium' | 'low') || 'medium',
          status: (t.status as 'todo' | 'in-progress' | 'done') || 'todo',
          project: t.project as string | undefined,
          tags: Array.isArray(t.tags) ? t.tags as string[] : [],
          dueDate: t.dueDate ? new Date(t.dueDate as string) : undefined,
          starred: t.starred as boolean | undefined,
          estimatedPomodoros: t.estimatedPomodoros as number | undefined,
          repeatRule: t.repeatRule as RepeatRule | undefined,
        })
        counts.tasks++
      } catch { /* skip invalid tasks */ }
    })
  }

  // 恢复习惯
  if (data.habits && Array.isArray(data.habits)) {
    data.habits.forEach((h: Record<string, unknown>) => {
      try {
        store.addHabit({
          name: (h.name as string) || '未命名习惯',
          icon: (h.icon as string) || '⭐',
          color: (h.color as string) || '#4F46E5',
          frequency: (h.frequency as 'daily' | 'weekly' | 'monthly' | 'custom') || 'daily',
          category: h.category as string | undefined,
          reminderTime: h.reminderTime as string | undefined,
          reminderEnabled: h.reminderEnabled as boolean | undefined,
          trackingType: (h.trackingType as 'boolean' | 'quantity') || 'boolean',
          targetValue: h.targetValue as number | undefined,
          unit: h.unit as string | undefined,
          maxStreakFreezes: h.maxStreakFreezes as number | undefined,
          linkedGoalId: h.linkedGoalId as string | undefined,
        })
        counts.habits++
      } catch { /* skip invalid habits */ }
    })
  }

  // 恢复习惯打卡记录
  if (data.habitCheckIns && Array.isArray(data.habitCheckIns)) {
    data.habitCheckIns.forEach((c: Record<string, unknown>) => {
      try {
        store.checkInHabit(
          c.habitId as string,
          c.date ? new Date(c.date as string) : new Date(),
          c.completed as boolean,
          c.note as string | undefined,
          c.value as number | undefined,
        )
        counts.habitCheckIns++
      } catch { /* skip invalid check-ins */ }
    })
  }

  // 恢复纪念日
  if (data.anniversaries && Array.isArray(data.anniversaries)) {
    data.anniversaries.forEach((a: Record<string, unknown>) => {
      try {
        store.addAnniversary({
          title: (a.title as string) || '未命名纪念日',
          date: a.date ? new Date(a.date as string) : new Date(),
          type: (a.type as 'birthday' | 'anniversary' | 'countdown' | 'custom' | 'festival') || 'custom',
          repeat: (a.repeat as boolean) ?? true,
          remindDays: (a.remindDays as number) ?? 1,
          color: (a.color as string) || '#4F46E5',
          icon: (a.icon as string) || '🎂',
          note: a.note as string | undefined,
        })
        counts.anniversaries++
      } catch { /* skip invalid anniversaries */ }
    })
  }

  // 恢复项目
  if (data.projects && Array.isArray(data.projects)) {
    data.projects.forEach((p: Record<string, unknown>) => {
      try {
        store.addProject({
          name: (p.name as string) || '未命名项目',
          color: (p.color as string) || '#4F46E5',
        })
        counts.projects++
      } catch { /* skip invalid projects */ }
    })
  }

  // 恢复目标
  if (data.goals && Array.isArray(data.goals)) {
    data.goals.forEach((g: Record<string, unknown>) => {
      try {
        store.addGoal({
          title: (g.title as string) || '未命名目标',
          description: g.description as string | undefined,
          type: (g.type as 'yearly' | 'quarterly' | 'monthly' | 'weekly') || 'monthly',
          category: (g.category as 'work' | 'personal' | 'health' | 'learning' | 'finance' | 'other') || 'other',
          status: (g.status as 'not-started' | 'in-progress' | 'completed' | 'paused') || 'not-started',
          progress: (g.progress as number) || 0,
          targetValue: g.targetValue as number | undefined,
          currentValue: g.currentValue as number | undefined,
          unit: g.unit as string | undefined,
          startDate: g.startDate ? new Date(g.startDate as string) : new Date(),
          endDate: g.endDate ? new Date(g.endDate as string) : new Date(),
          milestones: Array.isArray(g.milestones) ? (g.milestones as Array<{ id: string; title: string; completed: boolean; dueDate?: string; completedAt?: string }>).map(m => ({
            id: m.id,
            title: m.title,
            completed: m.completed,
            dueDate: m.dueDate ? new Date(m.dueDate) : undefined,
            completedAt: m.completedAt ? new Date(m.completedAt) : undefined,
          })) : [],
          linkedTasks: Array.isArray(g.linkedTasks) ? g.linkedTasks as string[] : [],
          linkedHabits: Array.isArray(g.linkedHabits) ? g.linkedHabits as string[] : undefined,
        })
        counts.goals++
      } catch { /* skip invalid goals */ }
    })
  }

  // 恢复标签
  if (data.tags && Array.isArray(data.tags)) {
    data.tags.forEach((t: Record<string, unknown>) => {
      try {
        store.addTag({
          name: (t.name as string) || '未命名标签',
          color: (t.color as string) || '#4F46E5',
          category: t.category as string | undefined,
        })
        counts.tags++
      } catch { /* skip invalid tags */ }
    })
  }

  // 恢复提醒
  if (data.reminders && Array.isArray(data.reminders)) {
    data.reminders.forEach((r: Record<string, unknown>) => {
      try {
        store.addReminder({
          type: (r.type as 'task' | 'habit' | 'goal' | 'custom') || 'custom',
          referenceId: r.referenceId as string | undefined,
          title: (r.title as string) || '提醒',
          message: (r.message as string) || '',
          scheduledTime: r.scheduledTime ? new Date(r.scheduledTime as string) : new Date(),
          repeat: (r.repeat as 'daily' | 'weekly' | 'monthly' | 'none') || 'none',
          enabled: (r.enabled as boolean) ?? true,
        })
        counts.reminders++
      } catch { /* skip invalid reminders */ }
    })
  }

  return counts
}
