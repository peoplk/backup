'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useGamification, type GameProgress, type Achievement } from '@/lib/gamification'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Trophy, Star, Flame, Target, Zap, Crown, Medal, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GamificationContextValue {
  gameProgress: GameProgress
  achievements: Achievement[]
  getLevelTitle: (level: number) => string
  getLevelProgress: () => number
}

const GamificationContext = createContext<GamificationContextValue | null>(null)

function useGamificationContext() {
  const context = useContext(GamificationContext)
  if (!context) {
    throw new Error('useGamificationContext must be used within GamificationProvider')
  }
  return context
}

interface GamificationProviderProps {
  children: ReactNode
}

function GamificationProvider({ children }: GamificationProviderProps) {
  const { gameProgress, achievements, getLevelTitle, getLevelProgress } = useGamification()

  return (
    <GamificationContext.Provider value={{
      gameProgress,
      achievements,
      getLevelTitle,
      getLevelProgress,
    }}>
      {children}
    </GamificationContext.Provider>
  )
}

function LevelProgress() {
  const { gameProgress, getLevelTitle, getLevelProgress } = useGamificationContext()
  const progress = getLevelProgress()

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">Lv.{gameProgress.level}</span>
                <Badge variant="secondary" className="text-xs">
                  {getLevelTitle(gameProgress.level)}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                {gameProgress.experience} XP
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              距离下一级还需 {gameProgress.experienceToNextLevel} 经验值
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatsGrid() {
  const { gameProgress } = useGamificationContext()

  const stats = [
    { icon: Flame, label: '连续专注', value: `${gameProgress.streak}天`, color: 'text-orange-500' },
    { icon: Target, label: '完成任务', value: gameProgress.completedTasks, color: 'text-green-500' },
    { icon: Star, label: '习惯打卡', value: gameProgress.completedHabits, color: 'text-yellow-500' },
    { icon: Zap, label: '专注时长', value: `${Math.round(gameProgress.totalFocusTime / 3600)}h`, color: 'text-blue-500' },
  ]

  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((stat, index) => (
        <Card key={index} className="border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <stat.icon className={cn('h-4 w-4', stat.color)} />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-sm font-semibold">{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function RecentAchievements() {
  const { achievements } = useGamificationContext()
  const unlockedAchievements = achievements.filter(a => a.unlocked).slice(0, 5)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-yellow-500" />
          最近成就
        </CardTitle>
      </CardHeader>
      <CardContent>
        {unlockedAchievements.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Medal className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>还没有解锁成就</p>
            <p className="text-xs">开始专注来解锁你的第一个成就！</p>
          </div>
        ) : (
          <div className="space-y-2">
            {unlockedAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-2.5"
              >
                <div className="text-2xl">{achievement.icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{achievement.name}</p>
                  <p className="text-xs text-muted-foreground">{achievement.description}</p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  +{achievement.reward} XP
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AllAchievements() {
  const { achievements } = useGamificationContext()

  const categorizedAchievements = {
    focus: achievements.filter(a => a.category === 'focus'),
    tasks: achievements.filter(a => a.category === 'tasks'),
    habits: achievements.filter(a => a.category === 'habits'),
    streak: achievements.filter(a => a.category === 'streak'),
    special: achievements.filter(a => a.category === 'special'),
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-5 w-5 text-purple-500" />
          成就列表
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(categorizedAchievements).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-sm font-medium mb-2 capitalize">
                {category === 'focus' && '专注成就'}
                {category === 'tasks' && '任务成就'}
                {category === 'habits' && '习惯成就'}
                {category === 'streak' && '连续成就'}
                {category === 'special' && '特殊成就'}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {items.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-2 transition-all',
                      achievement.unlocked
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border/30 bg-muted/20 opacity-50'
                    )}
                  >
                    <div className="text-xl">{achievement.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{achievement.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {achievement.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface GamificationDashboardProps {
  className?: string
}

export function GamificationDashboard({ className }: GamificationDashboardProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <GamificationProvider>
        <LevelProgress />
        <StatsGrid />
        <RecentAchievements />
      </GamificationProvider>
    </div>
  )
}

export function GamificationFullPage({ className }: GamificationDashboardProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <GamificationProvider>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <LevelProgress />
            <StatsGrid />
          </div>
          <RecentAchievements />
        </div>
        <AllAchievements />
      </GamificationProvider>
    </div>
  )
}

export { GamificationProvider, LevelProgress, StatsGrid, RecentAchievements, AllAchievements, useGamificationContext }
