import type { 
  Task, 
  TimeEntry, 
  PomodoroSession, 
  PomodoroSettings, 
  Project, 
  Habit, 
  HabitCheckIn, 
  Anniversary,
  SubTask,
  TaskComment,
  RepeatRule,
  RepeatTaskCompletion,
  Notification,
  Goal,
  Milestone,
  Achievement,
  UserLevel,
  Tag,
  Reminder,
  ScheduleItemType,
  TimeBlock,
  DistractionRecord,
  DailyJournal,
  TaskTemplate,
  PomodoroStrictMode,
  FocusPreset,
  FocusShieldConfig,
  FocusShieldItem,
  FocusShieldMode,
  FocusShieldScheduleState,
  FocusShieldWindow,
  ActivitySettings,
  ActivityDay,
  SubscribedCalendar,
  ExternalCalendarEvent,
  TaskReminder,
  SavedFilter,
  FilterCriteria,
  TreeState,
} from '@/lib/types'
import type { StoreApi } from 'zustand'

export type AppStoreApi = StoreApi<AppState>

export interface AppState {
  tasks: Task[]
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completedPomodoros'>) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  toggleTaskStar: (id: string) => void
  archiveTask: (id: string) => void
  unarchiveTask: (id: string) => void
  completeTask: (id: string) => void
  uncompleteTask: (id: string) => void
  skipRepeatTask: (id: string) => void
  pauseRepeatTask: (id: string) => void
  resumeRepeatTask: (id: string) => void
  refreshRepeatTasks: () => void
  batchCompleteTasks: (ids: string[]) => void
  batchDeleteTasks: (ids: string[]) => void
  batchUpdateTaskPriority: (ids: string[], priority: Task['priority']) => void
  batchAddTagToTasks: (ids: string[], tag: string) => void
  addSubTask: (taskId: string, title: string, dueDate?: Date) => void
  updateSubTask: (taskId: string, subTaskId: string, updates: Partial<SubTask>) => void
  toggleSubTask: (taskId: string, subTaskId: string) => void
  deleteSubTask: (taskId: string, subTaskId: string) => void
  reorderSubTasks: (taskId: string, subTaskIds: string[]) => void
  convertSubTaskToTask: (taskId: string, subTaskId: string) => void
  convertTaskToEvent: (id: string, startTime: string, endTime: string) => void
  convertEventToTask: (id: string) => void
  addTaskDependency: (taskId: string, dependsOnTaskId: string) => void
  removeTaskDependency: (taskId: string, dependsOnTaskId: string) => void
  getBlockedTasks: (taskId: string) => string[]
  canCompleteTask: (taskId: string) => boolean
  
  addTaskComment: (taskId: string, content: string) => void
  deleteTaskComment: (taskId: string, commentId: string) => void
  addTaskReminder: (taskId: string, reminder: Omit<TaskReminder, 'id'>) => void
  updateTaskReminder: (taskId: string, reminderId: string, updates: Partial<TaskReminder>) => void
  removeTaskReminder: (taskId: string, reminderId: string) => void
  markReminderTriggered: (taskId: string, reminderId: string) => void

  timeEntries: TimeEntry[]
  activeTimeEntry: TimeEntry | null
  startTimeEntry: (entry: Omit<TimeEntry, 'id' | 'startTime' | 'duration'>) => string
  stopTimeEntry: () => void
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => string

  pomodoroSessions: PomodoroSession[]
  addPomodoroSession: (session: Omit<PomodoroSession, 'id' | 'completedAt'>) => void
  abandonedPomodoroSessions: PomodoroSession[]
  addAbandonedPomodoroSession: (session: Omit<PomodoroSession, 'id' | 'completedAt'>) => void
  pomodoroSettings: PomodoroSettings
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void
  
  pomodoroTimerState: {
    mode: 'work' | 'short-break' | 'long-break'
    timeLeft: number
    isRunning: boolean
    completedSessions: number
    selectedTaskId: string | null
    treeGrowth: number
    treeState: TreeState
    lastSessionDate: string
  }
  updatePomodoroTimerState: (updates: Partial<AppState['pomodoroTimerState']>) => void
  resetPomodoroTimer: () => void
  checkAndResetDailyPomodoro: () => void

