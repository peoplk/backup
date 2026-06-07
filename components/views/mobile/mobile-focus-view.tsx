'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { completePomodoroSession } from '@/lib/pomodoro-completion'
import { useDataLink } from '@/lib/data-link-service'
import {
  Play, Pause, RotateCcw, SkipForward, Coffee, TreeDeciduous, Brain, Target,
  CheckCircle2, VolumeX, Music, Clock, StopCircle, Settings2, ChevronDown,
  Flame, BarChart3, ListChecks
} from 'lucide-react'

const MODE_CONFIG = {
  work: { label: '专注', color: 'text-primary', ringColor: 'stroke-primary', icon: Brain, bgColor: 'bg-primary' },
  'short-break': { label: '短休息', color: 'text-green-500', ringColor: 'stroke-green-500', icon: Coffee, bgColor: 'bg-green-500' },
  'long-break': { label: '长休息', color: 'text-blue-500', ringColor: 'stroke-blue-500', icon: TreeDeciduous, bgColor: 'bg-blue-500' },
}

const AMBIENT_SOUNDS = [
  { id: 'rain', label: '雨声', emoji: '🌧️' },
  { id: 'forest', label: '森林', emoji: '🌲' },
  { id: 'ocean', label: '海浪', emoji: '🌊' },
  { id: 'fire', label: '篝火', emoji: '🔥' },
  { id: 'cafe', label: '咖啡馆', emoji: '☕' },
  { id: 'wind', label: '风声', emoji: '💨' },
]

const BINAURAL_BEATS = [
  { id: 'alpha', label: 'Alpha', desc: '放松专注', freq: 10, emoji: '🧠' },
  { id: 'beta', label: 'Beta', desc: '高效工作', freq: 20, emoji: '⚡' },
  { id: 'theta', label: 'Theta', desc: '深度冥想', freq: 6, emoji: '🌀' },
  { id: 'gamma', label: 'Gamma', desc: '创意思维', freq: 40, emoji: '💡' },
]

const FOCUS_TABS = [
  { id: 'pomodoro' as const, label: '番茄钟', icon: Brain },
  { id: 'tracker' as const, label: '追踪', icon: Clock },
  { id: 'sound' as const, label: '白噪音', icon: Music },
]

const DURATION_PRESETS = [
  { label: '15分', seconds: 15 * 60 },
  { label: '25分', seconds: 25 * 60 },
  { label: '30分', seconds: 30 * 60 },
  { label: '45分', seconds: 45 * 60 },
  { label: '60分', seconds: 60 * 60 },
  { label: '90分', seconds: 90 * 60 },
]

