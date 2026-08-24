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

export type TreeState = 'seed' | 'sprout' | 'sapling' | 'growing' | 'mature' | 'withered'

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
  autoStartBreak?: boolean
  autoStartWork?: boolean
  soundEnabled?: boolean
  /** 完成音效预设 ID，默认 'classic' */
  notificationSound?: string
}

export interface Project {
  id: string
  name: string
  color: string
  totalTime: number
  parentId?: string
  /** 每周预算（分钟） */
  budgetMinutes?: number
}

export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  /** 自定义星期模式（0=周日..6=周六），frequency='custom' 时生效 */
  weeklyPattern?: number[]
  /** 每 N 天完成一次（frequency='custom' 且未设置 weeklyPattern 时生效） */
  intervalDays?: number
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
  /** 关联实体类型：删除实体时级联清理该实体通知 */
  relatedType?: 'task' | 'habit' | 'anniversary' | 'goal' | 'project'
  /** 关联实体 id */
  relatedId?: string
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

/** @deprecated 未使用，将在未来版本中移除 */
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

export interface SyncConflict {
  id: string
  type: 'task' | 'habit' | 'goal' | 'anniversary' | 'project' | 'tag' | 'other'
  name: string
  localData: unknown
  remoteData: unknown
  localUpdatedAt?: Date
  remoteUpdatedAt?: Date
}

export interface FocusShieldItem {
  id: string
  type: 'website' | 'app'
  name: string
  pattern: string
  enabled: boolean
}

export type FocusShieldMode = 'blacklist' | 'whitelist'

export interface FocusShieldConfig {
  mode: FocusShieldMode
  items: FocusShieldItem[]
}

/** 定时封锁会话时间窗：days 为周日=0 的星期数组；start/end 为 HH:mm，支持跨夜 */
export interface FocusShieldWindow {
  id: string
  label?: string
  days: number[]
  start: string
  end: string
}

export interface FocusShieldScheduleState {
  enabled: boolean
  windows: FocusShieldWindow[]
}

// ─── 自动时间线追踪（仅本地存储，不上云） ───

export type ActivityCategory = 'work' | 'distraction' | 'neutral'

export interface ActivityAppUsage {
  /** 进程名（小写） */
  name: string
  /** 首次见到的窗口标题摘要（可选展示） */
  title?: string
  seconds: number
  category: ActivityCategory
}

export interface ActivityDay {
  /** YYYY-MM-DD */
  date: string
  apps: ActivityAppUsage[]
}

export interface ActivitySettings {
  enabled: boolean
}

// ─── 日历订阅（ICS 只读聚合） ───

export type SubscriptionStatus = 'idle' | 'syncing' | 'synced' | 'error'

export interface SubscribedCalendar {
  id: string
  name: string
  url: string
  color: string
  enabled: boolean
  lastFetchedAt?: Date | null
  lastError?: string | null
  status?: SubscriptionStatus
}

export interface ExternalCalendarEvent {
  id: string
  calendarId: string
  title: string
  start: Date
  end: Date
  allDay: boolean
}
