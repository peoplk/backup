'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, CheckCircle2, Calendar, Heart, Clock, Timer, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const { tasks, habits, anniversaries, timeEntries, setActiveView } = useAppStore()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    if (!query.trim()) return { tasks: [], habits: [], anniversaries: [], timeEntries: [] }

    const q = query.toLowerCase()

    return {
      tasks: tasks.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.description?.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      ).slice(0, 5),
      habits: habits.filter(h => 
        h.name.toLowerCase().includes(q)
      ).slice(0, 5),
      anniversaries: anniversaries.filter(a => 
        a.title.toLowerCase().includes(q)
      ).slice(0, 5),
      timeEntries: timeEntries.filter(e => 
        e.description?.toLowerCase().includes(q) ||
        e.project.toLowerCase().includes(q)
      ).slice(0, 5),
    }
  }, [query, tasks, habits, anniversaries, timeEntries])

  const totalResults = results.tasks.length + results.habits.length + results.anniversaries.length + results.timeEntries.length

  const handleSelect = (type: string) => {
    switch (type) {
      case 'tasks':
        setActiveView('tasks')
        break
      case 'habits':
        setActiveView('habits')
        break
      case 'anniversaries':
        setActiveView('anniversaries')
        break
      case 'time-tracking':
        setActiveView('focus')
        break
    }
    onOpenChange(false)
    setQuery('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg">
        <div className="flex items-center border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground mr-3" />
          <Input
            placeholder="搜索任务、习惯、纪念日..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-none shadow-none focus-visible:ring-0 h-12"
            autoFocus
          />
        </div>

        {query.trim() && (
          <div className="max-h-[400px] overflow-y-auto">
            {totalResults === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Search className="mx-auto h-8 w-8 opacity-50 mb-2" />
                <p className="text-sm">未找到相关结果</p>
              </div>
            ) : (
              <div className="py-2">
                {results.tasks.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3" />
                      任务 ({results.tasks.length})
                    </div>
                    {results.tasks.map((task) => (
                      <button
                        key={task.id}
                        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => handleSelect('tasks')}
                      >
                        <div className={cn(
                          'h-2 w-2 rounded-full shrink-0',
                          task.priority === 'urgent' ? 'bg-destructive' :
                          task.priority === 'high' ? 'bg-chart-3' :
                          task.priority === 'medium' ? 'bg-chart-1' : 'bg-muted-foreground'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.status === 'done' ? '已完成' : task.status === 'in-progress' ? '进行中' : '待办'}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}

                {results.habits.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <Timer className="h-3 w-3" />
                      习惯 ({results.habits.length})
                    </div>
                    {results.habits.map((habit) => (
                      <button
                        key={habit.id}
                        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => handleSelect('habits')}
                      >
                        <span className="text-lg">{habit.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{habit.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {habit.frequency === 'daily' ? '每日' : habit.frequency === 'weekly' ? '每周' : '每月'}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}

                {results.anniversaries.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <Heart className="h-3 w-3" />
                      纪念日 ({results.anniversaries.length})
                    </div>
                    {results.anniversaries.map((anniversary) => (
                      <button
                        key={anniversary.id}
                        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => handleSelect('anniversaries')}
                      >
                        <span className="text-lg">{anniversary.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{anniversary.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(anniversary.date).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}

                {results.timeEntries.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      时间记录 ({results.timeEntries.length})
                    </div>
                    {results.timeEntries.map((entry) => (
                      <button
                        key={entry.id}
                        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => handleSelect('time-tracking')}
                      >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.description || entry.project}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.project} · {Math.floor(entry.duration / 60)}分钟
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {query.trim() && totalResults > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            找到 {totalResults} 个结果
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