  projects: Project[]
  addProject: (project: Omit<Project, 'id' | 'totalTime'>) => Project | null
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void

  habits: Habit[]
  habitCheckIns: HabitCheckIn[]
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => void
  updateHabit: (id: string, updates: Partial<Habit>) => void
  deleteHabit: (id: string) => void
  checkInHabit: (habitId: string, date: Date, completed: boolean, note?: string, value?: number) => void
  useStreakFreeze: (habitId: string) => void
  batchCheckInHabits: (habitIds: string[], dates: Date[]) => void

  anniversaries: Anniversary[]
  addAnniversary: (anniversary: Omit<Anniversary, 'id' | 'createdAt'>) => void
  updateAnniversary: (id: string, updates: Partial<Anniversary>) => void
  deleteAnniversary: (id: string) => void

  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void
  removeNotification: (id: string) => void
  removeNotificationsByEntity: (relatedType: string, relatedId: string) => void
  removeNotificationsForEntities: (entities: { type: string; id: string }[]) => void
  purgeOrphanedNotifications: () => void

  sidebarCollapsed: boolean
  toggleSidebar: () => void
  activeView: 'dashboard' | 'tasks' | 'focus' | 'analytics' | 'habits' | 'anniversaries' | 'settings' | 'goals' | 'time-block' | 'calendar' | 'journal'
  setActiveView: (view: AppState['activeView']) => void
  
  activeSmartList: string | null
  setActiveSmartList: (listId: string | null) => void
  
  isFullscreen: boolean
  setIsFullscreen: (isFullscreen: boolean) => void

  goals: Goal[]
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void
  updateGoal: (id: string, updates: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  addMilestone: (goalId: string, milestone: Omit<Milestone, 'id'>) => void
  toggleMilestone: (goalId: string, milestoneId: string) => void
  deleteMilestone: (goalId: string, milestoneId: string) => void
  reorderMilestones: (goalId: string, milestoneIds: string[]) => void

  achievements: Achievement[]
  userLevel: UserLevel
  checkAchievements: () => void
  addPoints: (points: number) => void

  tags: Tag[]
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'usageCount'>) => void
  updateTag: (id: string, updates: Partial<Tag>) => void
  deleteTag: (id: string) => void
  incrementTagUsage: (name: string) => void

  reminders: Reminder[]
  addReminder: (reminder: Omit<Reminder, 'id' | 'createdAt'>) => void
  updateReminder: (id: string, updates: Partial<Reminder>) => void
  deleteReminder: (id: string) => void

  timeBlocks: TimeBlock[]
  addTimeBlock: (block: Omit<TimeBlock, 'id' | 'createdAt'>) => void
  updateTimeBlock: (id: string, updates: Partial<TimeBlock>) => void
  deleteTimeBlock: (id: string) => void
  getTimeBlocksForDate: (date: Date) => TimeBlock[]

  focusGoals: { dailyMinutes: number; weeklyMinutes: number; dailyPomodoros: number }
  updateFocusGoals: (goals: Partial<AppState['focusGoals']>) => void

  distractions: DistractionRecord[]
  addDistraction: (distraction: Omit<DistractionRecord, 'id'>) => void
  deleteDistraction: (id: string) => void
  getDistractionsForDate: (date: Date) => DistractionRecord[]
  getDistractionCount: (taskId?: string) => number

