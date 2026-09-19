import { describe, it, expect, beforeEach, vi } from 'vitest'

const fakeStore: Record<string, unknown> = {}

vi.mock('@/lib/store', () => ({
  useAppStore: {
    getState: () => fakeStore,
    setState: (partial: Record<string, unknown>) => Object.assign(fakeStore, partial),
  },
}))

import { importDataToStore, restoreDataToStore } from '@/lib/data-restore'

function makeTask(id: string, title: string) {
  return {
    id,
    title,
    type: 'task',
    priority: 'medium',
    status: 'todo',
    tags: [],
    completedPomodoros: 0,
    timeSpent: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
  }
}

beforeEach(() => {
  for (const k of Object.keys(fakeStore)) delete fakeStore[k]
})

describe('importDataToStore 追加合并', () => {
  it('新 id 追加，已有 id 不覆盖现有数据', () => {
    const existing = makeTask('t1', '旧标题')
    fakeStore.tasks = [existing]
    const counts = importDataToStore({
      tasks: [makeTask('t1', '冲突标题'), makeTask('t2', '新任务')],
    })
    expect(counts.tasks).toBe(1)
    expect(fakeStore.tasks).toHaveLength(2)
    const t1 = (fakeStore.tasks as { id: string; title: string }[]).find((t) => t.id === 't1')
    expect(t1?.title).toBe('旧标题')
    expect((fakeStore.tasks as { id: string }[]).some((t) => t.id === 't2')).toBe(true)
  })

  it('重复导入同一文件不产生重复条目', () => {
    const data = { tasks: [makeTask('t1', 'A'), makeTask('t2', 'B')] }
    const first = importDataToStore(data)
    const second = importDataToStore(JSON.parse(JSON.stringify(data)))
    expect(first.tasks).toBe(2)
    expect(second.tasks).toBe(0)
    expect(fakeStore.tasks).toHaveLength(2)
  })

  it('habitCheckIns 与 goals 等其余实体同样按 id 追加', () => {
    fakeStore.goals = [{ id: 'g1', title: '已有目标' }]
    const counts = importDataToStore({
      goals: [
        { id: 'g1', title: '改名目标' },
        { id: 'g2', title: '新目标', milestones: [{ id: 'm1', title: '里程碑', done: false }] },
      ],
    })
    expect(counts.goals).toBe(1)
    const goals = fakeStore.goals as { id: string; title: string }[]
    expect(goals.find((g) => g.id === 'g1')?.title).toBe('已有目标')
    expect(goals).toHaveLength(2)
  })

  it('EXTRA_KEYS 数组按键去重追加，标量键以导入文件为准', () => {
    fakeStore.journals = [{ id: 'j1', content: '旧日记' }]
    fakeStore.sidebarCollapsed = false
    importDataToStore({
      journals: [{ id: 'j1', content: '覆盖尝试' }, { id: 'j2', content: '新日记' }],
      sidebarCollapsed: true,
    })
    const journals = fakeStore.journals as { id: string; content: string }[]
    expect(journals).toHaveLength(2)
    expect(journals.find((j) => j.id === 'j1')?.content).toBe('旧日记')
    expect(fakeStore.sidebarCollapsed).toBe(true)
  })

  it('无 id 的字符串数组按值去重（taskOrder）', () => {
    fakeStore.taskOrder = ['t1', 't2']
    importDataToStore({ taskOrder: ['t2', 't3'] })
    expect(fakeStore.taskOrder).toEqual(['t1', 't2', 't3'])
  })

  it('导入恢复的 pomodoroTimerState 强制 isRunning=false', () => {
    importDataToStore({ pomodoroTimerState: { isRunning: true, remaining: 1500 } })
    expect(fakeStore.pomodoroTimerState).toMatchObject({ isRunning: false, remaining: 1500 })
  })

  it('ISO 日期字符串在合并时被还原为 Date', () => {
    importDataToStore({ tasks: [makeTask('t9', '带日期')] })
    const t = (fakeStore.tasks as { id: string; createdAt: unknown }[])[0]
    expect(t.createdAt).toBeInstanceOf(Date)
  })
})

describe('restoreDataToStore 保持整体替换', () => {
  it('同 id 数据被文件内容覆盖', () => {
    fakeStore.tasks = [makeTask('t1', '本地旧标题')]
    restoreDataToStore({ tasks: [makeTask('t1', '备份标题'), makeTask('t2', 'x')] })
    const tasks = fakeStore.tasks as { id: string; title: string }[]
    expect(tasks).toHaveLength(2)
    expect(tasks.find((t) => t.id === 't1')?.title).toBe('备份标题')
  })
})
