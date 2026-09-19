import type { Task, TimeBlock, ExternalCalendarEvent } from '@/lib/types'

export interface AutoScheduleSlot {
  taskId: string
  title: string
  startMin: number
  endMin: number
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function fromMinutes(mm: number): string {
  return `${String(Math.floor(mm / 60) % 24).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`
}

/**
 * 贪心自动排程：把未安排的任务按预估番茄时长（无预估按 45 分钟）
 * 依次填入 [dayStartMin, dayEndMin] 内避开已占用时段的空档。
 */
export function computeAutoSchedule(opts: {
  tasks: Task[]
  blocks: TimeBlock[]
  events?: ExternalCalendarEvent[]
  dayStartMin?: number
  dayEndMin?: number
  earliestMin?: number
}): { slots: AutoScheduleSlot[]; unplaced: string[] } {
  const { tasks, blocks, events = [], dayStartMin = 9 * 60, dayEndMin = 18 * 60, earliestMin = 0 } = opts

  const busy: Array<[number, number]> = []
  blocks.forEach(b => busy.push([toMinutes(b.startTime), toMinutes(b.endTime)]))
  events.forEach(ev => {
    if (ev.allDay) return
    const s = new Date(ev.start)
    const e = new Date(ev.end)
    busy.push([s.getHours() * 60 + s.getMinutes(), e.getHours() * 60 + e.getMinutes() > 0 ? e.getHours() * 60 + e.getMinutes() : s.getHours() * 60 + s.getMinutes() + 60])
  })
  busy.sort((a, b) => a[0] - b[0])

  const scheduledTaskIds = new Set(blocks.map(b => b.taskId).filter(Boolean))
  const queue = tasks.filter(t => !scheduledTaskIds.has(t.id))

  const slots: AutoScheduleSlot[] = []
  const unplaced: string[] = []
  let cursor = Math.max(dayStartMin, earliestMin)

  for (const task of queue) {
    const duration = Math.min(Math.max((task.estimatedPomodoros || 0) * 25 || 45, 30), 120)
    // 从 cursor 起找第一个能容纳 duration 的空档
    let start = cursor
    for (;;) {
      if (start + duration > dayEndMin) {
        unplaced.push(task.id)
        start = -1
        break
      }
      const clash = busy.find(([bs, be]) => be > start && bs < start + duration)
      if (!clash) break
      start = Math.max(start, Math.ceil(clash[1] / 15) * 15)
    }
    if (start === -1) continue
    busy.push([start, start + duration])
    busy.sort((a, b) => a[0] - b[0])
    slots.push({ taskId: task.id, title: task.title, startMin: start, endMin: start + duration })
    cursor = start + duration
  }

  return { slots, unplaced }
}
