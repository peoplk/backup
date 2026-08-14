'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import type { Anniversary } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Calendar,
  Heart,
  Gift,
  Clock,
  Star,
  Trash2,
  Edit,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_COLORS } from '@/lib/config'

const anniversaryIcons = ['🎂', '💍', '📅', '🎉', '❤️', '🎓', '🏆', '🌟', '🎄', '🎃']
const anniversaryColors = [APP_COLORS.pink, APP_COLORS.amber, APP_COLORS.blue, APP_COLORS.green, APP_COLORS.purple, APP_COLORS.orange, APP_COLORS.cyan, APP_COLORS.gray]

const typeLabels: Record<Anniversary['type'], string> = {
  birthday: '生日',
  anniversary: '纪念日',
  countdown: '倒数日',
  festival: '节日',
  custom: '自定义',
}

const typeIcons: Record<Anniversary['type'], typeof Heart> = {
  birthday: Gift,
  anniversary: Heart,
  countdown: Clock,
  festival: Star,
  custom: Calendar,
}

export function AnniversariesView() {
  const anniversaries = useAppStore((s) => s.anniversaries)
  const addAnniversary = useAppStore((s) => s.addAnniversary)
  const updateAnniversary = useAppStore((s) => s.updateAnniversary)
  const deleteAnniversary = useAppStore((s) => s.deleteAnniversary)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingAnniversary, setEditingAnniversary] = useState<Anniversary | null>(null)
  const [newAnniversary, setNewAnniversary] = useState({
    title: '',
    date: '',
    type: 'countdown' as Anniversary['type'],
    repeat: false,
    remindDays: 7,
    color: APP_COLORS.blue as string,
    icon: '📅',
    note: '',
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sortedAnniversaries = useMemo(() => {
    return [...anniversaries].sort((a, b) => {
      const daysA = getDaysRemaining(a.date, a.repeat)
      const daysB = getDaysRemaining(b.date, b.repeat)
      if (daysA < 0 && daysB >= 0) return 1
      if (daysA >= 0 && daysB < 0) return -1
      return Math.abs(daysA) - Math.abs(daysB)
    })
  }, [anniversaries])

  const upcomingAnniversaries = useMemo(() => {
    return sortedAnniversaries.filter((a) => getDaysRemaining(a.date, a.repeat) >= 0)
  }, [sortedAnniversaries])

  const pastAnniversaries = useMemo(() => {
    return sortedAnniversaries.filter((a) => getDaysRemaining(a.date, a.repeat) < 0)
  }, [sortedAnniversaries])

  function getDaysRemaining(date: Date | string, repeat: boolean = false): number {
    const targetDate = repeat ? getNextOccurrence(date, true) : new Date(date)
    const todayCopy = new Date(today)
    targetDate.setHours(0, 0, 0, 0)
    const diffTime = targetDate.getTime() - todayCopy.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  function getNextOccurrence(date: Date | string, repeat: boolean): Date {
    const targetDate = new Date(date)
    if (!repeat) return targetDate

    const source = new Date(date)
    const nextDate = new Date(today)
    nextDate.setMonth(source.getMonth())
    nextDate.setDate(source.getDate())

    if (nextDate < today) {
      nextDate.setFullYear(nextDate.getFullYear() + 1)
    }
    return nextDate
  }

  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const handleAddAnniversary = () => {
    if (!newAnniversary.title.trim() || !newAnniversary.date) return
    addAnniversary({
      ...newAnniversary,
      date: new Date(newAnniversary.date),
    })
    setNewAnniversary({
      title: '',
      date: '',
      type: 'countdown',
      repeat: false,
      remindDays: 7,
      color: APP_COLORS.blue,
      icon: '📅',
      note: '',
    })
    setIsAddDialogOpen(false)
  }

  const handleEditAnniversary = () => {
    if (!editingAnniversary || !newAnniversary.title.trim() || !newAnniversary.date) return
    updateAnniversary(editingAnniversary.id, {
      ...newAnniversary,
      date: new Date(newAnniversary.date),
    })
    setEditingAnniversary(null)
    setNewAnniversary({
      title: '',
      date: '',
      type: 'countdown',
      repeat: false,
      remindDays: 7,
      color: APP_COLORS.blue,
      icon: '📅',
      note: '',
    })
  }

  const openEditDialog = (anniversary: Anniversary) => {
    setEditingAnniversary(anniversary)
    setNewAnniversary({
      title: anniversary.title,
      date: new Date(anniversary.date).toISOString().split('T')[0],
      type: anniversary.type,
      repeat: anniversary.repeat,
      remindDays: anniversary.remindDays,
      color: anniversary.color,
      icon: anniversary.icon,
      note: anniversary.note || '',
    })
    setIsAddDialogOpen(true)
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">倒数纪念日</h1>
          <p className="text-muted-foreground mt-0.5">记录重要日子，不错过每个纪念日</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              添加纪念日
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAnniversary ? '编辑纪念日' : '添加新纪念日'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">名称</label>
                <Input
                  placeholder="例如：生日、结婚纪念日..."
                  value={newAnniversary.title}
                  onChange={(e) => setNewAnniversary({ ...newAnniversary, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">日期</label>
                <Input
                  type="date"
                  value={newAnniversary.date}
                  onChange={(e) => setNewAnniversary({ ...newAnniversary, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">类型</label>
                <Select
                  value={newAnniversary.type}
                  onValueChange={(value: Anniversary['type']) =>
                    setNewAnniversary({ ...newAnniversary, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="birthday">生日</SelectItem>
                    <SelectItem value="anniversary">纪念日</SelectItem>
                    <SelectItem value="countdown">倒数日</SelectItem>
                    <SelectItem value="festival">节日</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">图标</label>
                <div className="flex flex-wrap gap-2">
                  {anniversaryIcons.map((icon) => (
                    <button
                      key={icon}
                      className={cn(
                        'h-10 w-10 rounded-lg text-xl transition-all',
                        newAnniversary.icon === icon
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      )}
                      onClick={() => setNewAnniversary({ ...newAnniversary, icon })}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">颜色</label>
                <div className="flex flex-wrap gap-2">
                  {anniversaryColors.map((color) => (
                    <button
                      key={color}
                      className={cn(
                        'h-8 w-8 rounded-full transition-all',
                        newAnniversary.color === color && 'ring-2 ring-offset-2 ring-primary'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewAnniversary({ ...newAnniversary, color })}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">每年重复</label>
                <Button
                  variant={newAnniversary.repeat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewAnniversary({ ...newAnniversary, repeat: !newAnniversary.repeat })}
                >
                  {newAnniversary.repeat ? '是' : '否'}
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">提前提醒天数</label>
                <Select
                  value={String(newAnniversary.remindDays)}
                  onValueChange={(value) =>
                    setNewAnniversary({ ...newAnniversary, remindDays: Number(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">当天</SelectItem>
                    <SelectItem value="1">提前1天</SelectItem>
                    <SelectItem value="3">提前3天</SelectItem>
                    <SelectItem value="7">提前7天</SelectItem>
                    <SelectItem value="14">提前14天</SelectItem>
                    <SelectItem value="30">提前30天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">备注</label>
                <Textarea
                  placeholder="添加备注..."
                  value={newAnniversary.note}
                  onChange={(e) => setNewAnniversary({ ...newAnniversary, note: e.target.value })}
                />
              </div>
              <Button
                onClick={editingAnniversary ? handleEditAnniversary : handleAddAnniversary}
                className="w-full"
              >
                {editingAnniversary ? '保存修改' : '添加纪念日'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-1/10 p-3">
                <Calendar className="h-5 w-5 text-chart-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">即将到来</p>
                <p className="text-xl font-bold tracking-tight">{upcomingAnniversaries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-2/10 p-3">
                <Heart className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">纪念日</p>
                <p className="text-xl font-bold tracking-tight">
                  {anniversaries.filter((a) => a.type === 'anniversary').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-3/10 p-3">
                <Gift className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">生日</p>
                <p className="text-xl font-bold tracking-tight">
                  {anniversaries.filter((a) => a.type === 'birthday').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-chart-4/10 p-3">
                <Bell className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">需要提醒</p>
                <p className="text-xl font-bold tracking-tight">
                  {upcomingAnniversaries.filter((a) => getDaysRemaining(a.date, a.repeat) <= a.remindDays).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {anniversaries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Heart className="mx-auto h-12 w-12 opacity-50 mb-3" />
            <p className="text-sm">暂无纪念日</p>
            <p className="text-xs mt-1">点击上方"添加纪念日"记录重要日期</p>
          </CardContent>
        </Card>
      )}

      {upcomingAnniversaries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">即将到来</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingAnniversaries.map((anniversary) => {
              const daysRemaining = getDaysRemaining(anniversary.date, anniversary.repeat)
              const TypeIcon = typeIcons[anniversary.type]

              return (
                <Card key={anniversary.id} className="overflow-hidden">
                  <div
                    className="h-1"
                    style={{ backgroundColor: anniversary.color }}
                  />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                          style={{ backgroundColor: `${anniversary.color}20` }}
                        >
                          {anniversary.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold">{anniversary.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(anniversary.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(anniversary)}
                          aria-label="编辑纪念日"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteAnniversary(anniversary.id)}
                          aria-label="删除纪念日"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <Badge variant="secondary" className="gap-1">
                        <TypeIcon className="h-3 w-3" />
                        {typeLabels[anniversary.type]}
                      </Badge>
                      {anniversary.repeat && (
                        <Badge variant="outline" className="text-xs">
                          每年
                        </Badge>
                      )}
                    </div>
                    <div
                      className="mt-4 rounded-xl p-4 text-center"
                      style={{ backgroundColor: `${anniversary.color}10` }}
                    >
                      <p className="text-sm text-muted-foreground">距离还有</p>
                      <p
                        className="text-3xl font-bold"
                        style={{ color: anniversary.color }}
                      >
                        {daysRemaining}
                      </p>
                      <p className="text-sm text-muted-foreground">天</p>
                    </div>
                    {anniversary.note && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {anniversary.note}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {pastAnniversaries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">已过期</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pastAnniversaries.map((anniversary) => {
              const daysRemaining = getDaysRemaining(anniversary.date, anniversary.repeat)
              const TypeIcon = typeIcons[anniversary.type]

              return (
                <Card key={anniversary.id} className="overflow-hidden opacity-60">
                  <div
                    className="h-1"
                    style={{ backgroundColor: anniversary.color }}
                  />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                          style={{ backgroundColor: `${anniversary.color}20` }}
                        >
                          {anniversary.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold">{anniversary.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(anniversary.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(anniversary)}
                          aria-label="编辑纪念日"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteAnniversary(anniversary.id)}
                          aria-label="删除纪念日"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <Badge variant="secondary" className="gap-1">
                        <TypeIcon className="h-3 w-3" />
                        {typeLabels[anniversary.type]}
                      </Badge>
                    </div>
                    <div className="mt-4 rounded-xl bg-muted p-4 text-center">
                      <p className="text-sm text-muted-foreground">已过去</p>
                      <p className="text-3xl font-bold text-muted-foreground">
                        {Math.abs(daysRemaining)}
                      </p>
                      <p className="text-sm text-muted-foreground">天</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
