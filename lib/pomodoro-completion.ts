import { useAppStore } from '@/lib/store'

export type PomodoroMode = 'work' | 'short-break' | 'long-break'

export interface CompletePomodoroParams {
  mode: PomodoroMode
  duration: number
  selectedTaskId?: string | null
  focusNote?: string
  sessionTags?: string[]
  startTime?: Date
}

export interface CompletePomodoroResult {
  sessionId: string
  timeBlockId?: string
  timeEntryId?: string
  newCompletedPomodoros?: number
  taskEstimatedReached?: boolean
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function completePomodoroSession(params: CompletePomodoroParams): CompletePomodoroResult {
  const {
    mode,
    duration,
    selectedTaskId,
    focusNote,
    sessionTags,
    startTime,
  } = params

  const state = useAppStore.getState()
  const completedAt = new Date()
  const startedAt = startTime || new Date(completedAt.getTime() - duration * 1000)

  const sessionPayload = {
    taskId: selectedTaskId || undefined,
    type: mode,
    duration,
    note: focusNote?.trim() || undefined,
    tags: sessionTags && sessionTags.length > 0 ? sessionTags : undefined,
  }
  state.addPomodoroSession(sessionPayload)

  const latestState = useAppStore.getState()
  const createdSession = latestState.pomodoroSessions[latestState.pomodoroSessions.length - 1]
  const sessionId = createdSession?.id || ''

  // 触发成就检查（动态 import 以避免循环依赖）
  import('./gamification').then(({ checkAchievementsNow }) => {
    checkAchievementsNow()
  })

  let timeBlockId: string | undefined
  if (mode === 'work') {
    const task = selectedTaskId
      ? latestState.tasks.find(t => t.id === selectedTaskId)
      : undefined
    const blockTitle = `🍅 专注${task ? ` · ${task.title}` : ''}`
    const block = {
      title: blockTitle,
      description: focusNote?.trim() || undefined,
      date: completedAt,
      startTime: formatTime(startedAt),
      endTime: formatTime(completedAt),
      category: 'focus' as const,
      color: '',
      taskId: selectedTaskId || undefined,
      completed: true,
    }
    latestState.addTimeBlock(block)
    const blockAfter = useAppStore.getState().timeBlocks[useAppStore.getState().timeBlocks.length - 1]
    timeBlockId = blockAfter?.id
  } else {
    const breakTitle = mode === 'short-break' ? '☕ 短休息' : '🌳 长休息'
    const breakBlock = {
      title: breakTitle,
      date: completedAt,
      startTime: formatTime(startedAt),
      endTime: formatTime(completedAt),
      category: 'break' as const,
      color: '',
      completed: true,
    }
    useAppStore.getState().addTimeBlock(breakBlock)
    timeBlockId = useAppStore.getState().timeBlocks[useAppStore.getState().timeBlocks.length - 1]?.id
  }

  let timeEntryId: string | undefined
  let newCompletedPomodoros: number | undefined
  let taskEstimatedReached = false

  if (selectedTaskId && mode === 'work') {
    const task = latestState.tasks.find(t => t.id === selectedTaskId)
    if (task) {
      newCompletedPomodoros = (task.completedPomodoros || 0) + 1
      useAppStore.getState().updateTask(selectedTaskId, {
        completedPomodoros: newCompletedPomodoros,
        timeSpent: (task.timeSpent || 0) + duration,
      })

      useAppStore.getState().addTimeEntry({
        project: task.project || '专注模式',
        description: `🍅 番茄钟 #${newCompletedPomodoros}: ${task.title}`,
        tags: task.tags || [],
        taskId: selectedTaskId,
        startTime: startedAt,
        endTime: completedAt,
        duration,
      })
      timeEntryId = useAppStore.getState().timeEntries[useAppStore.getState().timeEntries.length - 1]?.id

      if (task.estimatedPomodoros && newCompletedPomodoros >= task.estimatedPomodoros && task.status !== 'done') {
        taskEstimatedReached = true
      }
    }
  }

  return {
    sessionId,
    timeBlockId,
    timeEntryId,
    newCompletedPomodoros,
    taskEstimatedReached,
  }
}
