'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Timer, Clock, Shield } from 'lucide-react'
import { PomodoroTimer } from '@/components/focus/pomodoro-timer'
import { TimeTracker } from '@/components/focus/time-tracker'
import { FocusShield } from '@/components/focus/focus-shield'

export function FocusView() {
  const [activeTab, setActiveTab] = useState<'pomodoro' | 'tracker' | 'shield'>('pomodoro')

  return (
    <div className="space-y-6 animate-fade-in-up">
      <p className="text-muted-foreground">番茄工作法、时间追踪与专注屏蔽，提升你的效率</p>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="pomodoro" className="gap-2">
            <Timer className="h-4 w-4" />
            番茄钟
          </TabsTrigger>
          <TabsTrigger value="tracker" className="gap-2">
            <Clock className="h-4 w-4" />
            时间追踪
          </TabsTrigger>
          <TabsTrigger value="shield" className="gap-2">
            <Shield className="h-4 w-4" />
            专注屏蔽
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pomodoro" className="mt-0">
          <PomodoroTimer />
        </TabsContent>

        <TabsContent value="tracker" className="mt-0">
          <TimeTracker />
        </TabsContent>

        <TabsContent value="shield" className="mt-0">
          <div className="max-w-2xl mx-auto">
            <FocusShield />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
