'use client'

import { useState, useEffect } from 'react'
import { restoreDataToStore } from '@/lib/data-restore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Save, RotateCcw, Clock, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  loadBackups,
  saveBackups,
  createBackupEntry,
  getAutoBackupSettings,
  saveAutoBackupSettings,
  runAutoBackupIfDue,
  type BackupEntry,
  type AutoBackupSettings,
} from '@/lib/auto-backup'

export function DataBackup() {
  const [open, setOpen] = useState(false)
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [autoSettings, setAutoSettings] = useState<AutoBackupSettings>(getAutoBackupSettings)

  useEffect(() => {
    if (open) setBackups(loadBackups())
  }, [open])

  const updateAutoSettings = (patch: Partial<AutoBackupSettings>) => {
    const next = { ...autoSettings, ...patch }
    setAutoSettings(next)
    saveAutoBackupSettings(next)
    if (patch.enabled) {
      runAutoBackupIfDue()
      setBackups(loadBackups())
      toast.success('自动备份已开启，已创建首份自动备份')
    }
  }

  const createBackup = () => {
    setBackups(createBackupEntry(false))
    toast.success('备份创建成功')
  }

  const restoreBackup = (backup: BackupEntry) => {
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
    const next = loadBackups().filter((b) => b.id !== id)
    saveBackups(next)
    setBackups(next)
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
      <DialogContent aria-describedby={undefined} className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>数据备份与恢复</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-xl border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">自动备份</p>
                  <p className="text-xs text-muted-foreground">应用运行期间按间隔自动创建本地快照</p>
                </div>
              </div>
              <Switch
                checked={autoSettings.enabled}
                onCheckedChange={(checked) => updateAutoSettings({ enabled: checked })}
                aria-label="自动备份"
              />
            </div>
            {autoSettings.enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">备份间隔</label>
                  <Select
                    value={String(autoSettings.intervalHours)}
                    onValueChange={(v) => updateAutoSettings({ intervalHours: Number(v) || 24 })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent align="center">
                      <SelectItem value="6">每 6 小时</SelectItem>
                      <SelectItem value="12">每 12 小时</SelectItem>
                      <SelectItem value="24">每天</SelectItem>
                      <SelectItem value="72">每 3 天</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">自动备份保留</label>
                  <Select
                    value={String(autoSettings.keep)}
                    onValueChange={(v) => updateAutoSettings({ keep: Number(v) || 10 })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent align="center">
                      <SelectItem value="5">5 份</SelectItem>
                      <SelectItem value="10">10 份</SelectItem>
                      <SelectItem value="20">20 份</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Button onClick={createBackup} className="w-full gap-2">
            <Save className="h-4 w-4" />
            创建新备份
          </Button>

          <div className="text-sm text-muted-foreground">
            手动备份始终保留，自动备份按上方设置滚动覆盖
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
                      <p className="text-sm font-medium truncate flex items-center gap-2">
                        {backup.name}
                        {backup.auto && <Badge variant="secondary" className="text-2xs shrink-0">自动</Badge>}
                      </p>
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
                        aria-label="删除备份"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
