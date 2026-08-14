import type { TaskTemplate } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createTemplateSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  taskTemplates: [] as TaskTemplate[],
  addTaskTemplate: (template: Omit<TaskTemplate, 'id' | 'createdAt' | 'usageCount'>) =>
    set((state) => ({
      taskTemplates: [
        ...state.taskTemplates,
        { ...template, id: generateId(), createdAt: new Date(), usageCount: 0 },
      ],
    })),
  deleteTaskTemplate: (id: string) =>
    set((state) => ({
      taskTemplates: state.taskTemplates.filter((t) => t.id !== id),
    })),
  applyTaskTemplate: (templateId: string) => {
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
})
