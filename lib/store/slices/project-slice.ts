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
    set((state) => {
      const project = state.projects.find((p) => p.id === id)
      if (!project) return state
      const childIds = new Set<string>()
      const collect = (pid: string) => {
        for (const p of state.projects) {
          if (p.parentId === pid && !childIds.has(p.id)) {
            childIds.add(p.id)
            collect(p.id)
          }
        }
      }
      collect(id)
      const removedIds = new Set([id, ...childIds])
      const removedNames = new Set(
        state.projects.filter((p) => removedIds.has(p.id)).map((p) => p.name)
      )
      return {
        projects: state.projects.filter((p) => !removedIds.has(p.id)),
        // 清理任务中指向被删项目的引用
        tasks: state.tasks.map((t) =>
          t.project && removedNames.has(t.project)
            ? { ...t, project: undefined }
            : t
        ),
        // 清理时间记录中指向被删项目的引用
        timeEntries: state.timeEntries.map((e) =>
          e.project && removedNames.has(e.project)
            ? { ...e, project: '未分类', projectId: undefined }
            : e
        ),
      }
    }),
})
