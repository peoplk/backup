import type { Habit, Anniversary, Task, TimeEntry, PomodoroSession, Project, HabitCheckIn } from '@/lib/types'

export const APP_CONFIG = {
  name: 'FocusFlow',
  description: '生产力助手',
  version: '1.0.0',
}

export const USER_CONFIG = {
  name: '用户',
  plan: '专业版',
  avatar: '/avatar.jpg',
}

export const NAV_ITEMS = [
  { id: 'dashboard' as const, label: '概览' },
  { id: 'tasks' as const, label: '任务' },
  { id: 'focus' as const, label: '专注' },
  { id: 'habits' as const, label: '习惯' },
  { id: 'goals' as const, label: '目标' },
  { id: 'calendar' as const, label: '日历' },
  { id: 'anniversaries' as const, label: '纪念日' },
  { id: 'journal' as const, label: '日记' },
  { id: 'analytics' as const, label: '统计' },
]

export const THEME_CONFIG = {
  light: '浅色模式',
  dark: '深色模式',
}

export const POMODORO_CONFIG = {
  workDuration: 25 * 60,
  shortBreakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  sessionsBeforeLongBreak: 4,
}

export const DEFAULT_HABITS: Omit<Habit, 'id' | 'createdAt' | 'archived'>[] = [
  { name: '阅读30分钟', icon: '📖', color: '#4A90E2', frequency: 'daily', trackingType: 'boolean' },
  { name: '运动健身', icon: '🏃', color: '#7ED321', frequency: 'daily', trackingType: 'boolean' },
  { name: '早起', icon: '🌅', color: '#F5A623', frequency: 'daily', trackingType: 'boolean' },
  { name: '冥想', icon: '🧘', color: '#9B59B6', frequency: 'daily', trackingType: 'boolean' },
]

export const DEFAULT_ANNIVERSARIES: Omit<Anniversary, 'id' | 'createdAt'>[] = [
  { title: '新年', date: new Date(new Date().getFullYear(), 0, 1), type: 'festival', repeat: true, remindDays: 7, color: '#E91E63', icon: '🎉' },
  { title: '中秋节', date: new Date(new Date().getFullYear(), 8, 17), type: 'festival', repeat: true, remindDays: 7, color: '#F5A623', icon: '🌕' },
]

export const DEFAULT_PROJECTS: Omit<Project, 'id' | 'totalTime'>[] = [
  { name: '工作', color: '#4A90E2' },
  { name: '学习', color: '#7ED321' },
  { name: '生活', color: '#F5A623' },
]

export const DEFAULT_TASKS: Omit<Task, 'id' | 'createdAt' | 'completedPomodoros'>[] = [
  { title: '完成项目方案', description: '整理需求文档并完成初版方案', type: 'task', priority: 'high', status: 'in-progress', project: '工作', tags: ['方案'], dueDate: new Date(), estimatedPomodoros: 4 },
  { title: '代码评审', description: '评审本周提交的代码', type: 'task', priority: 'medium', status: 'todo', project: '工作', tags: ['开发'], dueDate: new Date(Date.now() + 86400000), estimatedPomodoros: 2 },
  { title: '阅读技术书籍', description: '继续阅读设计模式相关章节', type: 'task', priority: 'low', status: 'todo', project: '学习', tags: ['阅读'], dueDate: new Date(Date.now() + 2 * 86400000), estimatedPomodoros: 2 },
  { title: '整理房间', description: '周末大扫除', type: 'task', priority: 'low', status: 'todo', project: '生活', tags: ['家务'], dueDate: new Date(Date.now() + 3 * 86400000), estimatedPomodoros: 1 },
  { title: '学习新框架', description: '完成官方教程前3章', type: 'task', priority: 'medium', status: 'todo', project: '学习', tags: ['学习'], dueDate: new Date(Date.now() + 5 * 86400000), estimatedPomodoros: 6 },
]

export const DEFAULT_TIME_ENTRIES: Omit<TimeEntry, 'id'>[] = [
  { project: '工作', description: '项目方案撰写', startTime: new Date(Date.now() - 2 * 86400000 + 9 * 3600000), endTime: new Date(Date.now() - 2 * 86400000 + 11 * 3600000), duration: 7200 },
  { project: '学习', description: '阅读技术书籍', startTime: new Date(Date.now() - 86400000 + 14 * 3600000), endTime: new Date(Date.now() - 86400000 + 15.5 * 3600000), duration: 5400 },
  { project: '工作', description: '代码评审', startTime: new Date(Date.now() - 86400000 + 10 * 3600000), endTime: new Date(Date.now() - 86400000 + 11 * 3600000), duration: 3600 },
]