  journals: DailyJournal[]
  addJournal: (journal: Omit<DailyJournal, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateJournal: (id: string, updates: Partial<DailyJournal>) => void
  deleteJournal: (id: string) => void
  getJournalForDate: (date: Date) => DailyJournal | undefined

  taskTemplates: TaskTemplate[]
  addTaskTemplate: (template: Omit<TaskTemplate, 'id' | 'createdAt' | 'usageCount'>) => void
  deleteTaskTemplate: (id: string) => void
  applyTaskTemplate: (templateId: string) => void

  pomodoroStrictMode: PomodoroStrictMode
  updatePomodoroStrictMode: (updates: Partial<PomodoroStrictMode>) => void

  dashboardWidgets: string[]
  updateDashboardWidgets: (widgets: string[]) => void

  darkModeSchedule: { enabled: boolean; lightStart: string; darkStart: string }
  updateDarkModeSchedule: (updates: Partial<AppState['darkModeSchedule']>) => void

  workingHours: { enabled: boolean; workStartTime: string; workEndTime: string; workDays: number[] }
  updateWorkingHours: (updates: Partial<AppState['workingHours']>) => void

  focusSoundSettings: {
    isPlaying: boolean
    volume: number
    currentSound: string | null
    currentMusic: string | null
    autoPlay: boolean
  }
  updateFocusSoundSettings: (updates: Partial<AppState['focusSoundSettings']>) => void

  dailyReviewSettings: {
    enabled: boolean
    reviewTime: string
    lastReviewDate: string | null
    showNotification: boolean
  }
  updateDailyReviewSettings: (updates: Partial<AppState['dailyReviewSettings']>) => void
  markDailyReviewShown: (dateKey: string) => void

  repeatCompletions: RepeatTaskCompletion[]
  addRepeatCompletion: (completion: Omit<RepeatTaskCompletion, 'id'>) => void
  deleteRepeatCompletion: (id: string) => void
  getRepeatCompletionsForTask: (taskId: string) => RepeatTaskCompletion[]
  getRepeatCompletionsForDate: (date: Date) => RepeatTaskCompletion[]

  taskOrder: string[]
  updateTaskOrder: (order: string[]) => void
  rescheduleTask: (taskId: string, newDate: Date) => void
  rescheduleOverdueTasks: (taskIds: string[], newDate: Date) => void

  trashedItems: { id: string; type: 'task' | 'habit' | 'goal' | 'anniversary'; data: unknown; deletedAt: Date }[]
  moveToTrash: (id: string, type: 'task' | 'habit' | 'goal' | 'anniversary', data: unknown) => void
  restoreFromTrash: (id: string) => void
  undoLastDelete: () => void
  emptyTrash: () => void
  clearExpiredTrash: () => void

  clearOldSessions: () => void
  clearOldTimeEntries: () => void
  clearOldHabitCheckIns: () => void
  clearOldRepeatCompletions: () => void
  clearOldNotifications: () => void
  clearAllOldData: () => void
  refreshRepeatTasksStatus: () => void

  focusPresets: FocusPreset[]
  addFocusPreset: (preset: Omit<FocusPreset, 'id' | 'createdAt'>) => void
  updateFocusPreset: (id: string, updates: Partial<FocusPreset>) => void
  deleteFocusPreset: (id: string) => void
  applyFocusPreset: (id: string) => void

  focusShield: FocusShieldConfig
  updateFocusShield: (updates: Partial<FocusShieldConfig>) => void
  addFocusShieldItem: (item: Omit<FocusShieldItem, 'id'>) => void
  deleteFocusShieldItem: (id: string) => void
  toggleFocusShieldItem: (id: string) => void
  setFocusShieldMode: (mode: FocusShieldMode) => void

  focusShieldSchedule: FocusShieldScheduleState
  updateFocusShieldSchedule: (updates: Partial<FocusShieldScheduleState>) => void
  upsertShieldWindow: (win: Omit<FocusShieldWindow, 'id'> & { id?: string }) => void
  removeShieldWindow: (id: string) => void

  activitySettings: ActivitySettings
  activityDays: ActivityDay[]
  setActivityEnabled: (enabled: boolean) => void
  recordActivitySample: (sample: { app: string; title?: string; seconds: number }) => void
  clearActivityData: () => void

  subscribedCalendars: SubscribedCalendar[]
  externalEvents: ExternalCalendarEvent[]
  addSubscribedCalendar: (cal: { name: string; url: string; color?: string }) => SubscribedCalendar | null
  updateSubscribedCalendar: (id: string, updates: Partial<SubscribedCalendar>) => void
  removeSubscribedCalendar: (id: string) => void
  toggleSubscribedCalendar: (id: string) => void
  setExternalEvents: (calendarId: string, events: ExternalCalendarEvent[]) => void

  savedFilters: SavedFilter[]
  addSavedFilter: (name: string, criteria: FilterCriteria) => void
  renameSavedFilter: (id: string, name: string) => void
  deleteSavedFilter: (id: string) => void
  reorderSavedFilters: (orderedIds: string[]) => void

  activeSavedFilterId: string | null
  setActiveSavedFilterId: (id: string | null) => void
}
