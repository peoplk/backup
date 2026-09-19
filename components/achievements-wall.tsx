'use client'

import { useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Trophy,
  Lock,
  Sparkles,
  Award,
  CheckCircle2,
  Target,
  Clock,
  Calendar,
  Flame,
  Star,
  Gift,
  TrendingUp,
  Coins,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGamification, type Achievement } from '@/lib/gamification'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SHOP_ITEMS } from '@/lib/store/slices/achievement-slice'
import { toast } from 'sonner'
import type { ShopItem } from '@/lib/types'

const CATEGORY_LABELS = {
  focus: { label: '专注', icon: Target, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  tasks: { label: '任务', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  habits: { label: '习惯', icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  streak: { label: '连续', icon: Flame, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  special: { label: '特殊', icon: Star, color: 'text-pink-500', bg: 'bg-pink-500/10' },
}

const TIER_STYLES = {
  bronze: { ring: 'ring-amber-700/50', glow: 'shadow-amber-500/20', text: 'text-amber-700' },
  silver: { ring: 'ring-slate-400/50', glow: 'shadow-slate-400/20', text: 'text-slate-500' },
  gold: { ring: 'ring-yellow-500/50', glow: 'shadow-yellow-500/30', text: 'text-yellow-600' },
  platinum: { ring: 'ring-cyan-400/50', glow: 'shadow-cyan-400/30', text: 'text-cyan-500' },
}

function getTier(requirement: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (requirement >= 500) return 'platinum'
  if (requirement >= 100) return 'gold'
  if (requirement >= 30) return 'silver'
  return 'bronze'
}

function getProgress(ach: Achievement, stats: { totalPomodoros: number; totalTasks: number; totalHabits: number; totalStreak: number }): number {
  switch (ach.category) {
    case 'focus':
      if (ach.id === 'time-traveler') {
        return Math.min(100, (stats.totalPomodoros * 25 / 6000) * 100)
      }
      return Math.min(100, (stats.totalPomodoros / ach.requirement.value) * 100)
    case 'tasks':
      return Math.min(100, (stats.totalTasks / ach.requirement.value) * 100)
    case 'habits':
    case 'streak':
      return Math.min(100, (stats.totalStreak / ach.requirement.value) * 100)
    default:
      return ach.earned ? 100 : 0
  }
}

export function AchievementsWall() {
  const storeAchievements = useAppStore((s) => s.achievements)
  const pomodoroSessions = useAppStore((s) => s.pomodoroSessions)
  const tasks = useAppStore((s) => s.tasks)
  const habits = useAppStore((s) => s.habits)
  const { achievements: allAchievements, gameProgress, getLevelTitle } = useGamification()
  const purchaseShopItem = useAppStore((s) => s.purchaseShopItem)
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all')
  const [shopHabitId, setShopHabitId] = useState('')
  const nowAtMount = useMemo(() => Date.now(), [])

  const handlePurchase = (itemId: ShopItem['id']) => {
    const res = purchaseShopItem(itemId, shopHabitId)
    if (res.ok) toast.success(res.message)
    else toast.error(res.message)
  }

  // 合并：优先用 store 中已解锁的
  const enriched: Achievement[] = useMemo(() => {
    const unlockedMap = new Map(
      storeAchievements.map((a) => [a.id, a.earnedAt ? new Date(a.earnedAt).toISOString() : ''])
    )
    return allAchievements.map((a) => {
      const unlockedAt = unlockedMap.get(a.id)
      return {
        ...a,
        earned: a.earned || !!unlockedAt,
        earnedAt: a.earnedAt || (unlockedAt ? new Date(unlockedAt) : undefined),
      }
    })
  }, [allAchievements, storeAchievements])

  // 计算总体统计（用于显示进度）
  const stats = useMemo(() => {
    const workSessions = pomodoroSessions.filter((s) => s.type === 'work')
    return {
      totalPomodoros: workSessions.length,
      totalTasks: tasks.filter((t) => t.status === 'done').length,
      totalHabits: habits.length,
      totalStreak: gameProgress.streak,
    }
  }, [pomodoroSessions, tasks, habits, gameProgress.streak])

  const filtered = useMemo(() => {
    if (filter === 'unlocked') return enriched.filter((a) => a.earned)
    if (filter === 'locked') return enriched.filter((a) => !a.earned)
    return enriched
  }, [enriched, filter])

  const grouped = useMemo(() => {
    const map: Record<string, Achievement[]> = {}
    filtered.forEach((a) => {
      if (!map[a.category]) map[a.category] = []
      map[a.category].push(a)
    })
    return map
  }, [filtered])

  const unlockedCount = enriched.filter((a) => a.earned).length
  const totalCount = enriched.length
  const completionPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0
  const totalReward = enriched
    .filter((a) => a.earned)
    .reduce((acc, a) => acc + a.points, 0)

  return (
    <div className="space-y-4">
      {/* 顶部统计卡 */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-chart-2/5">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <span>已解锁</span>
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {unlockedCount}
                <span className="text-sm text-muted-foreground"> / {totalCount}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span>完成度</span>
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-500">
                {completionPct}%
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Gift className="h-3.5 w-3.5 text-pink-500" />
                <span>奖励经验</span>
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-pink-500">
                {totalReward}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Award className="h-3.5 w-3.5 text-primary" />
                <span>当前等级</span>
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                Lv.{gameProgress.level}
              </div>
              <div className="text-2xs text-muted-foreground">
                {getLevelTitle(gameProgress.level)}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Progress value={completionPct} className="h-1.5" />
          </div>
        </CardContent>
      </Card>

      {/* 硬币商店：经验之外的可消耗账本 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Coins className="h-4 w-4 text-amber-500" />
                硬币商店
              </div>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                完成任务 / 专注 / 打卡获得经验时同步赚取硬币，可兑换习惯冻结道具
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-600 dark:text-amber-400 tabular-nums">
              🪙 {gameProgress.coins}
            </Badge>
          </div>

          {habits.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              还没有习惯。创建习惯后，即可用硬币兑换连续冻结道具。
            </p>
          ) : (
            <>
              <Select value={shopHabitId} onValueChange={setShopHabitId}>
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue placeholder="选择目标习惯…" />
                </SelectTrigger>
                <SelectContent>
                  {habits.map((h) => (
                    <SelectItem key={h.id} value={h.id} className="text-xs">
                      {h.icon} {h.name}（冻结 {h.streakFreezes || 0}/{h.maxStreakFreezes || 3}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid gap-2 sm:grid-cols-2">
                {SHOP_ITEMS.map((item) => {
                  const affordable = gameProgress.coins >= item.cost
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2"
                    >
                      <span className="text-xl">{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold">{item.name}</div>
                        <div className="text-2xs text-muted-foreground">{item.description}</div>
                      </div>
                      <Button
                        size="sm"
                        variant={affordable ? 'default' : 'outline'}
                        className="h-7 shrink-0 gap-1 px-2 text-xs tabular-nums"
                        disabled={!shopHabitId}
                        onClick={() => handlePurchase(item.id)}
                      >
                        <Coins className="h-3 w-3" />
                        {item.cost}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 过滤 */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            全部
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-2xs">
              {totalCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unlocked" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            已解锁
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-2xs">
              {unlockedCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="locked" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            未解锁
            <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-2xs">
              {totalCount - unlockedCount}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 分类展示 */}
      {Object.entries(CATEGORY_LABELS).map(([key, config]) => {
        const items = grouped[key] || []
        if (items.length === 0) return null
        const Icon = config.icon
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className={cn('rounded-lg p-1.5', config.bg)}>
                <Icon className={cn('h-4 w-4', config.color)} />
              </div>
              <h3 className="text-sm font-semibold">{config.label}</h3>
              <Badge variant="secondary" className="h-4 px-1.5 text-2xs">
                {items.filter((a) => a.earned).length} / {items.length}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {items.map((ach) => {
                const tier = getTier(ach.requirement.value)
                const tierStyle = TIER_STYLES[tier]
                const progress = getProgress(ach, stats)
                const isFresh =
                  ach.earned && ach.earnedAt &&
                  nowAtMount - new Date(ach.earnedAt).getTime() < 5 * 60 * 1000
                return (
                  <Card
                    key={ach.id}
                    className={cn(
                      'relative overflow-hidden transition-all',
                      ach.earned
                        ? cn('border-amber-500/30 ring-1', tierStyle.ring, 'shadow-md', tierStyle.glow)
                        : 'opacity-70 grayscale',
                      isFresh && 'animate-in fade-in-0 zoom-in-95 duration-500'
                    )}
                  >
                    {isFresh && (
                      <Badge className="absolute right-2 top-2 z-10 h-5 bg-amber-500 text-2xs text-white animate-pulse-soft">
                        刚刚解锁
                      </Badge>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl',
                            ach.earned
                              ? 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/40'
                              : 'bg-muted',
                            isFresh && 'animate-checkmark-pop'
                          )}
                        >
                          {ach.earned ? ach.icon : <Lock className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-semibold truncate">{ach.name}</h4>
                          </div>
                          <p className="text-2xs text-muted-foreground mt-0.5 line-clamp-2">
                            {ach.description}
                          </p>
                          <div className="mt-2 flex items-center gap-1.5">
                            <Badge variant="outline" className={cn('h-4 px-1.5 text-2xs', tierStyle.text)}>
                              {tier}
                            </Badge>
                            <span className="flex items-center gap-0.5 text-2xs text-amber-600 dark:text-amber-400">
                              <Sparkles className="h-2.5 w-2.5" />
                              +{ach.points}
                            </span>
                          </div>
                          {!ach.earned && progress > 0 && (
                            <div className="mt-2">
                              <Progress value={progress} className="h-1" />
                              <p className="text-3xs text-muted-foreground mt-0.5 tabular-nums">
                                {Math.round(progress)}%
                              </p>
                            </div>
                          )}
                          {ach.earned && ach.earnedAt && (
                            <p className="text-2xs text-muted-foreground mt-1.5">
                              ✓ {new Date(ach.earnedAt).toLocaleDateString('zh-CN')}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {filter === 'unlocked' ? '还没有解锁任何成就，继续加油！' : '已全部查看'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
