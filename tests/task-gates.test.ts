import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data-link-service', () => ({
  dataLinkService: { handleTaskCompletion: vi.fn() },
}))
// 打断 store/utils ↔ s3-store ↔ store/index 的循环依赖，令 task-slice 可独立测试
vi.mock('@/lib/store', () => ({}))
vi.mock('@/lib/s3-store', () => ({ pushDataToS3: vi.fn(), pullDataFromS3: vi.fn() }))
vi.mock('@/lib/sync/offline-queue', () => ({
  offlineQueue: { push: vi.fn() },
  setOfflineQueuePush: vi.fn(),
  startAutoFlush: vi.fn(),
}))

import { createTaskSlice } from '@/lib/store/slices/task-slice'
import type { AppState, AppStoreApi } from '@/lib/store/types'
import type { Task } from '@/lib/types'

function baseTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `任务${id}`,
    priority: 'medium',
    status: 'todo',
    type: 'task',
    subtasks: [],
    pomodorosCompleted: [],
    completed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Task
}

function makeStore(initialTasks: Task[]) {
  let state = {
    tasks: initialTasks,
    notifications: [],
    repeatCompletions: [],
  } as unknown as AppState
  const set: (fn: ((s: AppState) => Partial<AppState>) | Partial<AppState>) => void = (fn) => {
    const patch = typeof fn === 'function' ? (fn as (s: AppState) => Partial<AppState>)(state) : fn
    state = { ...state, ...patch }
  }
  const get = () => state
  const slice = createTaskSlice(set, get as () => AppState, (() => state) as unknown as AppStoreApi)
  // 动作回填进 state，使 get().completeTask 等跨动作调用可用（对齐 zustand 合并语义）；
  // 不回填 slice 自带的默认 tasks，避免覆盖测试初始数据
  const { tasks: _defaultTasks, ...actions } = slice
  state = { ...state, ...actions } as AppState
  return { slice, getState: () => state }
}

describe('updateTask 完成门禁', () => {
  it('updateTask 置 done 会路由到 completeTask（补 completedAt）', () => {
    const { slice, getState } = makeStore([baseTask('a')])
    slice.updateTask('a', { status: 'done', completedAt: undefined })
    const task = getState().tasks.find((t) => t.id === 'a')!
    expect(task.status).toBe('done')
    expect(task.completedAt).toBeInstanceOf(Date)
  })

  it('有未完成前置任务时 updateTask 不能绕过依赖门禁', () => {
    const { slice, getState } = makeStore([
      baseTask('dep', { status: 'todo' }),
      baseTask('blocked', { dependsOn: ['dep'] }),
    ])
    slice.updateTask('blocked', { status: 'done' })
    expect(getState().tasks.find((t) => t.id === 'blocked')!.status).toBe('todo')
    expect(getState().notifications[0]?.title).toBe('无法完成任务')
  })

  it('done → done 的普通更新不受影响（不重复触发门禁）', () => {
    const doneAt = new Date('2026-01-01')
    const { slice, getState } = makeStore([baseTask('a', { status: 'done', completedAt: doneAt })])
    slice.updateTask('a', { status: 'done', title: '改名' })
    const task = getState().tasks.find((t) => t.id === 'a')!
    expect(task.title).toBe('改名')
    expect(task.completedAt).toBe(doneAt)
  })

  it('非 done 状态更新保持原行为', () => {
    const { slice, getState } = makeStore([baseTask('a')])
    slice.updateTask('a', { status: 'in-progress' })
    expect(getState().tasks.find((t) => t.id === 'a')!.status).toBe('in-progress')
  })
})

describe('batchCompleteTasks 门禁', () => {
  it('逐任务走 completeTask：被阻塞任务不完成，其余正常完成', () => {
    const { slice, getState } = makeStore([
      baseTask('dep'),
      baseTask('blocked', { dependsOn: ['dep'] }),
      baseTask('free'),
    ])
    slice.batchCompleteTasks(['blocked', 'free'])
    const tasks = getState().tasks
    expect(tasks.find((t) => t.id === 'blocked')!.status).toBe('todo')
    expect(tasks.find((t) => t.id === 'free')!.status).toBe('done')
  })

  it('先完成依赖再批量完成阻塞任务', () => {
    const { slice, getState } = makeStore([
      baseTask('dep'),
      baseTask('blocked', { dependsOn: ['dep'] }),
    ])
    slice.batchCompleteTasks(['dep'])
    slice.batchCompleteTasks(['blocked'])
    expect(getState().tasks.find((t) => t.id === 'blocked')!.status).toBe('done')
  })
})

describe('addTaskDependency 环检测', () => {
  it('拒绝自依赖', () => {
    const { slice, getState } = makeStore([baseTask('a')])
    slice.addTaskDependency('a', 'a')
    expect(getState().tasks.find((t) => t.id === 'a')!.dependsOn ?? []).toEqual([])
  })

  it('拒绝直接反向环（A→B 后不允许 B→A）', () => {
    const { slice, getState } = makeStore([baseTask('a'), baseTask('b')])
    slice.addTaskDependency('a', 'b')
    slice.addTaskDependency('b', 'a')
    const b = getState().tasks.find((t) => t.id === 'b')!
    expect(b.dependsOn ?? []).not.toContain('a')
    expect(b.blockedBy).toEqual(['a'])
  })

  it('拒绝传递环（A→B→C 后不允许 C→A）', () => {
    const { slice, getState } = makeStore([baseTask('a'), baseTask('b'), baseTask('c')])
    slice.addTaskDependency('a', 'b')
    slice.addTaskDependency('b', 'c')
    slice.addTaskDependency('c', 'a')
    expect(getState().tasks.find((t) => t.id === 'c')!.dependsOn ?? []).not.toContain('a')
  })

  it('拒绝重复边', () => {
    const { slice, getState } = makeStore([baseTask('a'), baseTask('b')])
    slice.addTaskDependency('a', 'b')
    slice.addTaskDependency('a', 'b')
    expect(getState().tasks.find((t) => t.id === 'a')!.dependsOn).toEqual(['b'])
  })

  it('合法依赖双向写入', () => {
    const { slice, getState } = makeStore([baseTask('a'), baseTask('b')])
    slice.addTaskDependency('a', 'b')
    expect(getState().tasks.find((t) => t.id === 'a')!.dependsOn).toEqual(['b'])
    expect(getState().tasks.find((t) => t.id === 'b')!.blockedBy).toEqual(['a'])
  })
})
