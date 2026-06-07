import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  TaskReminder,
  SavedFilter,
  FilterCriteria,
} from './types'
import { CalendarBridge } from './calendar-bridge'
import { 
  DEFAULT_HABITS, 
  DEFAULT_ANNIVERSARIES, 
  DEFAULT_TASKS, 
  DEFAULT_TIME_ENTRIES,
  DEFAULT_PROJECTS,
  POMODORO_CONFIG,
  generateDefaultPomodoroSessions,
  generateHabitCheckIns
} from './config'
import { pushDataToCloud, resolveConflict, setSyncDataCallback, setSyncDataProvider } from './sync-store'

export type { 
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
  TaskReminder,
  SavedFilter,
  FilterCriteria,
} from './types'

interface AppState {
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
  pomodoroSettings: {
    workDuration: number
    shortBreakDuration: number
    longBreakDuration: number
    sessionsBeforeLongBreak: number
  }
  updatePomodoroSettings: (settings: Partial<AppState['pomodoroSettings']>) => void
  
  pomodoroTimerState: {
    mode: 'work' | 'short-break' | 'long-break'
    timeLeft: number
    isRunning: boolean
    completedSessions: number
    selectedTaskId: string | null
    treeGrowth: number
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

  anniversaries: Anniversary[]
  addAnniversary: (anniversary: Omit<Anniversary, 'id' | 'createdAt'>) => void
  updateAnniversary: (id: string, updates: Partial<Anniversary>) => void
  deleteAnniversary: (id: string) => void

  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void

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

  savedFilters: SavedFilter[]
  addSavedFilter: (name: string, criteria: FilterCriteria) => void
  renameSavedFilter: (id: string, name: string) => void
  deleteSavedFilter: (id: string) => void
  reorderSavedFilters: (orderedIds: string[]) => void

  activeSavedFilterId: string | null
  setActiveSavedFilterId: (id: string | null) => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

const defaultHabits: Habit[] = DEFAULT_HABITS.map((h, i) => ({
  ...h,
  id: String(i + 1),
  createdAt: new Date(),
  archived: false,
}))

const defaultAnniversaries: Anniversary[] = DEFAULT_ANNIVERSARIES.map((a, i) => ({
  ...a,
  id: String(i + 1),
  createdAt: new Date(),
}))

const defaultTasks: Task[] = DEFAULT_TASKS.map((t, i) => ({
  ...t,
  id: String(i + 1),
  createdAt: new Date(),
  completedPomodoros: 0,
  completedAt: t.status === 'done' ? new Date() : undefined,
  type: t.type || 'task',
}))

const defaultTimeEntries: TimeEntry[] = DEFAULT_TIME_ENTRIES.map((e, i) => ({
  ...e,
  id: String(i + 1),
}))

const defaultProjects: Project[] = DEFAULT_PROJECTS.map((p, i) => ({
  ...p,
  id: String(i + 1),
  totalTime: [28800, 14400, 7200, 3600][i] || 0,
}))

const defaultPomodoroSessions = generateDefaultPomodoroSessions().map((s, i) => ({
  ...s,
  id: String(i + 1),
}))

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function scheduleCloudSync() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const store = useAppStore.getState()
    const syncData = {
      tasks: store.tasks,
      timeEntries: store.timeEntries,
      pomodoroSessions: store.pomodoroSessions,
      pomodoroSettings: store.pomodoroSettings,
      pomodoroTimerState: store.pomodoroTimerState,
      projects: store.projects,
      habits: store.habits,
      habitCheckIns: store.habitCheckIns,
      anniversaries: store.anniversaries,
      notifications: store.notifications,
      sidebarCollapsed: store.sidebarCollapsed,
      activeSmartList: store.activeSmartList,
      goals: store.goals,
      achievements: store.achievements,
      userLevel: store.userLevel,
      tags: store.tags,
      reminders: store.reminders,
      focusGoals: store.focusGoals,
      repeatCompletions: store.repeatCompletions,
      trashedItems: store.trashedItems,
      taskOrder: store.taskOrder,
      timeBlocks: store.timeBlocks,
      distractions: store.distractions,
      journals: store.journals,
      taskTemplates: store.taskTemplates,
      pomodoroStrictMode: store.pomodoroStrictMode,
      dashboardWidgets: store.dashboardWidgets,
      darkModeSchedule: store.darkModeSchedule,
      workingHours: store.workingHours,
      focusSoundSettings: store.focusSoundSettings,
      focusPresets: store.focusPresets,
      dailyReviewSettings: store.dailyReviewSettings,
      savedFilters: store.savedFilters,
      activeSavedFilterId: store.activeSavedFilterId,
    }
    pushDataToCloud(syncData)
  }, 2000)
}

const cloudSyncMiddleware = <T extends object>(
  config: (set: (fn: ((state: T) => Partial<T>) | Partial<T>) => void, get: () => T, api: any) => T
) => {
  return (set: (fn: ((state: T) => Partial<T>) | Partial<T>) => void, get: () => T, api: any): T => {
    const syncSet = (fn: ((state: T) => Partial<T>) | Partial<T>) => {
      set(fn)
      scheduleCloudSync()
    }
    return config(syncSet, get, api)
  }
}

