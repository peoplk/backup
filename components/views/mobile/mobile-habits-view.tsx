'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { CheckCircle2, Flame, Plus, X, TrendingUp, Trash2, Edit3, Calendar, BarChart3, ChevronRight } from 'lucide-react'

const ICONS = ['📋', '💪', '📚', '🏃', '🧘', '💧', '🍎', '😴', '✍️', '🎵', '💊', '🧹', '💰', '🎯', '🌅', '🚶']
const CATEGORIES = ['生活', '健康', '学习', '工作', '运动', '其他']
const FREQUENCIES: { id: 'daily' | 'weekly' | 'monthly' | 'custom'; label: string }[] = [
  { id: 'daily', label: '每天' },
  { id: 'custom', label: '工作日' },
  { id: 'weekly', label: '每周' },
  { id: 'custom', label: '每周3次' },
]

export function MobileHabitsView() {
  const { habits, habitCheckIns, addHabit, deleteHabit, updateHabit, checkInHabit } = useAppStore(
    useShallow(state => ({
      habits: state.habits,
      habitCheckIns: state.habitCheckIns,
      addHabit: state.addHabit,
      deleteHabit: state.deleteHabit,
      updateHabit: state.updateHabit,
      checkInHabit: state.checkInHabit,
    }))
  )

  const [showAddSheet, setShowAddSheet] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📋')
  const [newCategory, setNewCategory] = useState('生活')
  const [newFrequency, setNewFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily')

  const [detailHabitId, setDetailHabitId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('📋')
  const [editCategory, setEditCategory] = useState('生活')
  const [editFrequency, setEditFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily')

  const todayStr = new Date().toDateString()

  const todayCheckIns = useMemo(() => {
    return habitCheckIns.filter(h => new Date(h.date).toDateString() === todayStr)
  }, [habitCheckIns, todayStr])

  const activeHabits = habits.filter(h => !h.archived)

  const completedToday = activeHabits.filter(h =>
    todayCheckIns.some(c => c.habitId === h.id)
  ).length

  const todayPercent = activeHabits.length > 0 ? Math.round((completedToday / activeHabits.length) * 100) : 0

  const getStreak = (habitId: string) => {
    let streak = 0
    const checkIns = habitCheckIns
      .filter(c => c.habitId === habitId)
      .map(c => new Date(c.date).toDateString())
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    const uniqueDates = [...new Set(checkIns)]
    let current = new Date()
    current.setHours(0, 0, 0, 0)

    for (let i = 0; i < 365; i++) {
      if (uniqueDates.includes(current.toDateString())) {
        streak++
        current.setDate(current.getDate() - 1)
      } else if (i === 0) {
        current.setDate(current.getDate() - 1)
        if (uniqueDates.includes(current.toDateString())) {
          streak++
          current.setDate(current.getDate() - 1)
        } else {
          break
        }
      } else {
        break
      }
    }
    return streak
  }

  const getHabitStats = (habitId: string) => {
    const checkIns = habitCheckIns.filter(c => c.habitId === habitId)
    const totalDays = checkIns.length

    const last30Days: string[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      last30Days.push(d.toDateString())
    }
    const last30CheckIns = checkIns.filter(c => last30Days.includes(new Date(c.date).toDateString()))
    const completionRate30d = last30Days.length > 0 ? Math.round((last30CheckIns.length / 30) * 100) : 0

    const longestStreak = (() => {
      const dates = [...new Set(checkIns.map(c => new Date(c.date).toDateString()))]
        .map(d => new Date(d).getTime())
        .sort((a, b) => a - b)
      let maxStreak = 0
      let current = 1
      for (let i = 1; i < dates.length; i++) {
        const diff = (dates[i] - dates[i - 1]) / 86400000
        if (Math.abs(diff - 1) < 0.5) {
          current++
          maxStreak = Math.max(maxStreak, current)
        } else {
          current = 1
        }
      }
      return Math.max(maxStreak, current, dates.length > 0 ? 1 : 0)
    })()

    return { totalDays, completionRate30d, longestStreak }
  }

  const getLast7Days = () => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d)
    }
    return days
  }

  const getLast30Days = () => {
    const days = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d)
    }
    return days
  }

  const handleAdd = () => {
    if (!newName.trim()) return
    addHabit({
      name: newName.trim(),
      icon: newIcon,
      category: newCategory,
      frequency: newFrequency,
      trackingType: 'boolean',
      color: '#6366f1',
    })
    setNewName('')
    setNewIcon('📋')
    setNewCategory('生活')
    setNewFrequency('daily')
    setShowAddSheet(false)
  }

  const handleOpenDetail = (habitId: string) => {
    const habit = habits.find(h => h.id === habitId)
    if (habit) {
      setEditName(habit.name)
      setEditIcon(habit.icon || '📋')
      setEditCategory(habit.category || '生活')
      setEditFrequency(habit.frequency || 'daily')
    }
    setDetailHabitId(habitId)
    setEditMode(false)
    setShowDeleteConfirm(false)
  }

  const handleSaveEdit = () => {
    if (!detailHabitId || !editName.trim()) return
    updateHabit(detailHabitId, {
      name: editName.trim(),
      icon: editIcon,
      category: editCategory,
      frequency: editFrequency,
    })
    setEditMode(false)
  }

  const handleDelete = () => {
    if (!detailHabitId) return
    deleteHabit(detailHabitId)
    setDetailHabitId(null)
    setShowDeleteConfirm(false)
  }

  const detailHabit = detailHabitId ? habits.find(h => h.id === detailHabitId) : null
  const detailStats = detailHabitId ? getHabitStats(detailHabitId) : null
  const detailStreak = detailHabitId ? getStreak(detailHabitId) : 0

  const weekDays = ['一', '二', '三', '四', '五', '六', '日']
  const last30 = getLast30Days()

  return (
    <div className="space-y-5 px-4 pt-4 pb-24">
      <div className="rounded-2xl glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground">今日完成</p>
            <p className="text-2xl font-bold">{completedToday}<span className="text-sm font-normal text-muted-foreground">/{activeHabits.length}</span></p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{todayPercent}%</p>
            <p className="text-xs text-muted-foreground">完成率</p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-primary/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${todayPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {activeHabits.length > 0 ? activeHabits.map(habit => {
          const checkedToday = todayCheckIns.some(c => c.habitId === habit.id)
          const streak = getStreak(habit.id)
          const last7 = getLast7Days()

          return (
            <div
              key={habit.id}
              className={cn(
                'rounded-2xl border p-4 transition-all',
                checkedToday ? 'bg-primary/5 border-primary/20' : 'bg-card border-border/40'
              )}
            >
              <div className="flex items-center gap-3">
                <button
                  className={cn(
                    'shrink-0 h-11 w-11 rounded-xl flex items-center justify-center text-xl transition-all active:scale-90',
                    checkedToday ? 'bg-primary/15' : 'bg-muted/50'
                  )}
                  onClick={() => { if (!checkedToday) checkInHabit(habit.id, new Date(), true) }}
                >
                  {habit.icon || '📋'}
                </button>

                <div className="flex-1 min-w-0" onClick={() => handleOpenDetail(habit.id)}>
                  <p className={cn('text-sm font-medium', checkedToday && 'text-muted-foreground')}>
                    {habit.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {streak > 0 && (
                      <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                        <Flame className="h-3 w-3" /> {streak}天
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{habit.category}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                  </div>
                </div>

                <button
                  className={cn(
                    'shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90',
                    checkedToday
                      ? 'bg-primary text-primary-foreground'
                      : 'border-2 border-muted-foreground/20'
                  )}
                  onClick={() => { if (!checkedToday) checkInHabit(habit.id, new Date(), true) }}
                >
                  {checkedToday && <CheckCircle2 className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center gap-1 mt-3">
                {last7.map(day => {
                  const dayStr = day.toDateString()
                  const isChecked = habitCheckIns.some(
                    c => c.habitId === habit.id && new Date(c.date).toDateString() === dayStr
                  )
                  const isToday = dayStr === todayStr
                  return (
                    <div
                      key={dayStr}
                      className={cn(
                        'flex-1 h-1.5 rounded-full transition-all',
                        isChecked ? 'bg-primary' : isToday ? 'bg-primary/20' : 'bg-muted/50'
                      )}
                    />
                  )
                })}
              </div>
            </div>
          )
        }) : (
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">还没有习惯</p>
            <p className="text-xs mt-1">点击下方添加你的第一个习惯</p>
          </div>
        )}
      </div>

      <button
        className="w-full h-12 rounded-2xl border-2 border-dashed border-border/50 flex items-center justify-center gap-2 text-sm text-muted-foreground active:scale-[0.98] transition-transform"
        onClick={() => setShowAddSheet(true)}
      >
        <Plus className="h-4 w-4" /> 添加习惯
      </button>

      {showAddSheet && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setShowAddSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6 pb-8 safe-area-bottom glass-sheet">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">添加习惯</h3>
              <button className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center" onClick={() => setShowAddSheet(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">图标</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(icon => (
                    <button
                      key={icon}
                      className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center text-lg active:scale-90 transition-transform',
                        newIcon === icon ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted/50'
                      )}
                      onClick={() => setNewIcon(icon)}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">名称</label>
                <input
                  type="text"
                  placeholder="习惯名称"
                  className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">分类</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-transform',
                        newCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
                      )}
                      onClick={() => setNewCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">频率</label>
                <div className="flex flex-wrap gap-2">
                  {FREQUENCIES.map(freq => (
                    <button
                      key={freq.id}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-transform',
                        newFrequency === freq.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
                      )}
                      onClick={() => setNewFrequency(freq.id)}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className={cn(
                  'w-full h-12 rounded-2xl font-medium text-sm transition-all active:scale-[0.98]',
                  newName.trim()
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground'
                )}
                onClick={handleAdd}
                disabled={!newName.trim()}
              >
                添加
              </button>
            </div>
          </div>
        </>
      )}

      {detailHabit && detailStats && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setDetailHabitId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6 pb-8 safe-area-bottom glass-sheet max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">习惯详情</h3>
              <div className="flex items-center gap-2">
                <button
                  className={cn('h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90',
                    editMode ? 'bg-primary text-primary-foreground' : 'bg-muted/50'
                  )}
                  onClick={() => {
                    if (editMode) handleSaveEdit()
                    else setEditMode(true)
                  }}
                >
                  {editMode ? <CheckCircle2 className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                </button>
                <button className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center" onClick={() => setDetailHabitId(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">图标</label>
                  <div className="flex flex-wrap gap-2">
                    {ICONS.map(icon => (
                      <button key={icon} className={cn('h-10 w-10 rounded-xl flex items-center justify-center text-lg active:scale-90 transition-transform',
                        editIcon === icon ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted/50'
                      )} onClick={() => setEditIcon(icon)}>{icon}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">名称</label>
                  <input type="text" className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">分类</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button key={cat} className={cn('px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-transform',
                        editCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
                      )} onClick={() => setEditCategory(cat)}>{cat}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">频率</label>
                  <div className="flex flex-wrap gap-2">
                    {FREQUENCIES.map(freq => (
                      <button key={freq.id} className={cn('px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-transform',
                        editFrequency === freq.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
                      )} onClick={() => setEditFrequency(freq.id)}>{freq.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{detailHabit.icon || '📋'}</span>
                  <div>
                    <p className="text-base font-semibold">{detailHabit.name}</p>
                    <p className="text-xs text-muted-foreground">{detailHabit.category} · {FREQUENCIES.find(f => f.id === (detailHabit.frequency || 'daily'))?.label || '每天'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="glass-card rounded-2xl p-3 text-center">
                    <Flame className="h-4 w-4 text-orange-500 mx-auto mb-1" />
                    <p className="text-lg font-bold">{detailStreak}</p>
                    <p className="text-[10px] text-muted-foreground">连续天数</p>
                  </div>
                  <div className="glass-card rounded-2xl p-3 text-center">
                    <BarChart3 className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                    <p className="text-lg font-bold">{detailStats.completionRate30d}%</p>
                    <p className="text-[10px] text-muted-foreground">30天完成率</p>
                  </div>
                  <div className="glass-card rounded-2xl p-3 text-center">
                    <TrendingUp className="h-4 w-4 text-green-500 mx-auto mb-1" />
                    <p className="text-lg font-bold">{detailStats.longestStreak}</p>
                    <p className="text-[10px] text-muted-foreground">最长连续</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> 30天打卡</h4>
                    <span className="text-xs text-muted-foreground">{detailStats.totalDays}天总打卡</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {last30.map(day => {
                      const dayStr = day.toDateString()
                      const isChecked = habitCheckIns.some(
                        c => c.habitId === detailHabit.id && new Date(c.date).toDateString() === dayStr
                      )
                      return (
                        <div
                          key={dayStr}
                          className={cn(
                            'aspect-square rounded-md transition-all',
                            isChecked ? 'bg-primary' : 'bg-muted/30'
                          )}
                        />
                      )
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  {showDeleteConfirm ? (
                    <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-4">
                      <p className="text-sm text-red-500 mb-3">确定要删除这个习惯吗？所有打卡记录将一并删除。</p>
                      <div className="flex gap-2">
                        <button className="flex-1 h-10 rounded-xl bg-muted/50 text-sm font-medium active:scale-[0.98] transition-transform" onClick={() => setShowDeleteConfirm(false)}>取消</button>
                        <button className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-medium active:scale-[0.98] transition-transform" onClick={handleDelete}>删除</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="w-full h-11 rounded-2xl bg-red-500/10 text-red-500 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4" /> 删除习惯
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
