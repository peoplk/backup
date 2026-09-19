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
  // 表头归一化：小写并去掉空格/下划线/连字符，兼容 Todoist「Task Name」「Due Date」等导出列名
  const headerRow = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s_\-]/g, ''))
  const dataRows = rows.slice(1)

  const FIELD_ALIASES: Record<keyof Omit<ParsedTaskRow, 'title'> | 'title', string[]> = {
    title: ['title', 'task', 'taskname', 'name', 'content', '任务', '任务标题', '任务名称', '标题', '内容', '名称'],
    priority: ['priority', 'p', '优先级'],
    status: ['status', 'state', 'completed', '状态'],
    dueDate: ['duedate', 'due', 'deadline', 'date', '日期', '截止日期', '到期日'],
    project: ['project', 'folder', '项目', '项目名称'],
    tags: ['tags', 'labels', 'label', '标签'],
    estimatedPomodoros: ['estimatedpomodoros', '预估番茄数', '预计番茄数'],
    notes: ['notes', 'note', 'description', 'comment', '备注', '描述', '注释'],
    type: ['type', '类型'],
  }
  const colIndexes = (field: keyof typeof FIELD_ALIASES) =>
    FIELD_ALIASES[field].map((alias) => headerRow.indexOf(alias)).filter((i) => i >= 0)

  const validPriorities = ['urgent', 'high', 'medium', 'low']
  const validStatuses = ['todo', 'in-progress', 'done', 'cancelled']
  const validTypes = ['task', 'event', 'reminder']

  const priorityMap: Record<string, string> = {
    紧急: 'urgent', 高: 'high', 中: 'medium', 低: 'low',
    // Todoist 导出为 1-4 数字（4 最高）
    '4': 'urgent', '3': 'high', '2': 'medium', '1': 'low',
  }
  const statusMap: Record<string, string> = { 未开始: 'todo', 进行中: 'in-progress', 已完成: 'done', 已取消: 'cancelled', done: 'done', todo: 'todo' }
  const typeMap: Record<string, string> = { 任务: 'task', 事件: 'event', 提醒: 'reminder' }

  /** 兼容 YYYY-MM-DD / YYYY/MM/DD / ISO 带时间 等日期写法 */
  const normalizeDate = (raw: string): string | undefined => {
    const m = raw.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
    if (!m) return undefined
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }

  const result: ParsedTaskRow[] = []
  for (const r of dataRows) {
    const get = (field: keyof typeof FIELD_ALIASES) => {
      for (const idx of colIndexes(field)) {
        const v = (r[idx] ?? '').trim()
        if (v) return v
      }
      return ''
    }
    const title = get('title')
    if (!title) continue
    const rowData: ParsedTaskRow = { title }
    const priority = priorityMap[get('priority')] || get('priority')
    if (validPriorities.includes(priority)) rowData.priority = priority as ParsedTaskRow['priority']
    const status = statusMap[get('status')] || get('status')
    if (validStatuses.includes(status)) rowData.status = status as ParsedTaskRow['status']
    const dueDate = normalizeDate(get('dueDate'))
    if (dueDate) rowData.dueDate = dueDate
    const project = get('project')
    if (project) rowData.project = project
    const tags = get('tags')
    if (tags) rowData.tags = tags.split(/[|;]/).map((t) => t.trim().replace(/^#/, '')).filter(Boolean)
    const est = get('estimatedPomodoros')
    const estNum = parseInt(est, 10)
    if (Number.isFinite(estNum) && estNum > 0) rowData.estimatedPomodoros = Math.min(12, estNum)
    const notes = get('notes')
    if (notes) rowData.notes = notes
    const type = typeMap[get('type')] || get('type')
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

/** 导入模板：表头与 parseCSV 别名一致，附一行示例；Todoist/TickTick 导出列名可直接解析 */
export function downloadImportTemplate(): void {
  const lines = [
    'title,priority,status,dueDate,project,tags,estimatedPomodoros,notes,type',
    '示例：完成需求评审,high,todo,2026-10-01,示例项目,工作|重要,2,支持中文表头与 Todoist/TickTick 导出列名,task',
  ]
  downloadCSV('focusflow-import-template.csv', '\uFEFF' + lines.join('\n'))
}
