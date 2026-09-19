'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { COLOR_PALETTE } from '@/lib/palette'
import { FocusPreset, PomodoroSettings } from '@/lib/types'
import { Edit, Trash2, MoreHorizontal, Plus } from 'lucide-react'

interface TimerPresetsProps {
  focusPresets: FocusPreset[]
  pomodoroSettings: PomodoroSettings
  isRunning: boolean
  autoStartBreak: boolean
  autoStartWork: boolean
  soundEnabled: boolean
  applyFocusPreset: (id: string) => void
  updateFocusPreset: (id: string, updates: Partial<FocusPreset>) => void
  deleteFocusPreset: (id: string) => void
  addFocusPreset: (preset: Omit<FocusPreset, 'id' | 'createdAt'>) => void
}

export function TimerPresets({
  focusPresets,
  pomodoroSettings,
  isRunning,
  autoStartBreak,
  autoStartWork,
  soundEnabled,
  applyFocusPreset,
  updateFocusPreset,
  deleteFocusPreset,
  addFocusPreset,
}: TimerPresetsProps) {
  if (focusPresets.length === 0) return null

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="text-xs text-muted-foreground shrink-0">模式预设：</span>
      {focusPresets.map((preset) => {
        const isActive = pomodoroSettings.workDuration === preset.workDuration &&
          pomodoroSettings.shortBreakDuration === preset.shortBreakDuration
        const isDefault = preset.id.startsWith('preset-')

        return (
          <Popover key={preset.id}>
            <PopoverTrigger asChild>
              <button
                onClick={() => {
                  if (!isRunning) {
                    applyFocusPreset(preset.id)
                  }
                }}
                disabled={isRunning}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shrink-0 group',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 hover:border-primary/30 hover:bg-muted/50',
                  isRunning && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span>{preset.icon}</span>
                <span>{preset.name}</span>
                <span className="text-muted-foreground">{preset.workDuration / 60}+{preset.shortBreakDuration / 60}</span>
                {!isDefault && (
                  <MoreHorizontal className="h-3 w-3 ml-0.5 hover-reveal transition-opacity" />
                )}
              </button>
            </PopoverTrigger>
            {!isDefault && (
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      if (!isRunning) {
                        updateFocusPreset(preset.id, {
                          name: preset.name,
                          icon: preset.icon,
                          workDuration: pomodoroSettings.workDuration,
                          shortBreakDuration: pomodoroSettings.shortBreakDuration,
                          longBreakDuration: pomodoroSettings.longBreakDuration,
                          sessionsBeforeLongBreak: pomodoroSettings.sessionsBeforeLongBreak,
                          autoStartBreak,
                          autoStartWork,
                          soundEnabled,
                          color: preset.color,
                        })
                      }
                    }}
                    className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                  >
                    <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                    更新为当前设置
                  </button>
                  <button
                    onClick={() => {
                      deleteFocusPreset(preset.id)
                    }}
                    className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除预设
                  </button>
                </div>
              </PopoverContent>
            )}
          </Popover>
        )
      })}
      <button
        onClick={() => {
          if (!isRunning) {
            addFocusPreset({
              name: '自定义模式',
              icon: '⚙️',
              workDuration: pomodoroSettings.workDuration,
              shortBreakDuration: pomodoroSettings.shortBreakDuration,
              longBreakDuration: pomodoroSettings.longBreakDuration,
              sessionsBeforeLongBreak: pomodoroSettings.sessionsBeforeLongBreak,
              autoStartBreak,
              autoStartWork,
              soundEnabled,
              color: COLOR_PALETTE[7],
            })
          }
        }}
        disabled={isRunning}
        className={cn(
          'flex items-center gap-1 rounded-lg border border-dashed border-border/50 px-3 py-1.5 text-xs text-muted-foreground transition-all shrink-0 hover:border-primary/30 hover:text-primary',
          isRunning && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Plus className="h-3 w-3" />
        保存当前
      </button>
    </div>
  )
}
