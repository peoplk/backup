import { describe, it, expect } from 'vitest'
import { toMinutes, fromMinutes, computeAutoSchedule } from '@/lib/auto-schedule'
import type { Task, TimeBlock, ExternalCalendarEvent } from '@/lib/types'

function mkTask(partial: Partial<Task> & { id: string; title: string }): Task {
  return {
    type: 'task',
    priority: 'medium',
    status: 'todo',
    tags: [],
    ...partial,
  } as Task
}

function mkBlock(partial: Partial<TimeBlock> & { id: string; startTime: string; endTime: string }): TimeBlock {
  return {
    title: 'block',
    date: new Date(),
    category: 'focus',
    color: '#888',
    createdAt: new Date(),
    ...partial,
  } as TimeBlock
}

describe('toMinutes / fromMinutes', () => {
  it('时分互转', () => {
    expect(toMinutes('09:30')).toBe(570)
    expect(toMinutes('0:00')).toBe(0)
    expect(toMinutes('18:00')).toBe(1080)
    expect(fromMinutes(570)).toBe('09:30')
    expect(fromMinutes(1439)).toBe('23:59')
    expect(fromMinutes(toMinutes('14:05'))).toBe('14:05')
  })
})

describe('computeAutoSchedule', () => {
  it('无占用时从日始依次排入', () => {
    const tasks = [
      mkTask({ id: 't1', title: 'A', estimatedPomodoros: 2 }), // 50min
      mkTask({ id: 't2', title: 'B' }), // 默认 45min
    ]
    const { slots, unplaced } = computeAutoSchedule({ tasks, blocks: [] })
    expect(unplaced).toHaveLength(0)
    expect(slots[0]).toMatchObject({ taskId: 't1', startMin: 540, endMin: 590 })
    expect(slots[1]).toMatchObject({ taskId: 't2', startMin: 590, endMin: 635 })
  })

  it('避开已占用时间块并向上取整到 15 分钟', () => {
    const tasks = [mkTask({ id: 't1', title: 'A', estimatedPomodoros: 1 })] // 30min（25→钳到30）
    const blocks = [mkBlock({ id: 'b1', startTime: '09:00', endTime: '10:07' })]
    const { slots } = computeAutoSchedule({ tasks, blocks })
    expect(slots).toHaveLength(1)
    expect(slots[0].startMin).toBe(615) // 10:07 → ceil 到 10:15
    expect(slots[0].endMin).toBe(645)
  })

  it('时长钳制在 [30,120] 分钟', () => {
    const short = mkTask({ id: 's', title: 'S', estimatedPomodoros: 1 }) // 25 → 30
    const long = mkTask({ id: 'l', title: 'L', estimatedPomodoros: 10 }) // 250 → 120
    const { slots } = computeAutoSchedule({ tasks: [short, long], blocks: [] })
    expect(slots[0].endMin - slots[0].startMin).toBe(30)
    expect(slots[1].endMin - slots[1].startMin).toBe(120)
  })

  it('已被时间块引用的任务不重复排程', () => {
    const tasks = [mkTask({ id: 'x', title: 'X' })]
    const blocks = [mkBlock({ id: 'b', startTime: '10:00', endTime: '11:00', taskId: 'x' })]
    const { slots, unplaced } = computeAutoSchedule({ tasks, blocks })
    expect(slots).toHaveLength(0)
    expect(unplaced).toHaveLength(0)
  })

  it('放不下的任务进入 unplaced', () => {
    const tasks = [
      mkTask({ id: 'a', title: 'A', estimatedPomodoros: 4 }),
      mkTask({ id: 'b', title: 'B', estimatedPomodoros: 4 }),
    ]
    const { slots, unplaced } = computeAutoSchedule({
      tasks,
      blocks: [],
      dayStartMin: 9 * 60,
      dayEndMin: 11 * 60,
    })
    expect(slots).toHaveLength(1)
    expect(unplaced).toEqual(['b'])
  })

  it('避开外部日历事件（非全天）', () => {
    const evStart = new Date()
    evStart.setHours(9, 0, 0, 0)
    const evEnd = new Date()
    evEnd.setHours(10, 30, 0, 0)
    const events: ExternalCalendarEvent[] = [
      { id: 'e1', calendarId: 'c1', title: '外部会议', start: evStart, end: evEnd, allDay: false },
    ]
    const { slots } = computeAutoSchedule({
      tasks: [mkTask({ id: 't', title: 'T', estimatedPomodoros: 1 })],
      blocks: [],
      events,
    })
    expect(slots[0].startMin).toBeGreaterThanOrEqual(630)
  })

  it('earliestMin 不早于当前时刻', () => {
    const { slots } = computeAutoSchedule({
      tasks: [mkTask({ id: 't', title: 'T' })],
      blocks: [],
      earliestMin: 14 * 60,
    })
    expect(slots[0].startMin).toBe(14 * 60)
  })
})
