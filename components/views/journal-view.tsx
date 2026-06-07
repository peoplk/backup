'use client'

import { useState, useMemo } from 'react'
import { useAppStore, DailyJournal } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  BookOpen, Plus, Trash2, ChevronLeft, ChevronRight,
  Meh, Heart, ThumbsUp, Calendar, Frown, X, Edit3, CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const moods = [
  { value: 'great' as const, icon: Heart, label: '很棒', color: 'text-rose-500' },
  { value: 'good' as const, icon: ThumbsUp, label: '不错', color: 'text-green-500' },
  { value: 'neutral' as const, icon: Meh, label: '一般', color: 'text-amber-500' },
  { value: 'bad' as const, icon: Frown, label: '不好', color: 'text-blue-500' },
  { value: 'terrible' as const, icon: Frown, label: '很差', color: 'text-red-500' },
]

export function JournalView() {
  const { journals, addJournal, updateJournal, deleteJournal } = useAppStore(useShallow((state) => ({
    journals: state.journals,
    addJournal: state.addJournal,
    updateJournal: state.updateJournal,
    deleteJournal: state.deleteJournal,
  })))

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isEditing, setIsEditing] = useState(false)

  const selectedDateStr = useMemo(() => {
    const d = new Date(selectedDate)
    d.setHours(0, 0, 0, 0)
    return d.toDateString()
  }, [selectedDate])

  const todayJournal = useMemo(() => {
    return journals.find(j => new Date(j.date).toDateString() === selectedDateStr)
  }, [journals, selectedDateStr])

  const [content, setContent] = useState(todayJournal?.content || '')
  const [mood, setMood] = useState<DailyJournal['mood']>(todayJournal?.mood)
  const [gratitude, setGratitude] = useState<string[]>(todayJournal?.gratitude || [''])
  const [wins, setWins] = useState<string[]>(todayJournal?.wins || [''])

  const isToday = selectedDateStr === new Date().toDateString()

  const recentJournals = useMemo(() => {
    return journals
      .filter(j => new Date(j.date).toDateString() !== selectedDateStr)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }, [journals, selectedDateStr])

  const handleSave = () => {
    const filteredGratitude = gratitude.filter(g => g.trim())
    const filteredWins = wins.filter(w => w.trim())

    if (todayJournal) {
      updateJournal(todayJournal.id, {
        content,
        mood,
        gratitude: filteredGratitude.length > 0 ? filteredGratitude : undefined,
        wins: filteredWins.length > 0 ? filteredWins : undefined,
        updatedAt: new Date(),
      })
    } else {
      addJournal({
        date: selectedDate,
        content,
        mood,
        gratitude: filteredGratitude.length > 0 ? filteredGratitude : undefined,
        wins: filteredWins.length > 0 ? filteredWins : undefined,
      })
    }
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    setContent(todayJournal?.content || '')
    setMood(todayJournal?.mood)
    setGratitude(todayJournal?.gratitude || [''])
    setWins(todayJournal?.wins || [''])
    setIsEditing(true)
  }

  const navigateDate = (offset: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    setSelectedDate(d)
    setIsEditing(false)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })
  }

  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">每日日记</h2>
          <p className="text-xs text-muted-foreground">记录心情，回顾成长</p>
        </div>
        <button
          className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1.5 active:scale-95 transition-transform"
          onClick={handleStartEdit}
        >
          <Plus className="h-4 w-4" />
          {todayJournal ? '编辑' : '写日记'}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center active:scale-90 transition-transform" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium">{formatDate(selectedDate)}</p>
          {isToday && <span className="text-[10px] text-primary font-medium">今天</span>}
        </div>
        <button className={cn('h-9 w-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform', isToday ? 'bg-muted/20 opacity-30' : 'bg-muted/50')} onClick={() => navigateDate(1)} disabled={isToday}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">今天的心情</label>
            <div className="flex gap-2">
              {moods.map((m) => (
                <button
                  key={m.value}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all active:scale-95',
                    mood === m.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border/40 bg-muted/30'
                  )}
                  onClick={() => setMood(m.value)}
                >
                  <m.icon className={cn('h-5 w-5', m.color)} />
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">日记内容</label>
            <textarea
              placeholder="今天发生了什么？有什么想法和感受？"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full px-3 py-2.5 rounded-xl bg-muted/30 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none border border-border/20"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">🙏 感恩的事</label>
            <div className="space-y-2">
              {gratitude.map((g, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    placeholder="今天感恩的事..."
                    value={g}
                    onChange={(e) => {
                      const newGratitude = [...gratitude]
                      newGratitude[i] = e.target.value
                      setGratitude(newGratitude)
                    }}
                    className="flex-1 h-9 px-3 rounded-xl bg-muted/30 text-sm outline-none focus:ring-2 focus:ring-primary/30 border border-border/20"
                  />
                  {gratitude.length > 1 && (
                    <button className="h-9 w-9 rounded-xl bg-muted/30 flex items-center justify-center shrink-0 active:scale-90 transition-transform" onClick={() => setGratitude(gratitude.filter((_, idx) => idx !== i))}>
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
              <button className="text-xs text-primary font-medium active:scale-95 transition-transform" onClick={() => setGratitude([...gratitude, ''])}>+ 添加</button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">🏆 今天的成就</label>
            <div className="space-y-2">
              {wins.map((w, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    placeholder="今天完成的成就..."
                    value={w}
                    onChange={(e) => {
                      const newWins = [...wins]
                      newWins[i] = e.target.value
                      setWins(newWins)
                    }}
                    className="flex-1 h-9 px-3 rounded-xl bg-muted/30 text-sm outline-none focus:ring-2 focus:ring-primary/30 border border-border/20"
                  />
                  {wins.length > 1 && (
                    <button className="h-9 w-9 rounded-xl bg-muted/30 flex items-center justify-center shrink-0 active:scale-90 transition-transform" onClick={() => setWins(wins.filter((_, idx) => idx !== i))}>
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
              <button className="text-xs text-primary font-medium active:scale-95 transition-transform" onClick={() => setWins([...wins, ''])}>+ 添加</button>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-transform" onClick={handleSave}>保存</button>
            <button className="h-11 px-5 rounded-xl bg-muted/50 text-sm font-medium active:scale-[0.98] transition-transform" onClick={() => setIsEditing(false)}>取消</button>
          </div>
        </div>
      ) : todayJournal ? (
        <div className="space-y-4">
          {todayJournal.mood && (
            <div className="flex items-center gap-2">
              {(() => {
                const moodItem = moods.find(m => m.value === todayJournal.mood)
                if (!moodItem) return null
                return (
                  <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full', 'bg-muted/30')}>
                    <moodItem.icon className={cn('h-4 w-4', moodItem.color)} />
                    <span className="text-xs font-medium">{moodItem.label}</span>
                  </div>
                )
              })()}
            </div>
          )}
          {todayJournal.content && (
            <div className="rounded-2xl bg-muted/20 p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{todayJournal.content}</p>
            </div>
          )}
          {todayJournal.gratitude && todayJournal.gratitude.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">🙏 感恩的事</h4>
              <div className="space-y-1.5">
                {todayJournal.gratitude.map((g, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5">•</span>
                    <span className="text-muted-foreground">{g}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {todayJournal.wins && todayJournal.wins.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">🏆 今天的成就</h4>
              <div className="space-y-1.5">
                {todayJournal.wins.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button className="h-9 px-4 rounded-xl bg-muted/50 text-sm font-medium flex items-center gap-1.5 active:scale-95 transition-transform" onClick={handleStartEdit}>
              <Edit3 className="h-3.5 w-3.5" /> 编辑
            </button>
            <button className="h-9 px-4 rounded-xl bg-red-500/10 text-red-500 text-sm font-medium active:scale-95 transition-transform" onClick={() => deleteJournal(todayJournal.id)}>删除</button>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {isToday ? '今天还没有写日记' : '这天没有日记'}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">点击"写日记"开始记录</p>
          <button
            className="mt-4 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5 active:scale-95 transition-transform"
            onClick={handleStartEdit}
          >
            <Plus className="h-4 w-4" />
            开始写日记
          </button>
        </div>
      )}

      {recentJournals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            最近日记
          </h3>
          <div className="space-y-2">
            {recentJournals.map(journal => {
              const journalMood = moods.find(m => m.value === journal.mood)
              return (
                <button
                  key={journal.id}
                  className="w-full text-left rounded-2xl border border-border/30 p-3 active:scale-[0.98] transition-all bg-muted/10"
                  onClick={() => {
                    setSelectedDate(new Date(journal.date))
                    setIsEditing(false)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {new Date(journal.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })}
                    </span>
                    {journalMood && <journalMood.icon className={cn('h-4 w-4', journalMood.color)} />}
                  </div>
                  {journal.content && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{journal.content}</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
