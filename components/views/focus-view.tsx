'use client'

import { useState } from 'react'
import { ViewTabs, ViewTabsContent, ViewTabsList, ViewTabsTrigger } from '@/components/ui/view-tabs'
import { Timer, Clock, Shield } from 'lucide-react'
import { PomodoroTimer } from '@/components/focus/pomodoro-timer'
import { TimeTracker } from '@/components/focus/time-tracker'
import { FocusShield } from '@/components/focus/focus-shield'

export function FocusView() {
  const [activeTab, setActiveTab] = useState<'pomodoro' | 'tracker' | 'shield'>('pomodoro')

  return (
    <div className="space-y-6 view-enter">
      <p className="text-muted-foreground">番茄工作法、时间追踪与专注屏蔽，提升你的效率</p>

      <ViewTabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <ViewTabsList>
          <ViewTabsTrigger value="pomodoro">
            <Timer className="h-4 w-4" />
            番茄钟
          </ViewTabsTrigger>
          <ViewTabsTrigger value="tracker">
            <Clock className="h-4 w-4" />
            时间追踪
          </ViewTabsTrigger>
          <ViewTabsTrigger value="shield">
            <Shield className="h-4 w-4" />
            专注屏蔽
          </ViewTabsTrigger>
        </ViewTabsList>

        <ViewTabsContent value="pomodoro">
          <PomodoroTimer />
        </ViewTabsContent>

        <ViewTabsContent value="tracker">
          <TimeTracker />
        </ViewTabsContent>

        <ViewTabsContent value="shield">
          <div className="max-w-2xl mx-auto">
            <FocusShield />
          </div>
        </ViewTabsContent>
      </ViewTabs>
    </div>
  )
}
