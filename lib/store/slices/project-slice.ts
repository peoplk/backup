import type { Project } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId, defaultProjects } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

export const createProjectSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  projects: defaultProjects,
  addProject: (project: Omit<Project, 'id' | 'totalTime'>) => {
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
  updateProject: (id: string, updates: Partial<Project>) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  deleteProject: (id: string) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    })),
})
