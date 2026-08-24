'use client'

import { SmartQuickAddTask } from '@/components/smart-quick-add-task'
import { useAppStore } from '@/lib/store'
import type { ParsedTaskInput } from '@/lib/smart-input-enhanced'

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
      priority: parsed.priority || 'medium',
      project: parsed.project || '',
      tags: parsed.tags || [],
      dueDate: parsed.dueDate,
      startTime: parsed.startTime,
      status: 'todo',
      estimatedPomodoros: parsed.estimatedPomodoros || 1,
      energy: parsed.energy,
    })
    onClose?.()
  }

  return <SmartQuickAddTask onSubmit={handleSubmit} className={className} />
}