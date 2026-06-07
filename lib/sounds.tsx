'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

type SoundType = 'work-complete' | 'break-complete' | 'notification' | 'achievement'

const SOUND_URLS: Record<SoundType, string> = {
  'work-complete': 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVw7UZmzq4ZQODJ7m8q+lFg0KHuayrWQUTQwd5jItJFXMzJzmcSwkVYzMnOWw6+RVDUwd5a+r5NWMjJ2l7uvk1YxMHmXvK+TVjIweZe8r5NWMjB5l7yvk1YyMHmXvK+TVjIweZe8r5NWMjB5l7yvk1YyMHmXvK+TVjIweZe8r5NWMg==',
  'break-complete': 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVw7UZmzq4ZQODJ7m8q+lFg0KHuayrWQUTQwd5jItJFXMzJzmcSwkVYzMnOWw6+RVDUwd5a+r5NWMjJ2l7uvk1YxMHmXvK+TVjIweZe8r5NWMjB5l7yvk1YyMHmXvK+TVjIweZe8r5NWMjB5l7yvk1YyMHmXvK+TVjIweZe8r5NWMg==',
  'notification': 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVw7UZmzq4ZQODJ7m8q+lFg0KHuayrWQUTQwd5jItJFXMzJzmcSwkVYzMnOWw6+RVDUwd5a+r5NWMjJ2l7uvk1YxMHmXvK+TVjIweZe8r5NWMjB5l7yvk1YyMHmXvK+TVjIweZe8r5NWMjB5l7yvk1YyMHmXvK+TVjIweZe8r5NWMg==',
  'achievement': 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVw7UZmzq4ZQODJ7m8q+lFg0KHuayrWQUTQwd5jItJFXMzJzmcSwkVYzMnOWw6+RVDUwd5a+r5NWMjJ2l7uvk1YxMHmXvK+TVjIweZe8r5NWMjB5l7yvk1YyMHmXvK+TVjIweZe8r5NWMjB5l7yvk1YyMHmXvK+TVjIweZe8r5NWMg==',
}

export function useSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { pomodoroSettings } = useAppStore()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio()
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const play = useCallback((type: SoundType) => {
    if (!audioRef.current) return

    try {
      audioRef.current.src = SOUND_URLS[type]
      audioRef.current.volume = 0.5
      audioRef.current.play().catch(() => {
      })
    } catch {
    }
  }, [])

  const playWorkComplete = useCallback(() => play('work-complete'), [play])
  const playBreakComplete = useCallback(() => play('break-complete'), [play])
  const playNotification = useCallback(() => play('notification'), [play])
  const playAchievement = useCallback(() => play('achievement'), [play])

  return {
    play,
    playWorkComplete,
    playBreakComplete,
    playNotification,
    playAchievement,
  }
}

export function SoundSettings() {
  const [enabled, setEnabled] = useState(true)
  const { playNotification } = useSound()

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">声音提醒</p>
        <p className="text-sm text-muted-foreground">完成任务时播放提示音</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => playNotification()}
        >
          测试
        </Button>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>
    </div>
  )
}
