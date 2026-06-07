export interface SubTask {
  id: string
  title: string
  completed: boolean
  dueDate?: Date
  createdAt: Date
}

export interface TaskComment {
  id: string
  content: string
  createdAt: Date
  author?: string
}

export interface RepeatRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  interval: number
  daysOfWeek?: number[]
  dayOfMonth?: number
  endDate?: Date
  endAfterCount?: number
  completedCount?: number
  paused?: boolean
}

export interface RepeatTaskCompletion {
  id: string
  taskId: string
  completedAt: Date
  dueDate?: Date
  note?: string
}

export type ScheduleItemType = 'task' | 'event' | 'reminder'
export type ScheduleStatus = 'todo' | 'in-progress' | 'done' | 'cancelled'

export interface TaskReminder {
  id: string
  type: 'absolute' | 'before-due' | 'on-due'
  triggerAt?: Date
  minutesBefore?: number
  enabled: boolean
  triggered?: boolean
  note?: string
}

export interface FilterCriteria {
  search?: string
  priority?: string
  status?: string
  tag?: string
  type?: string
  date?: string
  project?: string
  viewMode?: 'list' | 'kanban' | 'matrix'
}

export interface SavedFilter {
  id: string
  name: string
  criteria: FilterCriteria
  createdAt: Date
}

export interface Task {
  id: string
  title: string
  description?: string
  type: ScheduleItemType
  priority: 'urgent' | 'high' | 'medium' | 'low'
  status: ScheduleStatus
  project?: string
  tags: string[]
  dueDate?: Date
  startTime?: string
  endTime?: string
  isAllDay?: boolean
  estimatedPomodoros?: number
  completedPomodoros: number
  /** 实际投入专注秒数（番茄完成时累加） */
  timeSpent?: number
  createdAt: Date
  completedAt?: Date
  subTasks?: SubTask[]
  comments?: TaskComment[]
  repeatRule?: RepeatRule
  repeatTemplateId?: string
  isRepeatInstance?: boolean
  reminders?: TaskReminder[]
  color?: string
  location?: string
  notes?: string
  dependsOn?: string[]
  blockedBy?: string[]
  starred?: boolean
  archived?: boolean
  energy?: 'low' | 'medium' | 'high'
  estimatedMinutes?: number
}

export interface TimeEntry {
  id: string
  project: string
  projectId?: string
  description?: string
  startTime: Date
  endTime?: Date
  duration: number
  tags?: string[]
  taskId?: string
}

export interface PomodoroSession {
  id: string
  type: 'work' | 'short-break' | 'long-break'
  duration: number
  completedAt: Date
  taskId?: string
  note?: string
  tags?: string[]
}

export interface WorkingHours {
  workStartTime: string
  workEndTime: string
  workDays: number[]
  enabled: boolean
}

export interface PomodoroSettings {
  workDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  sessionsBeforeLongBreak: number
}

export interface Project {
  id: string
  name: string
  color: string
  totalTime: number
}

export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  category?: string
  reminderTime?: string
  reminderEnabled?: boolean
  createdAt: Date
  archived: boolean
  trackingType: 'boolean' | 'quantity'
  targetValue?: number
  unit?: string
  streakFreezes?: number
  maxStreakFreezes?: number
  linkedGoalId?: string
}

export interface HabitCheckIn {
  id: string
  habitId: string
  date: Date
  completed: boolean
  note?: string
  value?: number
}

export interface Anniversary {
  id: string
  title: string
  date: Date
  type: 'birthday' | 'anniversary' | 'countdown' | 'custom' | 'festival'
  repeat: boolean
  remindDays: number
  color: string
  icon: string
  createdAt: Date
  note?: string
}

export interface Notification {
  id: string
  type: 'task-due' | 'task-overdue' | 'habit-reminder' | 'anniversary' | 'pomodoro' | 'achievement'
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
  icon?: string
}

export interface Goal {
  id: string
  title: string
  description?: string
  type: 'yearly' | 'quarterly' | 'monthly' | 'weekly'
  category: 'work' | 'personal' | 'health' | 'learning' | 'finance' | 'other'
  status: 'not-started' | 'in-progress' | 'completed' | 'paused'
  progress: number
  targetValue?: number
  currentValue?: number
  unit?: string
  startDate: Date
  endDate: Date
  milestones: Milestone[]
  linkedTasks: string[]
  linkedHabits?: string[]
  createdAt: Date
  completedAt?: Date
}

export interface Milestone {
  id: string
  title: string
  completed: boolean
  dueDate?: Date
  completedAt?: Date
}

export type TimeBlockCategory = 'focus' | 'meeting' | 'break' | 'personal' | 'work'

export interface TimeBlock {
  id: string
  title: string
  date: Date
  startTime: string
  endTime: string
  category: TimeBlockCategory
  color: string
  taskId?: string
  description?: string
  completed?: boolean
  createdAt: Date
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: 'focus' | 'tasks' | 'habits' | 'streak' | 'special'
  requirement: {
    type: 'count' | 'streak' | 'time' | 'special'
    value: number
    metric: string
  }
  earned: boolean
  earnedAt?: Date
  progress: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  points: number
}

export interface UserLevel {
  level: number
  totalPoints: number
  currentLevelPoints: number
  nextLevelPoints: number
  title: string
}

export interface Tag {
  id: string
  name: string
  color: string
  category?: string
  usageCount: number
  createdAt: Date
}

export interface Report {
  id: string
  type: 'daily' | 'weekly' | 'monthly'
  startDate: Date
  endDate: Date
  summary: {
    totalFocusTime: number
    tasksCompleted: number
    habitsCompleted: number
    pomodorosCompleted: number
    efficiency: number
  }
  insights: string[]
  createdAt: Date
}

export interface Reminder {
  id: string
  type: 'task' | 'habit' | 'goal' | 'custom'
  referenceId?: string
  title: string
  message: string
  scheduledTime: Date
  repeat?: 'daily' | 'weekly' | 'monthly' | 'none'
  enabled: boolean
  lastTriggered?: Date
  createdAt: Date
}

export interface DistractionRecord {
  id: string
  taskId?: string
  reason: string
  timestamp: Date
  duration?: number
  pomodoroSessionId?: string
}

export interface DailyJournal {
  id: string
  date: Date
  content: string
  mood?: 'great' | 'good' | 'neutral' | 'bad' | 'terrible'
  gratitude?: string[]
  wins?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface TaskTemplate {
  id: string
  name: string
  description?: string
  tasks: Omit<Task, 'id' | 'createdAt' | 'completedPomodoros' | 'completedAt'>[]
  category?: string
  usageCount: number
  createdAt: Date
}

export interface PomodoroStrictMode {
  enabled: boolean
  autoStartNext: boolean
  skipBreaks: boolean
  maxSessionsPerDay: number
  lockUntilSessionEnd: boolean
}

export interface ProductivityInsight {
  peakHours: { hour: number; score: number }[]
  mostProductiveDay: string
  averageFocusDuration: number
  totalDistractions: number
  distractionRate: number
  streakDays: number
  weeklyTrend: number
  suggestedFocusTime: string
}

export interface FocusPreset {
  id: string
  name: string
  icon: string
  workDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  sessionsBeforeLongBreak: number
  autoStartBreak: boolean
  autoStartWork: boolean
  soundEnabled: boolean
  color: string
  createdAt: Date
}