export const useAppStore = create<AppState>()(
  persist(
    cloudSyncMiddleware((set, get) => ({
      tasks: defaultTasks,
      addTask: (task) => {
        const newTask: Task = {
          ...task,
          id: generateId(),
          createdAt: new Date(),
          completedPomodoros: 0,
          type: task.type || 'task',
        }
        set((state) => ({
          tasks: [...state.tasks, newTask],
        }))

        if (typeof window !== 'undefined') {
          const syncEnabled = localStorage.getItem('calendar-sync-enabled') === 'true'
          const calendarId = localStorage.getItem('calendar-sync-id')
          if (syncEnabled && calendarId && newTask.dueDate) {
            const start = new Date(newTask.dueDate).getTime()
            const end = start + (newTask.estimatedMinutes || 30) * 60 * 1000
            CalendarBridge.addEvent({
              calendarId: Number(calendarId),
              title: newTask.title,
              description: newTask.description || '',
              startTime: start,
              endTime: end,
            }).catch(() => {})
          }
        }
      },
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),
      deleteTask: (id) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id)
          if (!task) return state
          return {
            tasks: state.tasks.filter((t) => t.id !== id),
            trashedItems: [
              { id, type: 'task' as const, data: task, deletedAt: new Date() },
              ...state.trashedItems,
            ],
          }
        }),
      toggleTaskStar: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, starred: !t.starred } : t
          ),
        })),
      archiveTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, archived: true } : t
          ),
        })),
      unarchiveTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, archived: false } : t
          ),
        })),
      completeTask: (id) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id)
          if (!task) return state
          
          if (task.dependsOn && task.dependsOn.length > 0) {
            const allDependenciesCompleted = task.dependsOn.every(depId => {
              const depTask = state.tasks.find(t => t.id === depId)
              return depTask && depTask.status === 'done'
            })
            if (!allDependenciesCompleted) {
              const notification = {
                type: 'task-due' as const,
                title: '无法完成任务',
                message: `"${task.title}" 有未完成的前置任务`,
              }
              return {
                notifications: [
                  {
                    ...notification,
                    id: generateId(),
                    timestamp: new Date(),
                    read: false,
                  },
                  ...state.notifications,
                ].slice(0, 50),
              }
            }
          }
          
          if (task.repeatRule) {
            const currentCompletedCount = (task.repeatRule.completedCount || 0) + 1
            const completion: RepeatTaskCompletion = {
              id: generateId(),
              taskId: task.id,
              completedAt: new Date(),
              dueDate: task.dueDate,
            }
            
            const hasReachedEndDate = task.repeatRule.endDate && 
              new Date() > new Date(task.repeatRule.endDate)
            const hasReachedCount = task.repeatRule.endAfterCount && 
              currentCompletedCount >= task.repeatRule.endAfterCount
            
            if (hasReachedEndDate || hasReachedCount) {
              const notification = {
                type: 'task-due' as const,
                title: '重复任务已完成',
                message: `"${task.title}" 已完成所有重复周期`,
              }
              return {
                tasks: state.tasks.map((t) =>
                  t.id === id
                    ? { 
                        ...t, 
                        status: 'done' as const, 
                        completedAt: new Date(),
                        repeatRule: {
                          ...t.repeatRule!,
                          completedCount: currentCompletedCount
                        }
                      }
                    : t
                ),
                repeatCompletions: [...state.repeatCompletions, completion],
                notifications: [
                  {
                    ...notification,
                    id: generateId(),
                    timestamp: new Date(),
                    read: false,
                  },
                  ...state.notifications,
                ].slice(0, 50),
              }
            }
            
            const todayDate = new Date()
            todayDate.setHours(0, 0, 0, 0)
            const originalDueDate = new Date(task.dueDate || new Date())
            originalDueDate.setHours(0, 0, 0, 0)
            const baseDate = new Date(Math.max(originalDueDate.getTime(), todayDate.getTime()))
            const newDueDate = new Date(baseDate)
            switch (task.repeatRule.type) {
              case 'daily':
                newDueDate.setDate(newDueDate.getDate() + task.repeatRule.interval)
                break
              case 'weekly':
                newDueDate.setDate(newDueDate.getDate() + 7 * task.repeatRule.interval)
                break
              case 'monthly':
                newDueDate.setMonth(newDueDate.getMonth() + task.repeatRule.interval)
                break
              case 'yearly':
                newDueDate.setFullYear(newDueDate.getFullYear() + task.repeatRule.interval)
                break
            }
            
            const notification = {
              type: 'task-due' as const,
              title: '任务完成',
              message: `"${task.title}" 已完成，下一个周期: ${newDueDate.toLocaleDateString('zh-CN')}`,
            }
            
            return {
              tasks: state.tasks.map((t) =>
                t.id === id
                  ? { 
                      ...t, 
                      status: 'todo' as const,
                      dueDate: newDueDate,
                      completedAt: undefined,
                      completedPomodoros: 0,
                      repeatRule: {
                        ...t.repeatRule!,
                        completedCount: currentCompletedCount
                      }
                    }
                  : t
              ),
              repeatCompletions: [...state.repeatCompletions, completion],
              notifications: [
                {
                  ...notification,
                  id: generateId(),
                  timestamp: new Date(),
                  read: false,
                },
                ...state.notifications,
              ].slice(0, 50),
            }
          }
          const notification = task ? {
            type: 'task-due' as const,
            title: '任务完成',
            message: `"${task.title}" 已完成`,
          } : null
          return {
            tasks: state.tasks.map((t) =>
              t.id === id
                ? { ...t, status: 'done' as const, completedAt: new Date() }
                : t
            ),
            notifications: notification ? [
              {
                ...notification,
                id: generateId(),
                timestamp: new Date(),
                read: false,
              },
              ...state.notifications,
            ].slice(0, 50) : state.notifications,
          }
        }),
      uncompleteTask: (id) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id)
          if (!task) return state
          
          if (task.repeatRule) {
            const taskCompletions = state.repeatCompletions
              .filter((c) => c.taskId === id)
              .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
            
            const lastCompletion = taskCompletions[0]
            
            if (lastCompletion) {
              const newCompletedCount = Math.max(0, (task.repeatRule.completedCount || 1) - 1)
              
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              
              let prevDueDate = lastCompletion.dueDate 
                ? new Date(lastCompletion.dueDate) 
                : new Date()
              
              if (prevDueDate > today) {
                prevDueDate = today
              }
              
              return {
                tasks: state.tasks.map((t) =>
                  t.id === id
                    ? { 
                        ...t, 
                        status: 'todo' as const, 
                        completedAt: undefined,
                        dueDate: prevDueDate,
                        repeatRule: {
                          ...t.repeatRule!,
                          completedCount: newCompletedCount
                        }
                      }
                    : t
                ),
                repeatCompletions: state.repeatCompletions.filter((c) => c.id !== lastCompletion.id),
              }
            }
          }
          
          return {
            tasks: state.tasks.map((t) =>
              t.id === id
                ? { ...t, status: 'todo' as const, completedAt: undefined }
                : t
            ),
          }
        }),
      skipRepeatTask: (id) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id)
          if (!task || !task.repeatRule) return state
          
          const todayDate = new Date()
          todayDate.setHours(0, 0, 0, 0)
          const originalDueDate = new Date(task.dueDate || new Date())
          originalDueDate.setHours(0, 0, 0, 0)
          const baseDate = new Date(Math.max(originalDueDate.getTime(), todayDate.getTime()))
          const newDueDate = new Date(baseDate)
          switch (task.repeatRule.type) {
            case 'daily':
              newDueDate.setDate(newDueDate.getDate() + task.repeatRule.interval)
              break
            case 'weekly':
              newDueDate.setDate(newDueDate.getDate() + 7 * task.repeatRule.interval)
              break
            case 'monthly':
              newDueDate.setMonth(newDueDate.getMonth() + task.repeatRule.interval)
              break
            case 'yearly':
              newDueDate.setFullYear(newDueDate.getFullYear() + task.repeatRule.interval)
              break
          }
          
          const notification = {
            type: 'task-due' as const,
            title: '跳过重复任务',
            message: `"${task.title}" 已跳过，下一个周期: ${newDueDate.toLocaleDateString('zh-CN')}`,
          }
          
          return {
            tasks: state.tasks.map((t) =>
              t.id === id
                ? { ...t, dueDate: newDueDate }
                : t
            ),
            notifications: [
              {
                ...notification,
                id: generateId(),
                timestamp: new Date(),
                read: false,
              },
              ...state.notifications,
            ].slice(0, 50),
          }
        }),
      pauseRepeatTask: (id) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id)
          if (!task || !task.repeatRule) return state
          
          const notification = {
            type: 'task-due' as const,
            title: '暂停重复任务',
            message: `"${task.title}" 已暂停重复`,
          }
          
          return {
            tasks: state.tasks.map((t) =>
              t.id === id
                ? { ...t, repeatRule: { ...t.repeatRule!, paused: true } }
                : t
            ),
            notifications: [
              {
                ...notification,
                id: generateId(),
                timestamp: new Date(),
                read: false,
              },
              ...state.notifications,
            ].slice(0, 50),
          }
        }),
      resumeRepeatTask: (id) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === id)
          if (!task || !task.repeatRule) return state
          
          const notification = {
            type: 'task-due' as const,
            title: '恢复重复任务',
            message: `"${task.title}" 已恢复重复`,
          }
          
          return {
            tasks: state.tasks.map((t) =>
              t.id === id
                ? { ...t, repeatRule: { ...t.repeatRule!, paused: false } }
                : t
            ),
            notifications: [
              {
                ...notification,
                id: generateId(),
                timestamp: new Date(),
                read: false,
              },
              ...state.notifications,
            ].slice(0, 50),
          }
        }),
      refreshRepeatTasks: () =>
        set((state) => {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          
          const updatedTasks = state.tasks.map((t) => {
            if (!t.repeatRule || t.repeatRule.paused) return t
            if (t.status !== 'done') return t
            
            if (!t.dueDate) return t
            const dueDate = new Date(t.dueDate)
            dueDate.setHours(0, 0, 0, 0)
            
            if (dueDate <= today) {
              return {
                ...t,
                status: 'todo' as const,
                completedAt: undefined,
              }
            }
            
            return t
          })
          
          return { tasks: updatedTasks }
        }),
      batchCompleteTasks: (ids) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            ids.includes(t.id)
              ? { ...t, status: 'done' as const, completedAt: new Date() }
              : t
          ),
        })),
      batchDeleteTasks: (ids) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => !ids.includes(t.id)),
        })),
      batchUpdateTaskPriority: (ids, priority) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            ids.includes(t.id) ? { ...t, priority } : t
          ),
        })),
      batchAddTagToTasks: (ids, tag) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            ids.includes(t.id) && !t.tags.includes(tag)
              ? { ...t, tags: [...t.tags, tag] }
              : t
          ),
        })),
      addSubTask: (taskId, title, dueDate) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subTasks: [...(t.subTasks || []), { 
                    id: generateId(), 
                    title, 
                    completed: false,
                    dueDate,
                    createdAt: new Date()
                  }],
                }
              : t
          ),
        })),
      updateSubTask: (taskId, subTaskId, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subTasks: t.subTasks?.map((st) =>
                    st.id === subTaskId ? { ...st, ...updates } : st
                  ),
                }
              : t
          ),
        })),
      toggleSubTask: (taskId, subTaskId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subTasks: t.subTasks?.map((st) =>
                    st.id === subTaskId ? { ...st, completed: !st.completed } : st
                  ),
                }
              : t
          ),
        })),
      deleteSubTask: (taskId, subTaskId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subTasks: t.subTasks?.filter((st) => st.id !== subTaskId),
                }
              : t
          ),
        })),
      reorderSubTasks: (taskId, subTaskIds) =>
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t
            const subTasksMap = new Map((t.subTasks || []).map(st => [st.id, st]))
            const reorderedSubTasks = subTaskIds
              .map(id => subTasksMap.get(id))
              .filter((st): st is SubTask => st !== undefined)
            return { ...t, subTasks: reorderedSubTasks }
          }),
        })),
      convertSubTaskToTask: (taskId, subTaskId) =>
        set((state) => {
          const parentTask = state.tasks.find(t => t.id === taskId)
          const subTask = parentTask?.subTasks?.find(st => st.id === subTaskId)
          if (!parentTask || !subTask) return state
          
          const newTask: Task = {
            id: generateId(),
            title: subTask.title,
            type: 'task',
            priority: parentTask.priority,
            status: subTask.completed ? 'done' : 'todo',
            project: parentTask.project,
            tags: parentTask.tags,
            completedPomodoros: 0,
            createdAt: new Date(),
            dueDate: subTask.dueDate,
            completedAt: subTask.completed ? new Date() : undefined,
          }
          
          return {
            tasks: [
              ...state.tasks.map(t =>
                t.id === taskId
                  ? { ...t, subTasks: t.subTasks?.filter(st => st.id !== subTaskId) }
                  : t
              ),
              newTask,
            ],
          }
        }),
      convertTaskToEvent: (id, startTime, endTime) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? { ...t, type: 'event' as const, startTime, endTime }
              : t
          ),
        })),
      convertEventToTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? { ...t, type: 'task' as const, startTime: undefined, endTime: undefined }
              : t
          ),
        })),
      addTaskDependency: (taskId, dependsOnTaskId) =>
        set((state) => {
          const task = state.tasks.find(t => t.id === taskId)
          const dependsOnTask = state.tasks.find(t => t.id === dependsOnTaskId)
          
          if (!task || !dependsOnTask) return state
          
          const newDependsOn = [...(task.dependsOn || []), dependsOnTaskId]
          const newBlockedBy = [...(dependsOnTask.blockedBy || []), taskId]
          
          return {
            tasks: state.tasks.map(t => {
              if (t.id === taskId) {
                return { ...t, dependsOn: newDependsOn }
              }
              if (t.id === dependsOnTaskId) {
                return { ...t, blockedBy: newBlockedBy }
              }
              return t
            }),
          }
        }),
      removeTaskDependency: (taskId, dependsOnTaskId) =>
        set((state) => ({
          tasks: state.tasks.map(t => {
            if (t.id === taskId) {
              return { ...t, dependsOn: t.dependsOn?.filter(id => id !== dependsOnTaskId) }
            }
            if (t.id === dependsOnTaskId) {
              return { ...t, blockedBy: t.blockedBy?.filter(id => id !== taskId) }
            }
            return t
          }),
        })),
      getBlockedTasks: (taskId) => {
        const state = get()
        const task = state.tasks.find(t => t.id === taskId)
        if (!task || !task.blockedBy || task.blockedBy.length === 0) return []
        return task.blockedBy
      },
      canCompleteTask: (taskId) => {
        const state = get()
        const task = state.tasks.find(t => t.id === taskId)
        if (!task || !task.dependsOn || task.dependsOn.length === 0) return true
        
        return task.dependsOn.every(depId => {
          const depTask = state.tasks.find(t => t.id === depId)
          return depTask && depTask.status === 'done'
        })
      },
      
      addTaskComment: (taskId, content) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  comments: [
                    ...(t.comments || []),
                    {
                      id: generateId(),
                      content,
                      createdAt: new Date(),
                    },
                  ],
                }
              : t
          ),
        })),
      deleteTaskComment: (taskId, commentId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  comments: t.comments?.filter((c) => c.id !== commentId),
                }
              : t
          ),
        })),
      addTaskReminder: (taskId, reminder) =>
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t
            const reminders = [...(t.reminders || []), { ...reminder, id: generateId() }]
            return { ...t, reminders }
          }),
        })),
      updateTaskReminder: (taskId, reminderId, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t
            const reminders = (t.reminders || []).map((r) =>
              r.id === reminderId ? { ...r, ...updates } : r
            )
            return { ...t, reminders }
          }),
        })),
      removeTaskReminder: (taskId, reminderId) =>
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t
            const reminders = (t.reminders || []).filter((r) => r.id !== reminderId)
            return { ...t, reminders }
          }),
        })),
      markReminderTriggered: (taskId, reminderId) =>
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== taskId) return t
            const reminders = (t.reminders || []).map((r) =>
              r.id === reminderId ? { ...r, triggered: true } : r
            )
            return { ...t, reminders }
          }),
        })),

      timeEntries: defaultTimeEntries,
      activeTimeEntry: null,
      startTimeEntry: (entry) => {
        const id = generateId()
        set({
          activeTimeEntry: {
            ...entry,
            id,
            startTime: new Date(),
            duration: 0,
          },
        })
        return id
      },
      stopTimeEntry: () => {
        const state = get()
        if (state.activeTimeEntry) {
          const endTime = new Date()
          const duration = Math.floor(
            (endTime.getTime() - state.activeTimeEntry.startTime.getTime()) / 1000
          )
          set({
            timeEntries: [
              ...state.timeEntries,
              { ...state.activeTimeEntry, endTime, duration },
            ],
            activeTimeEntry: null,
          })
        }
      },
      addTimeEntry: (entry) => {
        const id = generateId()
        set((state) => ({
          timeEntries: [...state.timeEntries, { ...entry, id }],
        }))
        return id
      },

      pomodoroSessions: defaultPomodoroSessions,
      addPomodoroSession: (session) =>
        set((state) => ({
          pomodoroSessions: [
            ...state.pomodoroSessions,
            { ...session, id: generateId(), completedAt: new Date() },
          ],
        })),
      pomodoroSettings: { ...POMODORO_CONFIG },
      updatePomodoroSettings: (settings) =>
        set((state) => ({
          pomodoroSettings: { ...state.pomodoroSettings, ...settings },
        })),
      
      pomodoroTimerState: {
        mode: 'work',
        timeLeft: POMODORO_CONFIG.workDuration,
        isRunning: false,
        completedSessions: 0,
        selectedTaskId: null,
        treeGrowth: 0,
        lastSessionDate: new Date().toDateString(),
      },
      updatePomodoroTimerState: (updates) =>
        set((state) => {
          const today = new Date().toDateString()
          const currentState = state.pomodoroTimerState

          // 跨天时自动重置每日计数（保留其他字段），但尊重传入的更新值
          if (currentState.lastSessionDate !== today) {
            return {
              pomodoroTimerState: {
                ...currentState,
                ...updates,
                // 跨天后重置每日计数：只有当 updates 显式提供 completedSessions 时才使用，
                // 否则使用 0（避免误判"已完成 1 个"）
                completedSessions: updates.completedSessions !== undefined
                  ? updates.completedSessions
                  : 0,
                treeGrowth: updates.treeGrowth !== undefined ? updates.treeGrowth : 0,
                lastSessionDate: today,
              },
            }
          }

          return {
            pomodoroTimerState: { ...currentState, ...updates },
          }
        }),
      resetPomodoroTimer: () =>
        set((state) => ({
          pomodoroTimerState: {
            mode: 'work',
            timeLeft: state.pomodoroSettings.workDuration,
            isRunning: false,
            completedSessions: 0,
            selectedTaskId: null,
            treeGrowth: 0,
            lastSessionDate: state.pomodoroTimerState.lastSessionDate,
          },
        })),
      checkAndResetDailyPomodoro: () =>
        set((state) => {
          const today = new Date().toDateString()
          if (state.pomodoroTimerState.lastSessionDate !== today) {
            return {
              pomodoroTimerState: {
                ...state.pomodoroTimerState,
                mode: 'work',
                timeLeft: state.pomodoroSettings.workDuration,
                isRunning: false,
                completedSessions: 0,
                selectedTaskId: null,
                treeGrowth: 0,
                lastSessionDate: today,
              },
            }
          }
          return state
        }),

      projects: defaultProjects,
      addProject: (project) => {
        const trimmedName = project.name.trim()
        if (!trimmedName) return null
        const state = get()
        if (state.projects.some(p => p.name === trimmedName)) return null
        const created: Project = { ...project, name: trimmedName, id: generateId(), totalTime: 0 }
        set((s) => ({
          projects: [...s.projects, created],
        }))
        return created
      },
      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        })),

      habits: defaultHabits,
      habitCheckIns: generateHabitCheckIns(defaultHabits).map(c => ({ ...c, id: generateId() })),
      addHabit: (habit) =>
        set((state) => ({
          habits: [
            ...state.habits,
            { ...habit, id: generateId(), createdAt: new Date(), archived: false },
          ],
        })),
      updateHabit: (id, updates) =>
        set((state) => ({
          habits: state.habits.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        })),
      deleteHabit: (id) =>
        set((state) => {
          const habit = state.habits.find((h) => h.id === id)
          if (!habit) return state
          return {
            habits: state.habits.filter((h) => h.id !== id),
            habitCheckIns: state.habitCheckIns.filter((c) => c.habitId !== id),
            trashedItems: [
              { id, type: 'habit' as const, data: habit, deletedAt: new Date() },
              ...state.trashedItems,
            ],
          }
        }),
      checkInHabit: (habitId, date, completed, note, value) =>
        set((state) => {
          const dateStr = new Date(date).toDateString()
          const existingIndex = state.habitCheckIns.findIndex(
            (c) => c.habitId === habitId && new Date(c.date).toDateString() === dateStr
          )
          
          const habit = state.habits.find(h => h.id === habitId)
          let streak = 0
          if (completed && habit) {
            const checkDate = new Date(date)
            while (true) {
              const dStr = checkDate.toDateString()
              const checkIn = state.habitCheckIns.find(
                (c) => c.habitId === habitId && new Date(c.date).toDateString() === dStr
              )
              if (checkIn?.completed || dStr === dateStr) {
                streak++
                checkDate.setDate(checkDate.getDate() - 1)
              } else {
                break
              }
            }
          }

          const achievements = [7, 14, 21, 30, 60, 100]
          const achievement = completed && achievements.includes(streak)
          
          const notification = achievement && habit ? {
            type: 'achievement' as const,
            title: '连续打卡成就',
            message: `恭喜！"${habit.name}" 已连续打卡 ${streak} 天`,
          } : null
          
          if (completed) {
            import('./habit-goal-integration').then(({ HabitGoalIntegration }) => {
              HabitGoalIntegration.updateGoalProgressFromHabit(habitId)
            })
          }

          if (existingIndex >= 0) {
            const newCheckIns = [...state.habitCheckIns]
            newCheckIns[existingIndex] = {
              ...newCheckIns[existingIndex],
              completed,
              note,
              value: value ?? newCheckIns[existingIndex].value,
            }
            return { 
              habitCheckIns: newCheckIns,
              notifications: notification ? [
                {
                  ...notification,
                  id: generateId(),
                  timestamp: new Date(),
                  read: false,
                },
                ...state.notifications,
              ].slice(0, 50) : state.notifications,
            }
          }
          return {
            habitCheckIns: [
              ...state.habitCheckIns,
              { id: generateId(), habitId, date, completed, note, value },
            ],
            notifications: notification ? [
              {
                ...notification,
                id: generateId(),
                timestamp: new Date(),
                read: false,
              },
              ...state.notifications,
            ].slice(0, 50) : state.notifications,
          }
        }),
      useStreakFreeze: (habitId) =>
        set((state) => {
          const habit = state.habits.find(h => h.id === habitId)
          if (!habit) return state
          const maxFreezes = habit.maxStreakFreezes || 3
          const currentFreezes = habit.streakFreezes || 0
          if (currentFreezes >= maxFreezes) return state

          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = yesterday.toDateString()
          const yesterdayCheckIn = state.habitCheckIns.find(
            c => c.habitId === habitId && new Date(c.date).toDateString() === yesterdayStr
          )
          if (yesterdayCheckIn?.completed) return state

          return {
            habits: state.habits.map(h =>
              h.id === habitId ? { ...h, streakFreezes: (h.streakFreezes || 0) + 1 } : h
            ),
            habitCheckIns: [
              ...state.habitCheckIns,
              { id: generateId(), habitId, date: yesterday, completed: true, note: '🧊 连续冻结保护' },
            ],
            notifications: [
              {
                id: generateId(),
                type: 'achievement' as const,
                title: '🧊 连续冻结',
                message: `"${habit.name}" 使用了连续冻结保护，连续天数不会被重置（${currentFreezes + 1}/${maxFreezes}）`,
                timestamp: new Date(),
                read: false,
              },
              ...state.notifications,
            ].slice(0, 50),
          }
        }),

      anniversaries: defaultAnniversaries,
      addAnniversary: (anniversary) =>
        set((state) => ({
          anniversaries: [
            ...state.anniversaries,
            { ...anniversary, id: generateId(), createdAt: new Date() },
          ],
        })),
      updateAnniversary: (id, updates) =>
        set((state) => ({
          anniversaries: state.anniversaries.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),
      deleteAnniversary: (id) =>
        set((state) => {
          const anniversary = state.anniversaries.find((a) => a.id === id)
          if (!anniversary) return state
          return {
            anniversaries: state.anniversaries.filter((a) => a.id !== id),
            trashedItems: [
              { id, type: 'anniversary' as const, data: anniversary, deletedAt: new Date() },
              ...state.trashedItems,
            ],
          }
        }),

      notifications: [],
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            {
              ...notification,
              id: generateId(),
              timestamp: new Date(),
              read: false,
            },
            ...state.notifications,
          ].slice(0, 50),
        })),
      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
      clearNotifications: () => set({ notifications: [] }),

      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      activeView: 'dashboard',
      setActiveView: (view) => set({ activeView: view }),
      
      activeSmartList: null,
      setActiveSmartList: (listId) => set({ activeSmartList: listId }),
      
      isFullscreen: false,
      setIsFullscreen: (isFullscreen) => set({ isFullscreen }),

      goals: [],
      addGoal: (goal) =>
        set((state) => ({
          goals: [
            ...state.goals,
            { ...goal, id: generateId(), createdAt: new Date() },
          ],
        })),
      updateGoal: (id, updates) =>
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        })),
      deleteGoal: (id) =>
        set((state) => {
          const goal = state.goals.find((g) => g.id === id)
          if (!goal) return state
          return {
            goals: state.goals.filter((g) => g.id !== id),
            trashedItems: [
              { id, type: 'goal' as const, data: goal, deletedAt: new Date() },
              ...state.trashedItems,
            ],
          }
        }),
      addMilestone: (goalId, milestone) =>
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId
              ? { ...g, milestones: [...g.milestones, { ...milestone, id: generateId() }] }
              : g
          ),
        })),
      toggleMilestone: (goalId, milestoneId) =>
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  milestones: g.milestones.map((m) =>
                    m.id === milestoneId
                      ? { ...m, completed: !m.completed, completedAt: !m.completed ? new Date() : undefined }
                      : m
                  ),
                }
              : g
          ),
        })),
      deleteMilestone: (goalId, milestoneId) =>
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === goalId
              ? { ...g, milestones: g.milestones.filter((m) => m.id !== milestoneId) }
              : g
          ),
        })),
      reorderMilestones: (goalId, milestoneIds) =>
        set((state) => ({
          goals: state.goals.map((g) => {
            if (g.id !== goalId) return g
            const milestoneMap = new Map(g.milestones.map((m) => [m.id, m]))
            const reordered = milestoneIds
              .map((id) => milestoneMap.get(id))
              .filter((m): m is Milestone => m !== undefined)
            return { ...g, milestones: reordered }
          }),
        })),

      achievements: [],
      userLevel: { level: 1, totalPoints: 0, currentLevelPoints: 0, nextLevelPoints: 100, title: '新手' },
      checkAchievements: () => {
        const state = get()
        const newAchievements = [...state.achievements]
        let pointsToAdd = 0

        const totalPomodoros = state.pomodoroSessions.filter(s => s.type === 'work').length
        const totalTasks = state.tasks.filter(t => t.status === 'done').length
        const streak = state.pomodoroSessions.filter(s => s.type === 'work').length > 0 ? 1 : 0

        const achievementChecks = [
          { id: 'first-pomodoro', name: '初次专注', description: '完成第一个番茄钟', points: 10, earned: totalPomodoros >= 1 },
          { id: 'pomodoro-10', name: '专注新手', description: '完成10个番茄钟', points: 30, earned: totalPomodoros >= 10 },
          { id: 'pomodoro-50', name: '专注达人', description: '完成50个番茄钟', points: 100, earned: totalPomodoros >= 50 },
          { id: 'first-task', name: '任务起步', description: '完成第一个任务', points: 10, earned: totalTasks >= 1 },
          { id: 'tasks-10', name: '任务高手', description: '完成10个任务', points: 50, earned: totalTasks >= 10 },
          { id: 'streak-7', name: '周冠军', description: '连续7天专注', points: 100, earned: streak >= 7 },
        ]

        achievementChecks.forEach(check => {
          const existing = newAchievements.find(a => a.id === check.id)
          if (!existing && check.earned) {
            newAchievements.push({
              id: check.id,
              name: check.name,
              description: check.description,
              icon: '🏆',
              category: 'focus',
              requirement: { type: 'count', value: 1, metric: 'pomodoros' },
              earned: true,
              earnedAt: new Date(),
              progress: 100,
              tier: 'bronze',
              points: check.points,
            })
            pointsToAdd += check.points
          }
        })

        set({ achievements: newAchievements })
        if (pointsToAdd > 0) {
          get().addPoints(pointsToAdd)
        }
      },
      addPoints: (points) =>
        set((state) => {
          const newTotalPoints = state.userLevel.totalPoints + points
          const levelThresholds = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000]
          const titles = ['新手', '入门', '熟练', '精通', '专家', '大师', '宗师', '传奇', '神话', '至尊']
          
          let newLevel = 1
          for (let i = levelThresholds.length - 1; i >= 0; i--) {
            if (newTotalPoints >= levelThresholds[i]) {
              newLevel = i + 1
              break
            }
          }

          const currentLevelPoints = newTotalPoints - levelThresholds[newLevel - 1]
          const nextLevelPoints = levelThresholds[newLevel] - levelThresholds[newLevel - 1]

          return {
            userLevel: {
              level: newLevel,
              totalPoints: newTotalPoints,
              currentLevelPoints,
              nextLevelPoints,
              title: titles[newLevel - 1] || '至尊',
            },
          }
        }),

      tags: [],
      addTag: (tag) =>
        set((state) => ({
          tags: [
            ...state.tags,
            { ...tag, id: generateId(), createdAt: new Date(), usageCount: 0 },
          ],
        })),
      updateTag: (id, updates) =>
        set((state) => ({
          tags: state.tags.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),
      deleteTag: (id) =>
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== id),
        })),

      reminders: [],
      addReminder: (reminder) =>
        set((state) => ({
          reminders: [
            ...state.reminders,
            { ...reminder, id: generateId(), createdAt: new Date() },
          ],
        })),
      updateReminder: (id, updates) =>
        set((state) => ({
          reminders: state.reminders.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
      deleteReminder: (id) =>
        set((state) => ({
          reminders: state.reminders.filter((r) => r.id !== id),
        })),

      timeBlocks: [],
      addTimeBlock: (block) =>
        set((state) => ({
          timeBlocks: [
            ...state.timeBlocks,
            { ...block, id: generateId(), createdAt: new Date() },
          ],
        })),
      updateTimeBlock: (id, updates) =>
        set((state) => ({
          timeBlocks: state.timeBlocks.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        })),
      deleteTimeBlock: (id) =>
        set((state) => ({
          timeBlocks: state.timeBlocks.filter((b) => b.id !== id),
        })),
      getTimeBlocksForDate: (date) => {
        const state = get()
        const dateStr = date.toDateString()
        return state.timeBlocks.filter(b => new Date(b.date).toDateString() === dateStr)
      },

      focusGoals: { dailyMinutes: 120, weeklyMinutes: 600, dailyPomodoros: 8 },
      updateFocusGoals: (goals) =>
        set((state) => ({
          focusGoals: { ...state.focusGoals, ...goals },
        })),

      distractions: [],
      addDistraction: (distraction) =>
        set((state) => ({
          distractions: [
            ...state.distractions,
            { ...distraction, id: generateId() },
          ],
        })),
      deleteDistraction: (id) =>
        set((state) => ({
          distractions: state.distractions.filter((d) => d.id !== id),
        })),
      getDistractionsForDate: (date) => {
        const state = get()
        const dateStr = date.toDateString()
        return state.distractions.filter(d => new Date(d.timestamp).toDateString() === dateStr)
      },
      getDistractionCount: (taskId) => {
        const state = get()
        if (taskId) return state.distractions.filter(d => d.taskId === taskId).length
        return state.distractions.length
      },

      journals: [],
      addJournal: (journal) =>
        set((state) => {
          const dateStr = new Date(journal.date).toDateString()
          const existing = state.journals.find(j => new Date(j.date).toDateString() === dateStr)
          if (existing) {
            return {
              journals: state.journals.map(j =>
                j.id === existing.id
                  ? { ...j, ...journal, updatedAt: new Date() }
                  : j
              ),
            }
          }
          return {
            journals: [
              ...state.journals,
              { ...journal, id: generateId(), createdAt: new Date(), updatedAt: new Date() },
            ],
          }
        }),
      updateJournal: (id, updates) =>
        set((state) => ({
          journals: state.journals.map((j) =>
            j.id === id ? { ...j, ...updates, updatedAt: new Date() } : j
          ),
        })),
      deleteJournal: (id) =>
        set((state) => ({
          journals: state.journals.filter((j) => j.id !== id),
        })),
      getJournalForDate: (date) => {
        const state = get()
        const dateStr = date.toDateString()
        return state.journals.find(j => new Date(j.date).toDateString() === dateStr)
      },

      taskTemplates: [],
      addTaskTemplate: (template) =>
        set((state) => ({
          taskTemplates: [
            ...state.taskTemplates,
            { ...template, id: generateId(), createdAt: new Date(), usageCount: 0 },
          ],
        })),
      deleteTaskTemplate: (id) =>
        set((state) => ({
          taskTemplates: state.taskTemplates.filter((t) => t.id !== id),
        })),
      applyTaskTemplate: (templateId) => {
        const state = get()
        const template = state.taskTemplates.find(t => t.id === templateId)
        if (!template) return
        const newTasks = template.tasks.map(t => ({
          ...t,
          id: generateId(),
          createdAt: new Date(),
          completedPomodoros: 0,
          completedAt: undefined,
          status: 'todo' as const,
        }))
        set((s) => ({
          tasks: [...s.tasks, ...newTasks],
          taskTemplates: s.taskTemplates.map(t =>
            t.id === templateId ? { ...t, usageCount: t.usageCount + 1 } : t
          ),
        }))
      },

      pomodoroStrictMode: {
        enabled: false,
        autoStartNext: false,
        skipBreaks: false,
        maxSessionsPerDay: 12,
        lockUntilSessionEnd: false,
      },
      updatePomodoroStrictMode: (updates) =>
        set((state) => ({
          pomodoroStrictMode: { ...state.pomodoroStrictMode, ...updates },
        })),

      dashboardWidgets: ['greeting', 'focus-goal', 'today-tasks', 'quick-add', 'streak', 'weekly-chart'],
      updateDashboardWidgets: (widgets) => set({ dashboardWidgets: widgets }),

      darkModeSchedule: { enabled: false, lightStart: '07:00', darkStart: '19:00' },
      updateDarkModeSchedule: (updates) =>
        set((state) => ({
          darkModeSchedule: { ...state.darkModeSchedule, ...updates },
        })),

      workingHours: { enabled: false, workStartTime: '09:00', workEndTime: '18:00', workDays: [1, 2, 3, 4, 5] },
      updateWorkingHours: (updates) =>
        set((state) => ({
          workingHours: { ...state.workingHours, ...updates },
        })),

      focusSoundSettings: {
        isPlaying: false,
        volume: 50,
        currentSound: null,
        currentMusic: null,
        autoPlay: false,
      },
      updateFocusSoundSettings: (updates) =>
        set((state) => ({
          focusSoundSettings: { ...state.focusSoundSettings, ...updates },
        })),

      dailyReviewSettings: {
        enabled: true,
        reviewTime: '21:00',
        lastReviewDate: null,
        showNotification: true,
      },
      updateDailyReviewSettings: (updates) =>
        set((state) => ({
          dailyReviewSettings: { ...state.dailyReviewSettings, ...updates },
        })),
      markDailyReviewShown: (dateKey) =>
        set((state) => ({
          dailyReviewSettings: {
            ...state.dailyReviewSettings,
            lastReviewDate: dateKey,
          },
        })),

      repeatCompletions: [],
      addRepeatCompletion: (completion) =>
        set((state) => ({
          repeatCompletions: [...state.repeatCompletions, { ...completion, id: generateId() }],
        })),
      deleteRepeatCompletion: (id) =>
        set((state) => ({
          repeatCompletions: state.repeatCompletions.filter((c) => c.id !== id),
        })),
      getRepeatCompletionsForTask: (taskId) => {
        const state = get()
        return state.repeatCompletions.filter((c) => c.taskId === taskId)
      },
      getRepeatCompletionsForDate: (date) => {
        const state = get()
        const dateStr = date.toDateString()
        return state.repeatCompletions.filter((c) => new Date(c.completedAt).toDateString() === dateStr)
      },

      taskOrder: [],
      updateTaskOrder: (order) => set({ taskOrder: order }),
      rescheduleTask: (taskId, newDate) =>
        set((state) => ({
          tasks: state.tasks.map(t =>
            t.id === taskId ? { ...t, dueDate: newDate } : t
          ),
        })),
      rescheduleOverdueTasks: (taskIds, newDate) =>
        set((state) => ({
          tasks: state.tasks.map(t =>
            taskIds.includes(t.id) ? { ...t, dueDate: newDate } : t
          ),
        })),

      trashedItems: [],
      moveToTrash: (id, type, data) =>
        set((state) => ({
          trashedItems: [
            { id, type, data, deletedAt: new Date() },
            ...state.trashedItems,
          ],
        })),
      restoreFromTrash: (id) =>
        set((state) => {
          const item = state.trashedItems.find((t) => t.id === id)
          if (!item) return state

          const newTrashedItems = state.trashedItems.filter((t) => t.id !== id)
          const restoredData = item.data as Record<string, unknown>

          switch (item.type) {
            case 'task':
              return {
                trashedItems: newTrashedItems,
                tasks: [...state.tasks, restoredData as unknown as Task],
              }
            case 'habit':
              return {
                trashedItems: newTrashedItems,
                habits: [...state.habits, restoredData as unknown as Habit],
              }
            case 'goal':
              return {
                trashedItems: newTrashedItems,
                goals: [...state.goals, restoredData as unknown as Goal],
              }
            case 'anniversary':
              return {
                trashedItems: newTrashedItems,
                anniversaries: [...state.anniversaries, restoredData as unknown as Anniversary],
              }
            default:
              return { trashedItems: newTrashedItems }
          }
        }),
      emptyTrash: () => set({ trashedItems: [] }),
      undoLastDelete: () =>
        set((state) => {
          if (state.trashedItems.length === 0) return state
          const lastItem = state.trashedItems[0]
          const newTrashedItems = state.trashedItems.slice(1)
          const restoredData = lastItem.data as Record<string, unknown>
          switch (lastItem.type) {
            case 'task':
              return { trashedItems: newTrashedItems, tasks: [...state.tasks, restoredData as unknown as Task] }
            case 'habit':
              return { trashedItems: newTrashedItems, habits: [...state.habits, restoredData as unknown as Habit] }
            case 'goal':
              return { trashedItems: newTrashedItems, goals: [...state.goals, restoredData as unknown as Goal] }
            case 'anniversary':
              return { trashedItems: newTrashedItems, anniversaries: [...state.anniversaries, restoredData as unknown as Anniversary] }
            default:
              return { trashedItems: newTrashedItems }
          }
        }),
      clearExpiredTrash: () =>
        set((state) => {
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          return {
            trashedItems: state.trashedItems.filter(
              (t) => new Date(t.deletedAt) > thirtyDaysAgo
            ),
          }
        }),

      clearOldSessions: () =>
        set((state) => {
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          return {
            pomodoroSessions: state.pomodoroSessions.filter(
              (s) => new Date(s.completedAt) > thirtyDaysAgo
            ),
          }
        }),

      clearOldTimeEntries: () =>
        set((state) => {
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          return {
            timeEntries: state.timeEntries.filter(
              (e) => new Date(e.startTime) > thirtyDaysAgo
            ),
          }
        }),

      clearOldHabitCheckIns: () =>
        set((state) => {
          const ninetyDaysAgo = new Date()
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
          return {
            habitCheckIns: state.habitCheckIns.filter(
              (c) => new Date(c.date) > ninetyDaysAgo
            ),
          }
        }),

      clearOldRepeatCompletions: () =>
        set((state) => {
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          return {
            repeatCompletions: state.repeatCompletions.filter(
              (c) => new Date(c.completedAt) > thirtyDaysAgo
            ),
          }
        }),

      clearOldNotifications: () =>
        set((state) => {
          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
          return {
            notifications: state.notifications.filter(
              (n) => new Date(n.timestamp) > sevenDaysAgo
            ),
          }
        }),

      clearAllOldData: () =>
        set((state) => {
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          const ninetyDaysAgo = new Date()
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

          return {
            pomodoroSessions: state.pomodoroSessions.filter(
              (s) => new Date(s.completedAt) > thirtyDaysAgo
            ),
            timeEntries: state.timeEntries.filter(
              (e) => new Date(e.startTime) > thirtyDaysAgo
            ),
            habitCheckIns: state.habitCheckIns.filter(
              (c) => new Date(c.date) > ninetyDaysAgo
            ),
            repeatCompletions: state.repeatCompletions.filter(
              (c) => new Date(c.completedAt) > thirtyDaysAgo
            ),
            notifications: state.notifications.filter(
              (n) => new Date(n.timestamp) > sevenDaysAgo
            ),
            trashedItems: state.trashedItems.filter(
              (t) => new Date(t.deletedAt) > thirtyDaysAgo
            ),
          }
        }),

      refreshRepeatTasksStatus: () =>
        set((state) => {
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          const updatedTasks = state.tasks.map((t) => {
            if (!t.repeatRule) return t
            if (t.status !== 'done') return t
            if (t.repeatRule.paused) return t
            if (!t.dueDate) return { ...t, status: 'todo' as const, completedAt: undefined, completedPomodoros: 0 }

            const dueDate = new Date(t.dueDate)
            dueDate.setHours(0, 0, 0, 0)
            if (dueDate <= today) {
              return { ...t, status: 'todo' as const, completedAt: undefined, completedPomodoros: 0 }
            }
            return t
          })

          return { tasks: updatedTasks }
        }),

      focusPresets: [
        {
          id: 'preset-deep-work',
          name: '深度工作',
          icon: '🧠',
          workDuration: 50 * 60,
          shortBreakDuration: 10 * 60,
          longBreakDuration: 30 * 60,
          sessionsBeforeLongBreak: 3,
          autoStartBreak: false,
          autoStartWork: false,
          soundEnabled: true,
          color: '#4A90E2',
          createdAt: new Date(),
        },
        {
          id: 'preset-quick-focus',
          name: '快速专注',
          icon: '⚡',
          workDuration: 25 * 60,
          shortBreakDuration: 5 * 60,
          longBreakDuration: 15 * 60,
          sessionsBeforeLongBreak: 4,
          autoStartBreak: true,
          autoStartWork: false,
          soundEnabled: true,
          color: '#7ED321',
          createdAt: new Date(),
        },
        {
          id: 'preset-marathon',
          name: '马拉松模式',
          icon: '🏃',
          workDuration: 60 * 60,
          shortBreakDuration: 15 * 60,
          longBreakDuration: 30 * 60,
          sessionsBeforeLongBreak: 2,
          autoStartBreak: false,
          autoStartWork: false,
          soundEnabled: true,
          color: '#F5A623',
          createdAt: new Date(),
        },
      ],
      addFocusPreset: (preset) =>
        set((state) => ({
          focusPresets: [
            ...state.focusPresets,
            { ...preset, id: generateId(), createdAt: new Date() },
          ],
        })),
      updateFocusPreset: (id, updates) =>
        set((state) => ({
          focusPresets: state.focusPresets.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      deleteFocusPreset: (id) =>
        set((state) => ({
          focusPresets: state.focusPresets.filter((p) => p.id !== id),
        })),
      applyFocusPreset: (id) =>
        set((state) => {
          const preset = state.focusPresets.find((p) => p.id === id)
          if (!preset) return state
          return {
            pomodoroSettings: {
              workDuration: preset.workDuration,
              shortBreakDuration: preset.shortBreakDuration,
              longBreakDuration: preset.longBreakDuration,
              sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
            },
            pomodoroTimerState: {
              ...state.pomodoroTimerState,
              mode: 'work',
              timeLeft: preset.workDuration,
              isRunning: false,
            },
          }
        }),

      savedFilters: [],
      addSavedFilter: (name, criteria) =>
        set((state) => {
          const trimmed = name.trim() || '未命名筛选'
          const newFilter: SavedFilter = {
            id: generateId(),
            name: trimmed,
            criteria: { ...criteria },
            createdAt: new Date(),
          }
          return {
            savedFilters: [...state.savedFilters, newFilter],
            activeSavedFilterId: newFilter.id,
          }
        }),
      renameSavedFilter: (id, name) =>
        set((state) => ({
          savedFilters: state.savedFilters.map((f) =>
            f.id === id ? { ...f, name: name.trim() || f.name } : f
          ),
        })),
      deleteSavedFilter: (id) =>
        set((state) => ({
          savedFilters: state.savedFilters.filter((f) => f.id !== id),
          activeSavedFilterId: state.activeSavedFilterId === id ? null : state.activeSavedFilterId,
        })),
      reorderSavedFilters: (orderedIds) =>
        set((state) => {
          const map = new Map(state.savedFilters.map((f) => [f.id, f]))
          const reordered = orderedIds
            .map((id) => map.get(id))
            .filter((f): f is SavedFilter => f !== undefined)
          const remaining = state.savedFilters.filter((f) => !orderedIds.includes(f.id))
          return { savedFilters: [...reordered, ...remaining] }
        }),

      activeSavedFilterId: null,
      setActiveSavedFilterId: (id) => set({ activeSavedFilterId: id }),
    })),
    {
      name: 'productivity-app-storage',
      version: 8,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          return {
            tasks: [],
            timeEntries: [],
            pomodoroSessions: [],
            pomodoroSettings: POMODORO_CONFIG,
            projects: [],
            habits: [],
            habitCheckIns: [],
            anniversaries: [],
            sidebarCollapsed: false,
          }
        }
        
        if (version < 3) {
          const state = persistedState as any
          if (state.pomodoroTimerState && !state.pomodoroTimerState.lastSessionDate) {
            state.pomodoroTimerState.lastSessionDate = new Date().toDateString()
          }
          return state
        }
        
        if (version < 4) {
          const state = persistedState as any
          state.repeatCompletions = []
          return state
        }

        if (version < 5) {
          const state = persistedState as any
          state.distractions = []
          state.journals = []
          state.taskTemplates = []
          state.pomodoroStrictMode = {
            enabled: false,
            autoStartNext: false,
            skipBreaks: false,
            maxSessionsPerDay: 12,
            lockUntilSessionEnd: false,
          }
          state.dashboardWidgets = ['greeting', 'focus-goal', 'today-tasks', 'quick-add', 'streak', 'weekly-chart']
          state.darkModeSchedule = { enabled: false, lightStart: '07:00', darkStart: '19:00' }
          state.workingHours = { enabled: false, workStartTime: '09:00', workEndTime: '18:00', workDays: [1, 2, 3, 4, 5] }
          return state
        }

        if (version < 6) {
          const state = persistedState as any
          if (state.habits) {
            state.habits = state.habits.map((h: any) => ({
              ...h,
              trackingType: h.trackingType || 'boolean',
              targetValue: h.targetValue || undefined,
              unit: h.unit || undefined,
              streakFreezes: h.streakFreezes || 0,
              maxStreakFreezes: h.maxStreakFreezes || 3,
            }))
          }
          if (state.habitCheckIns) {
            state.habitCheckIns = state.habitCheckIns.map((c: any) => ({
              ...c,
              value: c.value || undefined,
            }))
          }
          state.focusPresets = [
            {
              id: 'preset-deep-work',
              name: '深度工作',
              icon: '🧠',
              workDuration: 50 * 60,
              shortBreakDuration: 10 * 60,
              longBreakDuration: 30 * 60,
              sessionsBeforeLongBreak: 3,
              autoStartBreak: false,
              autoStartWork: false,
              soundEnabled: true,
              color: '#4A90E2',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'preset-quick-focus',
              name: '快速专注',
              icon: '⚡',
              workDuration: 25 * 60,
              shortBreakDuration: 5 * 60,
              longBreakDuration: 15 * 60,
              sessionsBeforeLongBreak: 4,
              autoStartBreak: true,
              autoStartWork: false,
              soundEnabled: true,
              color: '#7ED321',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'preset-marathon',
              name: '马拉松模式',
              icon: '🏃',
              workDuration: 60 * 60,
              shortBreakDuration: 15 * 60,
              longBreakDuration: 30 * 60,
              sessionsBeforeLongBreak: 2,
              autoStartBreak: false,
              autoStartWork: false,
              soundEnabled: true,
              color: '#F5A623',
              createdAt: new Date().toISOString(),
            },
          ]
          return state
        }

        if (version < 7) {
          const state = persistedState as any
          if (Array.isArray(state.projects) && Array.isArray(state.timeEntries)) {
            const projectByName = new Map(
              state.projects.map((p: any) => [p.name, p.id])
            )
            state.timeEntries = state.timeEntries.map((e: any) => {
              if (e.projectId) return e
              const projectId = e.project ? projectByName.get(e.project) : undefined
              return { ...e, projectId: projectId ?? '' }
            })
          }
          // 将旧的 reminder/reminderTime 转换为 reminders 数组
          if (Array.isArray(state.tasks)) {
            state.tasks = state.tasks.map((t: any) => {
              if (t.reminders !== undefined) return t
              const reminders: TaskReminder[] = []
              if (t.reminder && t.reminderTime) {
                reminders.push({
                  id: generateId(),
                  type: 'absolute',
                  triggerAt: new Date(t.reminderTime),
                  enabled: true,
                  triggered: false,
                })
              } else if (t.reminder) {
                reminders.push({
                  id: generateId(),
                  type: 'on-due',
                  enabled: true,
                  triggered: false,
                })
              }
              const { reminder, reminderTime, ...rest } = t
              return { ...rest, reminders }
            })
          }
          // 初始化 savedFilters
          if (!Array.isArray(state.savedFilters)) {
            state.savedFilters = []
          }
          if (state.activeSavedFilterId === undefined) {
            state.activeSavedFilterId = null
          }
          return state
        }

        if (version < 8) {
          const state = persistedState as any
          // 升级 focusGoals：旧版只有 dailyMinutes/weeklyMinutes
          if (state.focusGoals && typeof state.focusGoals.dailyPomodoros !== 'number') {
            state.focusGoals = {
              dailyMinutes: state.focusGoals.dailyMinutes ?? 120,
              weeklyMinutes: state.focusGoals.weeklyMinutes ?? 600,
              dailyPomodoros: state.focusGoals.dailyPomodoros ?? 8,
            }
          }
          // 给任务加 timeSpent 字段（默认 0）
          if (Array.isArray(state.tasks)) {
            state.tasks = state.tasks.map((t: any) => ({
              ...t,
              timeSpent: typeof t.timeSpent === 'number' ? t.timeSpent : 0,
            }))
          }
          return state
        }

        return persistedState
      },
      partialize: (state) => ({
        tasks: state.tasks,
        timeEntries: state.timeEntries,
        pomodoroSessions: state.pomodoroSessions,
        pomodoroSettings: state.pomodoroSettings,
        pomodoroTimerState: state.pomodoroTimerState,
        projects: state.projects,
        habits: state.habits,
        habitCheckIns: state.habitCheckIns,
        anniversaries: state.anniversaries,
        notifications: state.notifications,
        sidebarCollapsed: state.sidebarCollapsed,
        activeSmartList: state.activeSmartList,
        goals: state.goals,
        achievements: state.achievements,
        userLevel: state.userLevel,
        tags: state.tags,
        reminders: state.reminders,
        focusGoals: state.focusGoals,
        repeatCompletions: state.repeatCompletions,
        trashedItems: state.trashedItems,
        taskOrder: state.taskOrder,
        timeBlocks: state.timeBlocks,
        distractions: state.distractions,
        journals: state.journals,
        taskTemplates: state.taskTemplates,
        pomodoroStrictMode: state.pomodoroStrictMode,
        dashboardWidgets: state.dashboardWidgets,
        darkModeSchedule: state.darkModeSchedule,
        workingHours: state.workingHours,
        focusSoundSettings: state.focusSoundSettings,
        focusPresets: state.focusPresets,
        dailyReviewSettings: state.dailyReviewSettings,
        savedFilters: state.savedFilters,
        activeSavedFilterId: state.activeSavedFilterId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          setSyncDataCallback((cloudData) => {
            const store = useAppStore.getState()
            const keys = Object.keys(cloudData) as Array<keyof typeof store>
            keys.forEach((key) => {
              if (key in store && typeof (store as any)[key] !== 'function') {
                (useAppStore.setState as any)({ [key]: cloudData[key] })
              }
            })
          })
          setSyncDataProvider(() => {
            const store = useAppStore.getState()
            return {
              tasks: store.tasks,
              timeEntries: store.timeEntries,
              pomodoroSessions: store.pomodoroSessions,
              pomodoroSettings: store.pomodoroSettings,
              pomodoroTimerState: store.pomodoroTimerState,
              projects: store.projects,
              habits: store.habits,
              habitCheckIns: store.habitCheckIns,
              anniversaries: store.anniversaries,
              notifications: store.notifications,
              sidebarCollapsed: store.sidebarCollapsed,
              activeSmartList: store.activeSmartList,
              goals: store.goals,
              achievements: store.achievements,
              userLevel: store.userLevel,
              tags: store.tags,
              reminders: store.reminders,
              focusGoals: store.focusGoals,
              repeatCompletions: store.repeatCompletions,
              trashedItems: store.trashedItems,
              taskOrder: store.taskOrder,
              timeBlocks: store.timeBlocks,
              distractions: store.distractions,
              journals: store.journals,
              taskTemplates: store.taskTemplates,
              pomodoroStrictMode: store.pomodoroStrictMode,
              dashboardWidgets: store.dashboardWidgets,
              darkModeSchedule: store.darkModeSchedule,
              workingHours: store.workingHours,
              focusSoundSettings: store.focusSoundSettings,
              focusPresets: store.focusPresets,
              dailyReviewSettings: store.dailyReviewSettings,
              savedFilters: store.savedFilters,
              activeSavedFilterId: store.activeSavedFilterId,
            }
          })
        }
      },
    }
  )
)
