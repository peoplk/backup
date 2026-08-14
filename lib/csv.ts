import type { Task } from '@/lib/types'

type AddTaskInput = Omit<Task, 'id' | 'createdAt' | 'completedPomodoros'>

function escapeCsv(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function tasksToCSV(tasks: Task[]): string {
  const headers = [
    'title',
    'priority',
    'status',
    'dueDate',
    'project',
    'tags',
    'estimatedPomodoros',
    'notes',
    'type',
  ]
  const lines = [headers.join(',')]
  for (const t of tasks) {
    lines.push(
      [
        escapeCsv(t.title),
        escapeCsv(t.priority),
        escapeCsv(t.status),
        escapeCsv(t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : ''),
        escapeCsv(t.project || ''),
        escapeCsv((t.tags || []).join('|')),
        escapeCsv(t.estimatedPomodoros ?? ''),
        escapeCsv(t.notes || ''),
        escapeCsv(t.type),
      ].join(',')
    )
  }
  return '\uFEFF' + lines.join('\n')
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface ParsedTaskRow {
  title: string
  priority?: 'urgent' | 'high' | 'medium' | 'low'
  status?: 'todo' | 'in-progress' | 'done' | 'cancelled'
  dueDate?: string
  project?: string
  tags?: string[]
  estimatedPomodoros?: number
  notes?: string
  type?: 'task' | 'event' | 'reminder'
}

export function parseCSV(content: string): ParsedTaskRow[] {
  const text = content.replace(/^\uFEFF/, '').trim()
  if (!text) return []

  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  const row: string[] = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(current)
      current = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(current)
      current = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row.length = 0
    } else {
      current += ch
    }
  }
  row.push(current)
  if (row.some((c) => c.trim() !== '')) rows.push(row)

  if (rows.length === 0) return []
  const headerRow = rows[0].map((h) => h.trim().toLowerCase())
  const colIndex = (name: string) => {
    const idx = headerRow.indexOf(name)
    return idx >= 0 ? idx : -1
  }
  const dataRows = rows.slice(1)

  const validPriorities = ['urgent', 'high', 'medium', 'low']
  const validStatuses = ['todo', 'in-progress', 'done', 'cancelled']
  const validTypes = ['task', 'event', 'reminder']

  const result: ParsedTaskRow[] = []
  for (const r of dataRows) {
    const get = (name: string) => {
      const idx = colIndex(name)
      return idx >= 0 ? (r[idx] ?? '').trim() : ''
    }
    const title = get('title') || get('任务标题')
    if (!title) continue
    const rowData: ParsedTaskRow = { title }
    const priority = get('priority')
    if (validPriorities.includes(priority)) rowData.priority = priority as ParsedTaskRow['priority']
    const status = get('status')
    if (validStatuses.includes(status)) rowData.status = status as ParsedTaskRow['status']
    const dueDate = get('dueDate') || get('日期')
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dueDate)) rowData.dueDate = dueDate
    const project = get('project') || get('项目')
    if (project) rowData.project = project
    const tags = get('tags')
    if (tags) rowData.tags = tags.split('|').map((t) => t.trim()).filter(Boolean)
    const est = get('estimatedpomodoros')
    const estNum = parseInt(est, 10)
    if (Number.isFinite(estNum) && estNum > 0) rowData.estimatedPomodoros = Math.min(12, estNum)
    const notes = get('notes')
    if (notes) rowData.notes = notes
    const type = get('type')
    if (validTypes.includes(type)) rowData.type = type as ParsedTaskRow['type']
    result.push(rowData)
  }
  return result
}

export function importTasksFromCSV(content: string, addTask: (t: AddTaskInput) => void): number {
  const rows = parseCSV(content)
  let count = 0
  for (const r of rows) {
    try {
      addTask({
        title: r.title,
        type: r.type ?? 'task',
        priority: r.priority ?? 'medium',
        status: r.status ?? 'todo',
        tags: r.tags ?? [],
        dueDate: r.dueDate ? new Date(r.dueDate + 'T00:00:00') : undefined,
        project: r.project || undefined,
        estimatedPomodoros: r.estimatedPomodoros,
        notes: r.notes || undefined,
      })
      count++
    } catch {
      // 单行失败跳过
    }
  }
  return count
}
