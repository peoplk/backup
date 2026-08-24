'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import type { Task } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Link2, Plus, X, CheckCircle2, Circle, Network } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskDependencyGraph } from '@/components/task-dependency-graph'

interface TaskDependencyManagerProps {
  taskId: string
  trigger?: React.ReactNode
}

export function TaskDependencyManager({ taskId, trigger }: TaskDependencyManagerProps) {
  const tasks = useAppStore((s) => s.tasks)
  const addTaskDependency = useAppStore((s) => s.addTaskDependency)
  const removeTaskDependency = useAppStore((s) => s.removeTaskDependency)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDependency, setSelectedDependency] = useState<string>('')

  const task = tasks.find(t => t.id === taskId)
  if (!task) return null

  const dependencies = task.dependsOn || []
  const dependentTasks = dependencies
    .map(depId => tasks.find(t => t.id === depId))
    .filter((t): t is Task => t !== undefined)

  const blockedBy = task.blockedBy || []
  const blockingTasks = blockedBy
    .map(depId => tasks.find(t => t.id === depId))
    .filter((t): t is Task => t !== undefined)

  const availableTasks = tasks.filter(t => 
    t.id !== taskId && 
    !dependencies.includes(t.id) &&
    t.status !== 'done'
  )

  const handleAddDependency = () => {
    if (selectedDependency && selectedDependency !== 'none') {
      addTaskDependency(taskId, selectedDependency)
      setSelectedDependency('')
    }
  }

  const handleRemoveDependency = (depId: string) => {
    removeTaskDependency(taskId, depId)
  }

  const canComplete = dependencies.every(depId => {
    const depTask = tasks.find(t => t.id === depId)
    return depTask && depTask.status === 'done'
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-2">
            <Link2 className="h-4 w-4" />
            依赖关系
            {dependencies.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {dependencies.length}
              </Badge>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            任务依赖关系
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {!canComplete && dependencies.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">任务被阻塞</p>
                <p className="text-sm text-muted-foreground mt-1">
                  请先完成所有前置任务才能完成此任务
                </p>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-3">前置任务</h3>
            {dependentTasks.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                无前置任务依赖
              </div>
            ) : (
              <div className="space-y-2">
                {dependentTasks.map(depTask => (
                  <div
                    key={depTask.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border transition-all',
                      depTask.status === 'done' 
                        ? 'bg-chart-2/5 border-chart-2/20' 
                        : 'bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {depTask.status === 'done' ? (
                        <CheckCircle2 className="h-4 w-4 text-chart-2" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className={cn(
                          'font-medium text-sm',
                          depTask.status === 'done' && 'line-through text-muted-foreground'
                        )}>
                          {depTask.title}
                        </p>
                        {depTask.project && (
                          <p className="text-xs text-muted-foreground">{depTask.project}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemoveDependency(depTask.id)}
                      aria-label="移除依赖"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {availableTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">添加前置任务</h3>
              <div className="flex gap-2">
                <Select value={selectedDependency} onValueChange={setSelectedDependency}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="选择前置任务..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTasks.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <span>{t.title}</span>
                          {t.project && (
                            <Badge variant="outline" className="text-xs">
                              {t.project}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddDependency}
                  disabled={!selectedDependency || selectedDependency === 'none'}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加
                </Button>
              </div>
            </div>
          )}

          {blockingTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">阻塞的任务</h3>
              <div className="space-y-2">
                {blockingTasks.map(blockedTask => (
                  <div
                    key={blockedTask.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50"
                  >
                    <AlertCircle className="h-4 w-4 text-chart-3" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{blockedTask.title}</p>
                      {blockedTask.project && (
                        <p className="text-xs text-muted-foreground">{blockedTask.project}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      等待中
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-chart-1" />
              <h3 className="text-sm font-semibold">依赖链路</h3>
              <span className="text-xs text-muted-foreground">
                查看该任务的完整上下游依赖关系
              </span>
            </div>
            <TaskDependencyGraph taskId={taskId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function TaskDependencyBadge({ taskId }: { taskId: string }) {
  const tasks = useAppStore((s) => s.tasks)
  const task = tasks.find(t => t.id === taskId)
  
  if (!task || !task.dependsOn || task.dependsOn.length === 0) return null

  const completedDeps = task.dependsOn.filter(depId => {
    const depTask = tasks.find(t => t.id === depId)
    return depTask && depTask.status === 'done'
  }).length

  const allCompleted = completedDeps === task.dependsOn.length

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'gap-1 text-xs',
        allCompleted ? 'border-chart-2/30 text-chart-2' : 'border-chart-3/30 text-chart-3'
      )}
    >
      <Link2 className="h-3 w-3" />
      {completedDeps}/{task.dependsOn.length}
    </Badge>
  )
}
