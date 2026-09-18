'use client'

import { useState } from 'react'
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
import { PomodoroSettings, PomodoroStrictMode } from '@/lib/types'
import { SOUND_PRESETS, playPresetSound, type SoundPresetId } from '@/lib/focus-sound-engine'
import { Settings, Play, Lock, ShieldCheck, Moon, BellOff } from 'lucide-react'

interface TimerSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pomodoroSettings: PomodoroSettings
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void
  autoStartBreak: boolean
  autoStartWork: boolean
  strictMode: PomodoroStrictMode
  updateStrictMode: (updates: Partial<PomodoroStrictMode>) => void
}

export function TimerSettingsDialog({
  open,
  onOpenChange,
  pomodoroSettings,
  updatePomodoroSettings,
  autoStartBreak,
  autoStartWork,
  strictMode,
  updateStrictMode,
}: TimerSettingsDialogProps) {
  const currentSound = (pomodoroSettings.notificationSound || 'classic') as SoundPresetId
  // 全屏严格模式的系统级锁定（kiosk / 防休眠）仅桌面端可用
  const [isElectron] = useState(
    () => typeof window !== 'undefined' && !!window.electronAPI?.setStrictLock
  )

  const strict = {
    fullscreenLock: strictMode.fullscreenLock ?? false,
    holdSeconds: strictMode.fullscreenGiveUpHoldSeconds ?? 3,
    shield: strictMode.fullscreenShield ?? true,
    preventSleep: strictMode.fullscreenPreventSleep ?? true,
    muteNotifications: strictMode.fullscreenMuteNotifications ?? true,
  }

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
            {isElectron && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">专注时保持屏幕常亮</p>
                  <p className="text-xs text-muted-foreground">专注计时期间阻止系统息屏（仅桌面端）</p>
                </div>
                <Switch
                  checked={!!pomodoroSettings.keepScreenAwake}
                  onCheckedChange={(checked) =>
                    updatePomodoroSettings({ keepScreenAwake: checked })
                  }
                />
              </div>
            )}
          </div>
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">严格模式</p>
                <p className="text-xs text-muted-foreground">限制每日专注次数，防止中途放弃</p>
              </div>
              <Switch
                checked={strictMode.enabled}
                onCheckedChange={(checked) => updateStrictMode({ enabled: checked })}
              />
            </div>

            {strictMode.enabled && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    每日番茄上限: {strictMode.maxSessionsPerDay} 个
                  </label>
                  <Slider
                    value={[strictMode.maxSessionsPerDay]}
                    min={1}
                    max={20}
                    step={1}
                    onValueChange={([value]) =>
                      updateStrictMode({ maxSessionsPerDay: value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    达到上限后无法开启新的专注时段
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">锁定到本轮结束</p>
                    <p className="text-xs text-muted-foreground">
                      专注开始后禁用重置与跳过（允许暂停）
                    </p>
                  </div>
                  <Switch
                    checked={strictMode.lockUntilSessionEnd}
                    onCheckedChange={(checked) =>
                      updateStrictMode({ lockUntilSessionEnd: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">全屏严格模式</p>
                      <p className="text-xs text-muted-foreground">
                        全屏后锁定窗口，只能长按放弃退出
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={strict.fullscreenLock}
                    onCheckedChange={(checked) =>
                      updateStrictMode({ fullscreenLock: checked })
                    }
                  />
                </div>

                {strict.fullscreenLock && (
                  <div className="space-y-4 border-t pt-3">
                    {!isElectron && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        当前为浏览器环境：无法调用系统级窗口锁定，仅启用界面层面的锁定与放弃确认。
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">自动开启专注屏蔽</p>
                          <p className="text-xs text-muted-foreground">
                            按「专注屏蔽」中的网站与应用规则生效
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={strict.shield}
                        onCheckedChange={(checked) =>
                          updateStrictMode({ fullscreenShield: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">阻止系统休眠</p>
                          <p className="text-xs text-muted-foreground">
                            专注期间保持屏幕常亮
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={strict.preventSleep}
                        onCheckedChange={(checked) =>
                          updateStrictMode({ fullscreenPreventSleep: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BellOff className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">静默其他通知</p>
                          <p className="text-xs text-muted-foreground">
                            锁定期间暂停任务/习惯等提醒
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={strict.muteNotifications}
                        onCheckedChange={(checked) =>
                          updateStrictMode({ fullscreenMuteNotifications: checked })
                        }
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-medium">
                        放弃需长按:{' '}
                        {strict.holdSeconds === 0 ? '不允许放弃' : `${strict.holdSeconds} 秒`}
                      </label>
                      <Slider
                        value={[strict.holdSeconds]}
                        min={0}
                        max={10}
                        step={1}
                        onValueChange={([value]) =>
                          updateStrictMode({ fullscreenGiveUpHoldSeconds: value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        0 表示必须走完本轮，中途无法退出全屏
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
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
