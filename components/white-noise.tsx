'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import {
  Volume2,
  VolumeX,
  CloudRain,
  Trees,
  Waves,
  Wind,
  Flame,
  Coffee,
  Music,
  Play,
  Pause,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWhiteNoiseContext } from '@/lib/white-noise-context'

const ICON_MAP: Record<string, React.ReactNode> = {
  white: <Music className="h-5 w-5" />,
  pink: <Music className="h-5 w-5" />,
  brown: <Music className="h-5 w-5" />,
  rain: <CloudRain className="h-5 w-5" />,
  ocean: <Waves className="h-5 w-5" />,
  forest: <Trees className="h-5 w-5" />,
  fire: <Flame className="h-5 w-5" />,
  cafe: <Coffee className="h-5 w-5" />,
  wind: <Wind className="h-5 w-5" />,
}

// 为了保持向后兼容，仍然导出 useWhiteNoise，但内部使用 Context
export function useWhiteNoise() {
  return useWhiteNoiseContext()
}

interface WhiteNoisePlayerProps {
  compact?: boolean
}

export function WhiteNoisePlayer({ compact = false }: WhiteNoisePlayerProps) {
  const {
    activeNoises,
    volumes,
    isPlaying,
    toggleNoise,
    setVolume,
    togglePlayPause,
    stopAll,
    noises,
  } = useWhiteNoiseContext()

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant={isPlaying ? 'default' : 'outline'}
          size="sm"
          onClick={togglePlayPause}
          className="gap-2"
        >
          {isPlaying ? (
            <>
              <Pause className="h-4 w-4" />
              暂停白噪音
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              播放白噪音
            </>
          )}
        </Button>
        {activeNoises.size > 0 && (
          <Badge variant="secondary" className="gap-1">
            {activeNoises.size} 个音效
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Music className="h-5 w-5" />
            白噪音
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeNoises.size > 0 && (
              <>
                <Button
                  variant={isPlaying ? 'default' : 'outline'}
                  size="sm"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={stopAll}
                >
                  <VolumeX className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {noises.map((noise) => {
            const isActive = activeNoises.has(noise.id)
            const volume = volumes[noise.id] ?? 0.3

            return (
              <div key={noise.id} className="space-y-2">
                <button
                  onClick={() => toggleNoise(noise.id)}
                  className={cn(
                    'w-full rounded-xl p-3 transition-all flex flex-col items-center gap-1',
                    isActive ? noise.color : 'bg-muted/50 hover:bg-muted'
                  )}
                >
                  {ICON_MAP[noise.id] || <Music className="h-5 w-5" />}
                  <span className="text-xs font-medium">{noise.name}</span>
                </button>
                {isActive && (
                  <div className="px-1">
                    <Slider
                      value={[volume * 100]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([v]) => setVolume(noise.id, v / 100)}
                      className="h-1"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {activeNoises.size > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                正在播放 {activeNoises.size} 个音效
              </span>
            </div>
            <Badge variant="secondary">
              {isPlaying ? '播放中' : '已暂停'}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
