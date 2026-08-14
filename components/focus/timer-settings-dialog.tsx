'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { PomodoroSettings } from '@/lib/types'
import { SOUND_PRESETS, playPresetSound, type SoundPresetId } from '@/lib/focus-sounds'
import { Settings, Play } from 'lucide-react'

interface TimerSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pomodoroSettings: PomodoroSettings
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void
  autoStartBreak: boolean
  autoStartWork: boolean
}

export function TimerSettingsDialog({
  open,
  onOpenChange,
  pomodoroSettings,
  updatePomodoroSettings,
  autoStartBreak,
  autoStartWork,
}: TimerSettingsDialogProps) {
  const currentSound = (pomodoroSettings.notificationSound || 'classic') as SoundPresetId

  const previewSound = (id: SoundPresetId) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext!)()
      playPresetSound(ctx, id)
      setTimeout(() => ctx.close(), 2000)
    } catch {
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          设置
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>番茄钟设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <label className="text-sm font-medium">
              专注时长: {pomodoroSettings.workDuration / 60} 分钟
            </label>
            <Slider
              value={[pomodoroSettings.workDuration / 60]}
              min={15}
              max={60}
              step={5}
              onValueChange={([value]) =>
                updatePomodoroSettings({ workDuration: value * 60 })
              }
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium">
              短休息时长: {pomodoroSettings.shortBreakDuration / 60} 分钟
            </label>
            <Slider
              value={[pomodoroSettings.shortBreakDuration / 60]}
              min={3}
              max={15}
              step={1}
              onValueChange={([value]) =>
                updatePomodoroSettings({ shortBreakDuration: value * 60 })
              }
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium">
              长休息时长: {pomodoroSettings.longBreakDuration / 60} 分钟
            </label>
            <Slider
              value={[pomodoroSettings.longBreakDuration / 60]}
              min={10}
              max={30}
              step={5}
              onValueChange={([value]) =>
                updatePomodoroSettings({ longBreakDuration: value * 60 })
              }
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium">
              长休息间隔: 每 {pomodoroSettings.sessionsBeforeLongBreak} 个番茄钟
            </label>
            <Slider
              value={[pomodoroSettings.sessionsBeforeLongBreak]}
              min={2}
              max={6}
              step={1}
              onValueChange={([value]) =>
                updatePomodoroSettings({ sessionsBeforeLongBreak: value })
              }
            />
          </div>
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium">自动化选项</h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">自动开始休息</p>
                <p className="text-xs text-muted-foreground">专注结束后自动开始休息</p>
              </div>
              <Switch
                checked={autoStartBreak}
                onCheckedChange={(checked) =>
                  updatePomodoroSettings({ autoStartBreak: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">自动开始专注</p>
                <p className="text-xs text-muted-foreground">休息结束后自动开始专注</p>
              </div>
              <Switch
                checked={autoStartWork}
                onCheckedChange={(checked) =>
                  updatePomodoroSettings({ autoStartWork: checked })
                }
              />
            </div>
          </div>
          <div className="space-y-3 border-t pt-4">
            <h4 className="font-medium">完成音效</h4>
            <p className="text-xs text-muted-foreground">选择番茄钟/休息结束时的提示音</p>
            <div className="grid grid-cols-2 gap-2">
              {SOUND_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className={`flex items-center justify-between rounded-lg border p-2 transition-colors cursor-pointer ${
                    currentSound === preset.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => updatePomodoroSettings({ notificationSound: preset.id })}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0">{preset.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{preset.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{preset.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex-shrink-0 rounded p-1 hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation()
                      previewSound(preset.id)
                    }}
                  >
                    <Play className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