export const generateDefaultPomodoroSessions = (): Omit<PomodoroSession, 'id'>[] => {
  const sessions: Omit<PomodoroSession, 'id'>[] = []
  for (let i = 4; i >= 0; i--) {
    const day = new Date()
    day.setDate(day.getDate() - i)
    day.setHours(9 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60))
    sessions.push({ type: 'work', duration: 25 * 60, completedAt: day })
    day.setHours(day.getHours() + 1)
    sessions.push({ type: 'work', duration: 25 * 60, completedAt: day })
    if (i === 0) break
    day.setHours(day.getHours() + 1)
    sessions.push({ type: 'work', duration: 25 * 60, completedAt: day })
  }
  return sessions
}

export const generateHabitCheckIns = (habits: Habit[]): Omit<HabitCheckIn, 'id'>[] => {
  const checkIns: Omit<HabitCheckIn, 'id'>[] = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    for (const habit of habits) {
      const completed = Math.random() > 0.3
      checkIns.push({ habitId: habit.id, date, completed })
    }
  }
  return checkIns
}

export const VIEW_TITLES: Record<string, string> = {
  dashboard: '概览',
  tasks: '任务',
  focus: '专注',
  habits: '习惯',
  goals: '目标',
  calendar: '日历',
  anniversaries: '纪念日',
  journal: '每日日记',
  analytics: '统计',
  settings: '设置',
  'time-block': '日历',
}

export const NOTIFICATION_CONFIG = {
  pomodoroComplete: {
    title: '番茄钟完成',
    message: '你刚刚完成了一个专注时段',
  },
  taskDue: {
    title: '任务到期提醒',
    message: '任务即将到期',
  },
  streakAchievement: {
    title: '连续打卡',
    message: '恭喜获得徽章!',
  },
}

export const PRIORITY_CONFIG = {
  urgent: { label: '紧急', color: '#E91E63' },
  high: { label: '高', color: '#FF5722' },
  medium: { label: '中', color: '#4A90E2' },
  low: { label: '低', color: '#9E9E9E' },
}

export const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六']
export const WEEK_DAYS_FULL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

export const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0')
  return `${hour}:00`
})

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: 'none',
  borderRadius: '12px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
  padding: '10px 14px',
  color: 'hsl(var(--card-foreground))',
}

export const TASK_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  task: { label: '任务', color: 'text-chart-1', bg: 'bg-chart-1/15' },
  event: { label: '日程', color: 'text-chart-4', bg: 'bg-chart-4/15' },
  reminder: { label: '提醒', color: 'text-chart-3', bg: 'bg-chart-3/15' },
}

export const APP_COLORS = {
  blue: '#4A90E2',
  green: '#7ED321',
  purple: '#9B59B6',
  orange: '#F5A623',
  pink: '#E91E63',
  gray: '#607D8B',
  indigo: '#6366f1',
  midGray: '#6b7280',
  primary: '#4F46E5',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const

export const TIME_BLOCK_CATEGORY_CONFIG: Record<string, { label: string; icon: string; colorClass: string; bgClass: string; borderClass: string }> = {
  focus: { label: '专注', icon: 'Brain', colorClass: 'text-chart-1', bgClass: 'bg-chart-1/12', borderClass: 'border-chart-1/40' },
  meeting: { label: '会议', icon: 'Users', colorClass: 'text-chart-4', bgClass: 'bg-chart-4/12', borderClass: 'border-chart-4/40' },
  break: { label: '休息', icon: 'Coffee', colorClass: 'text-chart-3', bgClass: 'bg-chart-3/12', borderClass: 'border-chart-3/40' },
  personal: { label: '个人', icon: 'Heart', colorClass: 'text-destructive', bgClass: 'bg-destructive/10', borderClass: 'border-destructive/30' },
  work: { label: '工作', icon: 'Briefcase', colorClass: 'text-chart-2', bgClass: 'bg-chart-2/12', borderClass: 'border-chart-2/40' },
}
