'use client'

import { useAppStore } from '@/lib/store'
import { restoreDataToStore } from '@/lib/data-restore'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Save, RotateCcw, Clock, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'

interface BackupData {
  id: string
  name: string
  timestamp: number
  data: string
}

const BACKUP_STORAGE_KEY = 'focusflow-backups'
const MAX_BACKUPS = 10

export function DataBackup() {
  const [backups, setBackups] = useState<BackupData[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    loadBackups()
  }, [])

  const loadBackups = () => {
    try {
      const stored = localStorage.getItem(BACKUP_STORAGE_KEY)
      if (stored) {
        setBackups(JSON.parse(stored))
      }
    } catch {
      setBackups([])
    }
  }

  const saveBackups = (newBackups: BackupData[]) => {
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(newBackups))
    setBackups(newBackups)
  }

  const createBackup = () => {
    const store = useAppStore.getState()
    const data = JSON.stringify({
      tasks: store.tasks,
      habits: store.habits,
      habitCheckIns: store.habitCheckIns,
      timeEntries: store.timeEntries,
      pomodoroSessions: store.pomodoroSessions,
      abandonedPomodoroSessions: store.abandonedPomodoroSessions,
      pomodoroSettings: store.pomodoroSettings,
      pomodoroTimerState: { ...store.pomodoroTimerState, isRunning: false },
      projects: store.projects,
      anniversaries: store.anniversaries,
      goals: store.goals,
      tags: store.tags,
      reminders: store.reminders,
      notifications: store.notifications,
      sidebarCollapsed: store.sidebarCollapsed,
      activeSmartList: store.activeSmartList,
      achievements: store.achievements,
      userLevel: store.userLevel,
      focusGoals: store.focusGoals,
      repeatCompletions: store.repeatCompletions,
      trashedItems: store.trashedItems,
      taskOrder: store.taskOrder,
      timeBlocks: store.timeBlocks,
      distractions: store.distractions,
      journals: store.journals,
      taskTemplates: store.taskTemplates,
      pomodoroStrictMode: store.pomodoroStrictMode,
      dashboardWidgets: store.dashboardWidgets,
      darkModeSchedule: store.darkModeSchedule,
      workingHours: store.workingHours,
      focusSoundSettings: store.focusSoundSettings,
      focusPresets: store.focusPresets,
      dailyReviewSettings: store.dailyReviewSettings,
      savedFilters: store.savedFilters,
      activeSavedFilterId: store.activeSavedFilterId,
    })

    const backup: BackupData = {
      id: `backup-${Date.now()}`,
      name: `备份 ${new Date().toLocaleString('zh-CN')}`,
      timestamp: Date.now(),
      data,
    }

    const newBackups = [backup, ...backups].slice(0, MAX_BACKUPS)
    saveBackups(newBackups)
    toast.success('备份创建成功')
  }

  const restoreBackup = (backup: BackupData) => {
    try {
      const data = JSON.parse(backup.data)

      restoreDataToStore(data)

      toast.success('备份恢复成功')
      setOpen(false)
    } catch {
      toast.error('恢复失败，备份文件可能已损坏')
    }
  }

  const deleteBackup = (id: string) => {
    const newBackups = backups.filter(b => b.id !== id)
    saveBackups(newBackups)
    toast.success('备份已删除')
  }

  const formatBackupSize = (data: string) => {
    const bytes = new Blob([data]).size
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Save className="h-4 w-4" />
          备份管理
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>数据备份与恢复</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Button onClick={createBackup} className="w-full gap-2">
            <Save className="h-4 w-4" />
            创建新备份
          </Button>

          <div className="text-sm text-muted-foreground">
            最多保留 {MAX_BACKUPS} 个备份，旧备份会自动删除
          </div>

          <ScrollArea className="h-[300px] rounded-lg border">
            {backups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Clock className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">暂无备份</p>
              </div>
            ) : (
              <div className="divide-y">
                {backups.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{backup.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBackupSize(backup.data)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restoreBackup(backup)}
                        className="gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        恢复
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteBackup(backup.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
