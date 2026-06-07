'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Heart,
  Gift,
  Clock,
  Star,
  Bell,
  Plus,
  X,
  Trash2,
} from 'lucide-react'

const ICONS = ['🎂', '💍', '📅', '🎉', '❤️', '🎓', '🏆', '🌟', '🎄', '🎃', '🎁', '🎈', '🌹', '✨', '🎊', '🥳', '💫', '🪅', '🧧', '🎆']
const COLORS = ['#E91E63', '#FF5722', '#4A90E2', '#7ED321', '#9B59B6', '#F5A623', '#00CED1', '#607D8B']

type AnniversaryType = 'birthday' | 'anniversary' | 'countdown' | 'custom' | 'festival'

const TYPE_CONFIG: Record<AnniversaryType, { label: string; icon: typeof Heart; color: string }> = {
  birthday: { label: '生日', icon: Gift, color: '#E91E63' },
  anniversary: { label: '纪念日', icon: Heart, color: '#FF5722' },
  countdown: { label: '倒数日', icon: Clock, color: '#4A90E2' },
  festival: { label: '节日', icon: Star, color: '#F5A623' },
  custom: { label: '自定义', icon: Calendar, color: '#9B59B6' },
}

function getDaysRemaining(date: Date | string): number {
  const target = new Date(date)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const thisYear = new Date(now.getFullYear(), target.getMonth(), target.getDate())
  thisYear.setHours(0, 0, 0, 0)
  const diff = thisYear.getTime() - now.getTime()
  if (diff < 0) {
    const nextYear = new Date(now.getFullYear() + 1, target.getMonth(), target.getDate())
    nextYear.setHours(0, 0, 0, 0)
    const nextDiff = nextYear.getTime() - now.getTime()
    return Math.ceil(nextDiff / (1000 * 60 * 60 * 24))
  }
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getDaysSince(date: Date | string): number {
  const target = new Date(date)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

interface FormState {
  title: string
  date: string
  type: AnniversaryType
  icon: string
  color: string
  repeat: boolean
  remindDays: number
  note: string
}

const defaultForm: FormState = {
  title: '',
  date: '',
  type: 'countdown',
  icon: '📅',
  color: '#4A90E2',
  repeat: false,
  remindDays: 7,
  note: '',
}

export function MobileAnniversariesView() {
  const { anniversaries, addAnniversary, updateAnniversary, deleteAnniversary } = useAppStore(
    useShallow(state => ({
      anniversaries: state.anniversaries,
      addAnniversary: state.addAnniversary,
      updateAnniversary: state.updateAnniversary,
      deleteAnniversary: state.deleteAnniversary,
    }))
  )

  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)

  const upcoming = useMemo(() => {
    return [...anniversaries]
      .filter(a => getDaysRemaining(a.date) >= 0)
      .sort((a, b) => getDaysRemaining(a.date) - getDaysRemaining(b.date))
  }, [anniversaries])

  const past = useMemo(() => {
    return [...anniversaries]
      .filter(a => getDaysRemaining(a.date) < 0)
      .sort((a, b) => getDaysSince(b.date) - getDaysSince(a.date))
  }, [anniversaries])

  const stats = useMemo(() => ({
    upcoming: upcoming.length,
    anniversary: anniversaries.filter(a => a.type === 'anniversary').length,
    birthday: anniversaries.filter(a => a.type === 'birthday').length,
    reminder: anniversaries.filter(a => getDaysRemaining(a.date) <= a.remindDays && getDaysRemaining(a.date) >= 0).length,
  }), [anniversaries, upcoming])

  const openAdd = () => {
    setEditingId(null)
    setForm(defaultForm)
    setShowAddSheet(true)
  }

  const openEdit = (id: string) => {
    const a = anniversaries.find(x => x.id === id)
    if (!a) return
    setEditingId(id)
    setForm({
      title: a.title,
      date: new Date(a.date).toISOString().split('T')[0],
      type: a.type,
      icon: a.icon,
      color: a.color,
      repeat: a.repeat,
      remindDays: a.remindDays,
      note: a.note || '',
    })
    setShowAddSheet(true)
  }

  const handleSave = () => {
    if (!form.title.trim() || !form.date) return
    const payload = {
      title: form.title.trim(),
      date: new Date(form.date),
      type: form.type,
      icon: form.icon,
      color: form.color,
      repeat: form.repeat,
      remindDays: form.remindDays,
      note: form.note || undefined,
    }
    if (editingId) {
      updateAnniversary(editingId, payload)
    } else {
      addAnniversary(payload)
    }
    setShowAddSheet(false)
    setEditingId(null)
    setForm(defaultForm)
  }

  const handleDelete = (id: string) => {
    deleteAnniversary(id)
  }

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-5 px-4 pt-4 pb-24">
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-2xl glass-card p-3 text-center">
          <p className="text-lg font-bold text-blue-500">{stats.upcoming}</p>
          <p className="text-[10px] text-muted-foreground">即将到来</p>
        </div>
        <div className="rounded-2xl glass-card p-3 text-center">
          <p className="text-lg font-bold text-rose-500">{stats.anniversary}</p>
          <p className="text-[10px] text-muted-foreground">纪念日</p>
        </div>
        <div className="rounded-2xl glass-card p-3 text-center">
          <p className="text-lg font-bold text-pink-500">{stats.birthday}</p>
          <p className="text-[10px] text-muted-foreground">生日</p>
        </div>
        <div className="rounded-2xl glass-card p-3 text-center">
          <p className="text-lg font-bold text-amber-500">{stats.reminder}</p>
          <p className="text-[10px] text-muted-foreground">需提醒</p>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">即将到来</h3>
          <div className="space-y-2">
            {upcoming.map(a => {
              const days = getDaysRemaining(a.date)
              const cfg = TYPE_CONFIG[a.type]
              const TypeIcon = cfg.icon
              return (
                <div
                  key={a.id}
                  className="rounded-2xl glass-card p-4 active:scale-[0.98] transition-transform"
                  onClick={() => openEdit(a.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="shrink-0 h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${a.color}15` }}
                    >
                      {a.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{a.title}</p>
                        <span
                          className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(a.date)}</p>
                      {a.note && (
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{a.note}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-bold" style={{ color: a.color }}>{days}</p>
                      <p className="text-[10px] text-muted-foreground">天后</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                    <TypeIcon className="h-3 w-3 text-muted-foreground" />
                    {a.repeat && <span className="text-[10px] text-muted-foreground">每年重复</span>}
                    {days <= a.remindDays && (
                      <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                        <Bell className="h-3 w-3" /> 提醒中
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">已过去</h3>
          <div className="space-y-2">
            {past.map(a => {
              const daysSince = getDaysSince(a.date)
              const cfg = TYPE_CONFIG[a.type]
              return (
                <div
                  key={a.id}
                  className="rounded-2xl glass-card p-4 opacity-50 active:scale-[0.98] transition-transform"
                  onClick={() => openEdit(a.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${a.color}10` }}
                    >
                      {a.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <span
                          className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: `${cfg.color}10`, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(a.date)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold text-muted-foreground">{daysSince}</p>
                      <p className="text-[10px] text-muted-foreground">天前</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {anniversaries.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">还没有纪念日</p>
          <p className="text-xs mt-1">点击下方添加你的第一个纪念日</p>
        </div>
      )}

      <button
        className="w-full h-12 rounded-2xl border-2 border-dashed border-border/50 flex items-center justify-center gap-2 text-sm text-muted-foreground active:scale-[0.98] transition-transform"
        onClick={openAdd}
      >
        <Plus className="h-4 w-4" /> 添加纪念日
      </button>

      {showAddSheet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => { setShowAddSheet(false); setEditingId(null) }}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 pb-8 safe-area-bottom glass-sheet max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">{editingId ? '编辑纪念日' : '添加纪念日'}</h3>
              <button
                className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center"
                onClick={() => { setShowAddSheet(false); setEditingId(null) }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">名称</label>
                <input
                  type="text"
                  placeholder="纪念日名称"
                  className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.title}
                  onChange={e => updateForm('title', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">日期</label>
                <input
                  type="date"
                  className="w-full h-10 px-3 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.date}
                  onChange={e => updateForm('date', e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">类型</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(TYPE_CONFIG) as [AnniversaryType, typeof TYPE_CONFIG[AnniversaryType]][]).map(([key, cfg]) => {
                    const Icon = cfg.icon
                    return (
                      <button
                        key={key}
                        className={cn(
                          'px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 active:scale-95 transition-transform',
                          form.type === key
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground'
                        )}
                        onClick={() => updateForm('type', key)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">图标</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(icon => (
                    <button
                      key={icon}
                      className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center text-lg active:scale-90 transition-transform',
                        form.icon === icon ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted/50'
                      )}
                      onClick={() => updateForm('icon', icon)}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">颜色</label>
                <div className="flex flex-wrap gap-3">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      className={cn(
                        'h-8 w-8 rounded-full transition-all active:scale-90',
                        form.color === color && 'ring-2 ring-offset-2 ring-primary'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => updateForm('color', color)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">每年重复</label>
                <button
                  className={cn(
                    'px-4 py-1.5 rounded-full text-xs font-medium active:scale-95 transition-transform',
                    form.repeat ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
                  )}
                  onClick={() => updateForm('repeat', !form.repeat)}
                >
                  {form.repeat ? '是' : '否'}
                </button>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">提前提醒天数</label>
                <div className="flex gap-2">
                  {[1, 3, 7, 14, 30].map(d => (
                    <button
                      key={d}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-xs font-medium active:scale-95 transition-transform',
                        form.remindDays === d
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground'
                      )}
                      onClick={() => updateForm('remindDays', d)}
                    >
                      {d}天
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">备注</label>
                <textarea
                  placeholder="添加备注..."
                  className="w-full h-20 px-3 py-2 rounded-xl bg-muted/50 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  value={form.note}
                  onChange={e => updateForm('note', e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                {editingId && (
                  <button
                    className="h-12 px-4 rounded-2xl bg-red-500/10 text-red-500 text-sm font-medium flex items-center gap-2 active:scale-[0.98] transition-transform"
                    onClick={() => {
                      handleDelete(editingId)
                      setShowAddSheet(false)
                      setEditingId(null)
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> 删除
                  </button>
                )}
                <button
                  className={cn(
                    'flex-1 h-12 rounded-2xl font-medium text-sm transition-all active:scale-[0.98]',
                    form.title.trim() && form.date
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground'
                  )}
                  onClick={handleSave}
                  disabled={!form.title.trim() || !form.date}
                >
                  {editingId ? '保存' : '添加'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
