import type { Task, SubTask, TaskReminder, RepeatTaskCompletion, Notification } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId, defaultTasks } from '../utils'
import { clearNotifiedKeysWithPrefix } from '@/lib/notified-registry'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

/** 移除某任务在通知中心的所有关联通知（删除/完成任务时级联清理） */
function removeTaskNotifications(notifications: Notification[], taskId: string): Notification[] {
  return notifications.filter(
    (n) => !(n.relatedType === 'task' && n.relatedId === taskId)
  )
}

/** 完成任务后的联动：积分、成就、目标进度、项目时长（动态加载避免循环依赖，状态更新后再执行） */
function triggerTaskCompletionEffects(taskId: string): void {
  void import('@/lib/data-link-service').then(({ dataLinkService }) => {
    dataLinkService.handleTaskCompletion(taskId)
  })
}

export const createTaskSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  tasks: defaultTasks,
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completedPomodoros'>) => {
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
  },
  updateTask: (id: string, updates: Partial<Task>) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
  deleteTask: (id: string) =>
    set((state) => {
      const task = state.tasks.find((t) => t.id === id)
      if (!task) return state
      clearNotifiedKeysWithPrefix(`task-${id}`)
      return {
        tasks: state.tasks
          .filter((t) => t.id !== id)
          .map((t) => ({
            ...t,
            dependsOn: t.dependsOn?.filter((depId) => depId !== id),
            blockedBy: t.blockedBy?.filter((bId) => bId !== id),
          })),
        notifications: removeTaskNotifications(state.notifications, id),
        reminders: state.reminders.filter(
          (r) => !(r.type === 'task' && r.referenceId === id)
        ),
        trashedItems: [
          { id, type: 'task' as const, data: task, deletedAt: new Date() },
          ...state.trashedItems,
        ],
      }
    }),
  toggleTaskStar: (id: string) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, starred: !t.starred } : t
      ),
    })),
  archiveTask: (id: string) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, archived: true } : t
      ),
    })),
  unarchiveTask: (id: string) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, archived: false } : t
      ),
    })),
  completeTask: (id: string) => {
    const state = get()
    const task = state.tasks.find((t) => t.id === id)
    if (!task || task.status === 'done') return

    if (task.dependsOn && task.dependsOn.length > 0) {
      const allDependenciesCompleted = task.dependsOn.every(depId => {
        const depTask = state.tasks.find(t => t.id === depId)
        return depTask && depTask.status === 'done'
      })
      if (!allDependenciesCompleted) {
        set((state) => ({
          notifications: [
            {
              id: generateId(),
              type: 'task-due' as const,
              title: '无法完成任务',
              message: `"${task.title}" 有未完成的前置任务`,
              relatedType: 'task' as const,
              relatedId: id,
              timestamp: new Date(),
              read: false,
            },
            ...state.notifications,
          ].slice(0, 50),
        }))
        return
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
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'done' as const,
                  completedAt: new Date(),
                  repeatRule: {
                    ...t.repeatRule!,
                    completedCount: currentCompletedCount,
                  },
                }
              : t
          ),
          repeatCompletions: [...state.repeatCompletions, completion],
          notifications: [
            {
              id: generateId(),
              type: 'task-due' as const,
              title: '重复任务已完成',
              message: `"${task.title}" 已完成所有重复周期`,
              relatedType: 'task' as const,
              relatedId: id,
              timestamp: new Date(),
              read: false,
            },
            ...removeTaskNotifications(state.notifications, id),
          ].slice(0, 50),
        }))
        triggerTaskCompletionEffects(id)
        return
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

      set((state) => ({
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
                  completedCount: currentCompletedCount,
                },
              }
            : t
        ),
        repeatCompletions: [...state.repeatCompletions, completion],
        notifications: [
          {
            id: generateId(),
            type: 'task-due' as const,
            title: '任务完成',
            message: `"${task.title}" 已完成，下一个周期: ${newDueDate.toLocaleDateString('zh-CN')}`,
            relatedType: 'task' as const,
            relatedId: id,
            timestamp: new Date(),
            read: false,
          },
          ...removeTaskNotifications(state.notifications, id),
        ].slice(0, 50),
      }))
      triggerTaskCompletionEffects(id)
      return
    }

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? { ...t, status: 'done' as const, completedAt: new Date() }
          : t
      ),
      notifications: [
        {
          id: generateId(),
          type: 'task-due' as const,
          title: '任务完成',
          message: `"${task.title}" 已完成`,
          relatedType: 'task' as const,
          relatedId: id,
          timestamp: new Date(),
          read: false,
        },
        ...removeTaskNotifications(state.notifications, id),
      ].slice(0, 50),
    }))
    triggerTaskCompletionEffects(id)
  },
  uncompleteTask: (id: string) =>
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
  skipRepeatTask: (id: string) =>
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
  pauseRepeatTask: (id: string) =>
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
  resumeRepeatTask: (id: string) =>
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

        const hasReachedEndDate = t.repeatRule.endDate && new Date() > new Date(t.repeatRule.endDate)
        const hasReachedCount = t.repeatRule.endAfterCount &&
          (t.repeatRule.completedCount || 0) >= t.repeatRule.endAfterCount
        if (hasReachedEndDate || hasReachedCount) return t

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
  batchCompleteTasks: (ids: string[]) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        ids.includes(t.id)
          ? { ...t, status: 'done' as const, completedAt: new Date() }
          : t
      ),
    }))
    ids.forEach((id) => triggerTaskCompletionEffects(id))
  },
  batchDeleteTasks: (ids: string[]) =>
    set((state) => {
      const idSet = new Set(ids)
      for (const id of ids) {
        clearNotifiedKeysWithPrefix(`task-${id}`)
      }
      const trashedTasks = state.tasks.filter((t) => idSet.has(t.id))
      return {
        tasks: state.tasks
          .filter((t) => !idSet.has(t.id))
          // 清理剩余任务中指向被删任务的依赖关系（双向）
          .map((t) => ({
            ...t,
            dependsOn: t.dependsOn?.filter((depId) => !idSet.has(depId)),
            blockedBy: t.blockedBy?.filter((bId) => !idSet.has(bId)),
          })),
        notifications: state.notifications.filter(
          (n) => !(n.relatedType === 'task' && n.relatedId && idSet.has(n.relatedId))
        ),
        // 批量删除同样进入回收站（软删除）
        trashedItems: [
          ...trashedTasks.map((t) => ({
            id: t.id,
            type: 'task' as const,
            data: t,
            deletedAt: new Date(),
          })),
          ...state.trashedItems,
        ],
        reminders: state.reminders.filter(
          (r) => !(r.type === 'task' && r.referenceId && idSet.has(r.referenceId))
        ),
      }
    }),
  batchUpdateTaskPriority: (ids: string[], priority: Task['priority']) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        ids.includes(t.id) ? { ...t, priority } : t
      ),
    })),
  batchAddTagToTasks: (ids: string[], tag: string) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        ids.includes(t.id) && !t.tags.includes(tag)
          ? { ...t, tags: [...t.tags, tag] }
          : t
      ),
    })),
  addSubTask: (taskId: string, title: string, dueDate?: Date) =>
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
  updateSubTask: (taskId: string, subTaskId: string, updates: Partial<SubTask>) =>
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
  toggleSubTask: (taskId: string, subTaskId: string) =>
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
  deleteSubTask: (taskId: string, subTaskId: string) =>
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
  reorderSubTasks: (taskId: string, subTaskIds: string[]) =>
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
  convertSubTaskToTask: (taskId: string, subTaskId: string) =>
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
  convertTaskToEvent: (id: string, startTime: string, endTime: string) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? { ...t, type: 'event' as const, startTime, endTime }
          : t
      ),
    })),
  convertEventToTask: (id: string) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? { ...t, type: 'task' as const, startTime: undefined, endTime: undefined }
          : t
      ),
    })),
  addTaskDependency: (taskId: string, dependsOnTaskId: string) =>
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
  removeTaskDependency: (taskId: string, dependsOnTaskId: string) =>
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
  getBlockedTasks: (taskId: string) => {
    const state = get()
    const task = state.tasks.find(t => t.id === taskId)
    if (!task || !task.blockedBy || task.blockedBy.length === 0) return []
    return task.blockedBy
  },
  canCompleteTask: (taskId: string) => {
    const state = get()
    const task = state.tasks.find(t => t.id === taskId)
    if (!task || !task.dependsOn || task.dependsOn.length === 0) return true
    
    return task.dependsOn.every(depId => {
      const depTask = state.tasks.find(t => t.id === depId)
      return depTask && depTask.status === 'done'
    })
  },
  
  addTaskComment: (taskId: string, content: string) =>
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
  deleteTaskComment: (taskId: string, commentId: string) =>
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
  addTaskReminder: (taskId: string, reminder: Omit<TaskReminder, 'id'>) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId) return t
        const reminders = [...(t.reminders || []), { ...reminder, id: generateId() }]
        return { ...t, reminders }
      }),
    })),
  updateTaskReminder: (taskId: string, reminderId: string, updates: Partial<TaskReminder>) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId) return t
        const reminders = (t.reminders || []).map((r) =>
          r.id === reminderId ? { ...r, ...updates } : r
        )
        return { ...t, reminders }
      }),
    })),
  removeTaskReminder: (taskId: string, reminderId: string) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId) return t
        const reminders = (t.reminders || []).filter((r) => r.id !== reminderId)
        return { ...t, reminders }
      }),
    })),
  markReminderTriggered: (taskId: string, reminderId: string) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId) return t
        const reminders = (t.reminders || []).map((r) =>
          r.id === reminderId ? { ...r, triggered: true } : r
        )
        return { ...t, reminders }
      }),
    })),

  taskOrder: [] as string[],
  updateTaskOrder: (order: string[]) => set({ taskOrder: order }),
  rescheduleTask: (taskId: string, newDate: Date) =>
    set((state) => ({
      tasks: state.tasks.map(t =>
        t.id === taskId ? { ...t, dueDate: newDate } : t
      ),
    })),
  rescheduleOverdueTasks: (taskIds: string[], newDate: Date) =>
    set((state) => ({
      tasks: state.tasks.map(t =>
        taskIds.includes(t.id) ? { ...t, dueDate: newDate } : t
      ),
    })),
})
