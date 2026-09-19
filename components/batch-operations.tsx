'use client'

import { useState } from 'react'
import type { Task } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  CheckCircle2,
  Trash2,
  Tag,
  Calendar,
  Flag,
  MoreHorizontal,
  X,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/confirm-dialog'

interface BatchOperationsProps {
  selectedTasks: Set<string>
  tasks: Task[]
  onBatchComplete: (taskIds: string[]) => void
  onBatchDelete: (taskIds: string[]) => void
  onBatchUpdatePriority: (taskIds: string[], priority: Task['priority']) => void
  onBatchAddTag: (taskIds: string[], tag: string) => void
  onClearSelection: () => void
}

export function BatchOperations({
  selectedTasks,
  tasks,
  onBatchComplete,
  onBatchDelete,
  onBatchUpdatePriority,
  onBatchAddTag,
  onClearSelection,
}: BatchOperationsProps) {
  const [newTag, setNewTag] = useState('')
  const { confirm: showConfirm, DialogComponent: ConfirmDialog } = useConfirm()
  const selectedCount = selectedTasks.size
  const selectedTasksList = tasks.filter((t) => selectedTasks.has(t.id))

  if (selectedCount === 0) return null

  const handleBatchComplete = () => {
    onBatchComplete(Array.from(selectedTasks))
    onClearSelection()
  }

  const handleBatchDelete = async () => {
    const confirmed = await showConfirm({
      title: '批量删除任务',
      description: `确定要删除 ${selectedCount} 个任务吗？此操作不可恢复！`,
      confirmText: '确认删除',
      cancelText: '取消',
      variant: 'destructive',
    })
    if (confirmed) {
      onBatchDelete(Array.from(selectedTasks))
      onClearSelection()
    }
  }

  const handleBatchPriority = (priority: Task['priority']) => {
    onBatchUpdatePriority(Array.from(selectedTasks), priority)
  }

  const handleAddTag = () => {
    if (newTag.trim()) {
      onBatchAddTag(Array.from(selectedTasks), newTag.trim())
      setNewTag('')
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 rounded-xl border bg-background/95 backdrop-blur p-3 shadow-lg">
        <div className="flex items-center gap-2">
          <Checkbox checked={true} className="h-5 w-5" />
          <Badge variant="secondary" className="font-medium">
            已选择 {selectedCount} 项
          </Badge>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-chart-2 hover:text-chart-2"
            onClick={handleBatchComplete}
          >
            <CheckCircle2 className="h-4 w-4" />
            完成
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Flag className="h-4 w-4" />
                优先级
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleBatchPriority('urgent')}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  紧急
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBatchPriority('high')}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-chart-3" />
                  高
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBatchPriority('medium')}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-chart-1" />
                  中
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBatchPriority('low')}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  低
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Tag className="h-4 w-4" />
                标签
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="p-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="输入标签..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                  />
                  <Button size="sm" onClick={handleAddTag}>
                    添加
                  </Button>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={handleBatchDelete}
          >
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClearSelection}
          aria-label="清除选择"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {ConfirmDialog}
    </div>
  )
}

interface TaskSelectionProps {
  taskId: string
  isSelected: boolean
  onToggleSelection: (taskId: string) => void
  children: React.ReactNode
}

export function TaskSelectionWrapper({
  taskId,
  isSelected,
  onToggleSelection,
  children,
}: TaskSelectionProps) {
  return (
    <div
      className={cn(
        'relative transition-all',
        isSelected && 'ring-2 ring-primary ring-offset-2 rounded-xl'
      )}
    >
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hover-reveal transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(taskId)}
          className="h-5 w-5"
        />
      </div>
      {isSelected && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
          <Checkbox
            checked={true}
            onCheckedChange={() => onToggleSelection(taskId)}
            className="h-5 w-5"
          />
        </div>
      )}
      <div className={cn(isSelected && 'pl-8')}>
        {children}
      </div>
    </div>
  )
}
