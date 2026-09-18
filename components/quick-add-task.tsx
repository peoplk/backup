'use client'

import { SmartQuickAddTask } from '@/components/smart-quick-add-task'
import { useAppStore } from '@/lib/store'
import { buildParsedTaskFields, type ParsedTaskInput } from '@/lib/smart-input-enhanced'

interface QuickAddTaskProps {
  onClose?: () => void
  className?: string
}

/**
 * 快速添加任务入口。
 * 与 SmartQuickAddTask 共享同一套智能输入实现（smart-input-enhanced），
 * 此处仅为兼容旧调用点保留的轻量封装。
 */
export function QuickAddTask({ onClose, className }: QuickAddTaskProps) {
  const addTask = useAppStore((s) => s.addTask)

  const handleSubmit = (parsed: ParsedTaskInput) => {
    addTask({
      title: parsed.title,
      description: undefined,
      type: 'task',
      ...buildParsedTaskFields(parsed),
      status: 'todo',
      estimatedPomodoros: parsed.estimatedPomodoros || 1,
    })
    onClose?.()
  }

  return <SmartQuickAddTask onSubmit={handleSubmit} className={className} />
}