export function MobileFocusView() {
  const {
    pomodoroTimerState, pomodoroSettings, updatePomodoroSettings, updatePomodoroTimerState,
    tasks, pomodoroSessions, projects, timeEntries, addTimeEntry, focusGoals
  } = useAppStore(useShallow(state => ({
    pomodoroTimerState: state.pomodoroTimerState,
    pomodoroSettings: state.pomodoroSettings,
    updatePomodoroSettings: state.updatePomodoroSettings,
    updatePomodoroTimerState: state.updatePomodoroTimerState,
    tasks: state.tasks,
    pomodoroSessions: state.pomodoroSessions,
    projects: state.projects,
    timeEntries: state.timeEntries,
    addTimeEntry: state.addTimeEntry,
    focusGoals: state.focusGoals,
  })))

  const [activeTab, setActiveTab] = useState<'pomodoro' | 'tracker' | 'sound'>('pomodoro')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const [showDurationPicker, setShowDurationPicker] = useState(false)
  const [showTaskPicker, setShowTaskPicker] = useState(false)

  const [trackerRunning, setTrackerRunning] = useState(false)
  const [trackerStart, setTrackerStart] = useState<number>(0)
  const [trackerElapsed, setTrackerElapsed] = useState(0)
  const [trackerProject, setTrackerProject] = useState('')
  const [trackerDesc, setTrackerDesc] = useState('')
  const trackerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [activeSound, setActiveSound] = useState<string | null>(null)
  const [activeBeat, setActiveBeat] = useState<string | null>(null)
  const [soundVolume, setSoundVolume] = useState(0.5)
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorNodesRef = useRef<OscillatorNode[]>([])
  const gainNodeRef = useRef<GainNode | null>(null)

  const dataLink = useDataLink()

  const { mode, timeLeft, isRunning, completedSessions, selectedTaskId } = pomodoroTimerState
  const config = MODE_CONFIG[mode]
  const ModeIcon = config.icon

  const totalDuration = mode === 'work'
    ? pomodoroSettings.workDuration
    : mode === 'short-break'
    ? pomodoroSettings.shortBreakDuration
    : pomodoroSettings.longBreakDuration

  const progress = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 0
  const selectedTask = tasks.find(t => t.id === selectedTaskId)

  const todaySessions = pomodoroSessions.filter(
    s => new Date(s.completedAt).toDateString() === new Date().toDateString() && s.type === 'work'
  )
  const todaySessionCount = todaySessions.length
  const todayFocusMinutes = Math.round(todaySessions.reduce((a, s) => a + s.duration, 0) / 60)

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1))
  weekStart.setHours(0, 0, 0, 0)
  const weekSessions = pomodoroSessions.filter(s => s.type === 'work' && new Date(s.completedAt) >= weekStart)
  const weekFocusMinutes = Math.round(weekSessions.reduce((a, s) => a + s.duration, 0) / 60)

  const todayEntries = timeEntries.filter(
    e => new Date(e.startTime).toDateString() === new Date().toDateString()
  )
  const todayTotalMinutes = Math.round(todayEntries.reduce((acc, e) => acc + (e.duration || 0), 0) / 60)

  const pendingTasks = tasks.filter(t => t.status !== 'done')

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
  }

  const formatElapsed = (ms: number) => {
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0')
    const s = (totalSec % 60).toString().padStart(2, '0')
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
  }

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        const state = useAppStore.getState().pomodoroTimerState
        if (state.timeLeft <= 1) {
          const finishedMode = state.mode
          const finishedDuration = finishedMode === 'work'
            ? state.timeLeft > 0 ? pomodoroSettings.workDuration : pomodoroSettings.workDuration
            : finishedMode === 'short-break'
            ? pomodoroSettings.shortBreakDuration
            : pomodoroSettings.longBreakDuration
          const currentDuration = finishedMode === 'work'
            ? pomodoroSettings.workDuration
            : finishedMode === 'short-break'
            ? pomodoroSettings.shortBreakDuration
            : pomodoroSettings.longBreakDuration

          const result = completePomodoroSession({
            mode: finishedMode,
            duration: currentDuration,
            selectedTaskId: state.selectedTaskId,
          })

          if (result.sessionId) {
            dataLink.handlePomodoroCompletion(
              result.sessionId,
              currentDuration,
              finishedMode,
              state.selectedTaskId || undefined
            )
          }

          if (result.taskEstimatedReached && state.selectedTaskId) {
            dataLink.handleTaskCompletion(state.selectedTaskId)
          }

          const nextMode = state.mode === 'work'
            ? ((state.completedSessions + 1) % pomodoroSettings.sessionsBeforeLongBreak === 0 ? 'long-break' : 'short-break')
            : 'work'
          const nextDuration = nextMode === 'work'
            ? pomodoroSettings.workDuration
            : nextMode === 'short-break'
            ? pomodoroSettings.shortBreakDuration
            : pomodoroSettings.longBreakDuration
          updatePomodoroTimerState({
            isRunning: false,
            mode: nextMode,
            timeLeft: nextDuration,
            completedSessions: state.mode === 'work' ? state.completedSessions + 1 : state.completedSessions,
          })

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              if (finishedMode === 'work') {
                new Notification('🍅 专注完成', { body: `已完成 ${Math.round(currentDuration / 60)} 分钟专注` })
              } else {
                new Notification('☕ 休息结束', { body: '开始下一轮专注吧' })
              }
            } catch {}
          }
        } else {
          updatePomodoroTimerState({ timeLeft: state.timeLeft - 1 })
        }
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning, pomodoroSettings, updatePomodoroTimerState, dataLink])

  useEffect(() => {
    if (trackerRunning) {
      trackerIntervalRef.current = setInterval(() => {
        setTrackerElapsed(Date.now() - trackerStart)
      }, 1000)
    } else {
      if (trackerIntervalRef.current) clearInterval(trackerIntervalRef.current)
    }
    return () => { if (trackerIntervalRef.current) clearInterval(trackerIntervalRef.current) }
  }, [trackerRunning, trackerStart])

  const handleReset = () => updatePomodoroTimerState({ isRunning: false, timeLeft: totalDuration })

  const handleSkip = () => {
    if (mode === 'work') {
      const nextBreak = (completedSessions + 1) % pomodoroSettings.sessionsBeforeLongBreak === 0
      updatePomodoroTimerState({
        isRunning: false,
        mode: nextBreak ? 'long-break' : 'short-break',
        timeLeft: nextBreak ? pomodoroSettings.longBreakDuration : pomodoroSettings.shortBreakDuration,
      })
    } else {
      updatePomodoroTimerState({ isRunning: false, mode: 'work', timeLeft: pomodoroSettings.workDuration })
    }
  }

  const handleDurationSelect = (seconds: number) => {
    updatePomodoroSettings({ workDuration: seconds })
    updatePomodoroTimerState({ isRunning: false, timeLeft: seconds })
    setShowDurationPicker(false)
  }

  const handleTaskSelect = (taskId: string | null) => {
    updatePomodoroTimerState({ selectedTaskId: taskId })
    setShowTaskPicker(false)
  }

  const handleStartTracker = () => {
    setTrackerRunning(true)
    setTrackerStart(Date.now())
    setTrackerElapsed(0)
  }

  const handleStopTracker = () => {
    setTrackerRunning(false)
    const durationSec = Math.round(trackerElapsed / 1000)
    if (durationSec > 0) {
      const projectMatch = trackerProject
        ? projects.find(p => p.name === trackerProject)
        : null
      const newId = addTimeEntry({
        description: trackerDesc,
        project: trackerProject || '',
        projectId: projectMatch?.id,
        duration: durationSec,
        startTime: new Date(trackerStart),
        endTime: new Date(),
      })
      if (newId) {
        const stored = useAppStore.getState().timeEntries.find(e => e.id === newId)
        if (stored) dataLink.handleTimeEntryAdded(stored)
      }
    }
    setTrackerDesc('')
    setTrackerProject('')
    setTrackerElapsed(0)
  }

  const stopAllAudio = useCallback(() => {
    oscillatorNodesRef.current.forEach(osc => { try { osc.stop() } catch {} })
    oscillatorNodesRef.current = []
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setActiveSound(null)
    setActiveBeat(null)
  }, [])

  const playBinauralBeat = useCallback((beatId: string, freq: number) => {
    stopAllAudio()
    try {
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const gain = ctx.createGain()
      gain.gain.value = soundVolume * 0.3
      gain.connect(ctx.destination)
      gainNodeRef.current = gain

      const oscL = ctx.createOscillator()
      oscL.frequency.value = 200
      oscL.connect(gain)
      oscL.start()

      const oscR = ctx.createOscillator()
      oscR.frequency.value = 200 + freq
      const merger = ctx.createChannelMerger(2)
      const gainL = ctx.createGain()
      const gainR = ctx.createGain()
      gainL.gain.value = 1
      gainR.gain.value = 1
      oscL.connect(gainL)
      oscR.connect(gainR)
      gainL.connect(merger, 0, 0)
      gainR.connect(merger, 0, 1)
      merger.connect(gain)
      oscR.start()

      oscillatorNodesRef.current = [oscL, oscR]
      setActiveBeat(beatId)
    } catch {}
  }, [soundVolume, stopAllAudio])

  const playAmbientSound = useCallback((soundId: string) => {
    stopAllAudio()
    try {
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const gain = ctx.createGain()
      gain.gain.value = soundVolume * 0.15
      gain.connect(ctx.destination)
      gainNodeRef.current = gain

      const bufferSize = 2 * ctx.sampleRate
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1)
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      switch (soundId) {
        case 'rain': filter.frequency.value = 800; break
        case 'forest': filter.frequency.value = 2000; break
        case 'ocean': filter.frequency.value = 500; break
        case 'fire': filter.frequency.value = 600; break
        case 'cafe': filter.frequency.value = 3000; break
        case 'wind': filter.frequency.value = 400; break
        default: filter.frequency.value = 1000
      }
      source.connect(filter)
      filter.connect(gain)
      source.start()
      oscillatorNodesRef.current = [source as any]
      setActiveSound(soundId)
    } catch {}
  }, [soundVolume, stopAllAudio])

  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.value = soundVolume * 0.3
    }
  }, [soundVolume])

  useEffect(() => {
    return () => { stopAllAudio() }
  }, [stopAllAudio])

  const circumference = 2 * Math.PI * 120
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const currentDurationMin = Math.round(pomodoroSettings.workDuration / 60)
  const focusGoalPercent = (focusGoals?.dailyMinutes || 120) > 0
    ? Math.min(100, Math.round((todayFocusMinutes / (focusGoals?.dailyMinutes || 120)) * 100))
    : 0

  return (
    <div>
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-border/40 bg-background status-bar-safe">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/60">
          {FOCUS_TABS.map(tab => (
            <button
              key={tab.id}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all active:scale-95',
                activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-24">
        {activeTab === 'pomodoro' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative mb-6">
                <svg width="240" height="240" className="transform -rotate-90">
                  <circle cx="120" cy="120" r="108" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="5" />
                  <circle
                    cx="120" cy="120" r="108" fill="none"
                    className={config.ringColor}
                    strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 108}
                    strokeDashoffset={2 * Math.PI * 108 - (progress / 100) * 2 * Math.PI * 108}
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <ModeIcon className={cn('h-5 w-5 mb-1.5', config.color)} />
                  <span className={cn('text-4xl font-bold font-[var(--font-timer)] tabular-nums', config.color)}>
                    {formatTime(timeLeft)}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5">{config.label}</span>
                </div>
              </div>

              <div className="flex items-center gap-6 mb-4">
                <button className="h-11 w-11 rounded-full bg-muted/50 flex items-center justify-center active:scale-90 transition-transform" onClick={handleReset}>
                  <RotateCcw className="h-5 w-5 text-muted-foreground" />
                </button>
                <button
                  className={cn('h-14 w-14 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform', config.bgColor, 'text-white')}
                  onClick={() => updatePomodoroTimerState({ isRunning: !isRunning })}
                >
                  {isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
                </button>
                <button className="h-11 w-11 rounded-full bg-muted/50 flex items-center justify-center active:scale-90 transition-transform" onClick={handleSkip}>
                  <SkipForward className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <button
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95',
                    'bg-muted/50 text-muted-foreground'
                  )}
                  onClick={() => setShowDurationPicker(!showDurationPicker)}
                >
                  <Settings2 className="h-3 w-3" />
                  {currentDurationMin}分钟
                  <ChevronDown className={cn('h-3 w-3 transition-transform', showDurationPicker && 'rotate-180')} />
                </button>

                <button
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95',
                    selectedTask ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
                  )}
                  onClick={() => setShowTaskPicker(!showTaskPicker)}
                >
                  <ListChecks className="h-3 w-3" />
                  {selectedTask ? selectedTask.title.slice(0, 8) : '关联任务'}
                </button>
              </div>

              {showDurationPicker && !isRunning && (
                <div className="flex flex-wrap justify-center gap-2 mb-3 animate-fade-in-up">
                  {DURATION_PRESETS.map(preset => (
                    <button
                      key={preset.seconds}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95',
                        pomodoroSettings.workDuration === preset.seconds
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground'
                      )}
                      onClick={() => handleDurationSelect(preset.seconds)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}

              {showTaskPicker && (
                <div className="w-full max-w-[300px] glass-card rounded-2xl p-3 mb-3 max-h-[200px] overflow-y-auto animate-fade-in-up">
                  <button
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all active:scale-95',
                      !selectedTaskId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'
                    )}
                    onClick={() => handleTaskSelect(null)}
                  >
                    不关联任务
                  </button>
                  {pendingTasks.slice(0, 10).map(task => (
                    <button
                      key={task.id}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all active:scale-95 text-left',
                        selectedTaskId === task.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'
                      )}
                      onClick={() => handleTaskSelect(task.id)}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0',
                        task.priority === 'urgent' ? 'bg-red-500' :
                        task.priority === 'high' ? 'bg-orange-500' :
                        task.priority === 'medium' ? 'bg-blue-500' : 'bg-gray-400'
                      )} />
                      <span className="truncate">{task.title}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span>今日 {todaySessionCount} 个</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span>本轮 {completedSessions}/{pomodoroSettings.sessionsBeforeLongBreak}</span>
                </div>
              </div>

              {(activeSound || activeBeat) && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-card mt-3">
                  <Music className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs">
                    {activeBeat ? BINAURAL_BEATS.find(b => b.id === activeBeat)?.label : AMBIENT_SOUNDS.find(s => s.id === activeSound)?.label}
                  </span>
                  <button className="text-xs text-red-500" onClick={stopAllAudio}>停止</button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="glass-card rounded-2xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-[10px] text-muted-foreground">今日</span>
                </div>
                <p className="text-lg font-bold">{todayFocusMinutes}<span className="text-xs font-normal text-muted-foreground">分</span></p>
              </div>
              <div className="glass-card rounded-2xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-[10px] text-muted-foreground">本周</span>
                </div>
                <p className="text-lg font-bold">{weekFocusMinutes}<span className="text-xs font-normal text-muted-foreground">分</span></p>
              </div>
              <div className="glass-card rounded-2xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] text-muted-foreground">目标</span>
                </div>
                <p className="text-lg font-bold">{focusGoalPercent}<span className="text-xs font-normal text-muted-foreground">%</span></p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tracker' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold font-[var(--font-timer)] tabular-nums mb-1">
                {trackerRunning ? formatElapsed(trackerElapsed) : '00:00'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {trackerRunning ? '正在记录...' : '准备开始'}
              </p>

              <div className="space-y-2.5 mb-4">
                <input
                  type="text"
                  placeholder="正在做什么..."
                  className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  value={trackerDesc}
                  onChange={e => setTrackerDesc(e.target.value)}
                />
                <select
                  className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none"
                  value={trackerProject}
                  onChange={e => setTrackerProject(e.target.value)}
                >
                  <option value="">选择项目（可选）</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {trackerRunning ? (
                <button
                  className="w-full h-11 rounded-2xl bg-red-500 text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  onClick={handleStopTracker}
                >
                  <StopCircle className="h-4 w-4" /> 停止记录
                </button>
              ) : (
                <button
                  className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  onClick={handleStartTracker}
                >
                  <Play className="h-4 w-4" /> 开始记录
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card rounded-2xl p-3 text-center">
                <p className="text-lg font-bold">{todayTotalMinutes}m</p>
                <p className="text-[10px] text-muted-foreground">今日工时</p>
              </div>
              <div className="glass-card rounded-2xl p-3 text-center">
                <p className="text-lg font-bold">{todayEntries.length}</p>
                <p className="text-[10px] text-muted-foreground">今日记录</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">今日记录</h3>
              {todayEntries.length > 0 ? todayEntries.map((entry, i) => (
                <div key={entry.id || i} className="glass-card rounded-xl p-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.description || '未命名记录'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {entry.project ? projects.find(p => p.id === entry.project)?.name + ' · ' : ''}
                      {Math.round((entry.duration || 0) / 60)}分钟
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">暂无记录</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'sound' && (
          <div className="space-y-5">
            <div className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">音量</h3>
                <span className="text-xs text-muted-foreground">{Math.round(soundVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0" max="100" value={soundVolume * 100}
                onChange={e => setSoundVolume(Number(e.target.value) / 100)}
                className="w-full h-1.5 rounded-full appearance-none bg-muted/50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">双耳节拍</h3>
              <div className="grid grid-cols-2 gap-3">
                {BINAURAL_BEATS.map(beat => (
                  <button
                    key={beat.id}
                    className={cn(
                      'glass-card rounded-2xl p-4 text-left active:scale-95 transition-all',
                      activeBeat === beat.id && 'ring-2 ring-primary bg-primary/5'
                    )}
                    onClick={() => activeBeat === beat.id ? stopAllAudio() : playBinauralBeat(beat.id, beat.freq)}
                  >
                    <span className="text-2xl">{beat.emoji}</span>
                    <p className="text-sm font-medium mt-2">{beat.label}波</p>
                    <p className="text-[10px] text-muted-foreground">{beat.desc} · {beat.freq}Hz</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">环境音效</h3>
              <div className="grid grid-cols-3 gap-3">
                {AMBIENT_SOUNDS.map(sound => (
                  <button
                    key={sound.id}
                    className={cn(
                      'glass-card rounded-2xl p-3 text-center active:scale-95 transition-all',
                      activeSound === sound.id && 'ring-2 ring-primary bg-primary/5'
                    )}
                    onClick={() => activeSound === sound.id ? stopAllAudio() : playAmbientSound(sound.id)}
                  >
                    <span className="text-xl">{sound.emoji}</span>
                    <p className="text-xs font-medium mt-1">{sound.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {(activeSound || activeBeat) && (
              <button
                className="w-full h-11 rounded-2xl bg-red-500/10 text-red-500 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                onClick={stopAllAudio}
              >
                <VolumeX className="h-4 w-4" /> 停止播放
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
