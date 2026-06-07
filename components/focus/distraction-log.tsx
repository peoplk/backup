'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertTriangle,
  X,
  Plus,
  Clock,
  Zap,
  TrendingDown,
  BarChart3,
  Coffee,
  Phone,
  MessageCircle,
  Bell,
  Globe,
  Users,
  Music,
  Sparkles,
  Gamepad2,
  Utensils,
  Moon,
  Wrench,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const DISTRACTION_CATEGORIES = [
  {
    id: 'digital',
    label: '数字干扰',
    icon: Phone,
    color: '#3B82F6',
    items: [
      { icon: Phone, label: '手机消息', key: 'phone' },
      { icon: MessageCircle, label: '社交软件', key: 'social' },
      { icon: Bell, label: '通知提醒', key: 'notification' },
      { icon: Globe, label: '浏览网页', key: 'browse' },
      { icon: Gamepad2, label: '游戏娱乐', key: 'game' },
    ]
  },
  {
    id: 'physical',
    label: '生理需求',
    icon: Coffee,
    color: '#10B981',
    items: [
      { icon: Coffee, label: '喝水/饮料', key: 'drink' },
      { icon: Utensils, label: '吃东西', key: 'eat' },
      { icon: Moon, label: '困倦/疲劳', key: 'tired' },
      { icon: Users, label: '上厕所', key: 'restroom' },
    ]
  },
  {
    id: 'environment',
    label: '环境因素',
    icon: Users,
    color: '#F59E0B',
    items: [
      { icon: Users, label: '他人打扰', key: 'people' },
      { icon: Music, label: '环境噪音', key: 'noise' },
      { icon: Wrench, label: '设备问题', key: 'device' },
    ]
  },
  {
    id: 'other',
    label: '其他原因',
    icon: Sparkles,
    color: '#8B5CF6',
    items: [
      { icon: TrendingDown, label: '注意力涣散', key: 'focus' },
      { icon: Sparkles, label: '其他', key: 'other' },
    ]
  },
]

const ALL_REASONS = DISTRACTION_CATEGORIES.flatMap(cat => cat.items)

interface DistractionLogProps {
  taskId?: string
  pomodoroSessionId?: string
  isTimerRunning?: boolean
  compact?: boolean
}

export function DistractionLog({ taskId, pomodoroSessionId, isTimerRunning = false, compact = false }: DistractionLogProps) {
  const { distractions, addDistraction, deleteDistraction } = useAppStore(useShallow((state) => ({
    distractions: state.distractions,
    addDistraction: state.addDistraction,
    deleteDistraction: state.deleteDistraction,
  })))

  const [showDialog, setShowDialog] = useState(false)
  const [customReason, setCustomReason] = useState('')
  const [showQuickReasons, setShowQuickReasons] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [recentReasons, setRecentReasons] = useState<string[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  const todayDistractions = distractions.filter(d => {
    const dDate = new Date(d.timestamp).toDateString()
    return dDate === new Date().toDateString()
  })
  const sessionDistractions = pomodoroSessionId
    ? todayDistractions.filter(d => d.pomodoroSessionId === pomodoroSessionId)
    : todayDistractions

  useEffect(() => {
    const recent = [...new Set(todayDistractions.slice(0, 10).map(d => d.reason))].slice(0, 5)
    setRecentReasons(recent)
  }, [todayDistractions])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setShowQuickReasons(false)
        setSelectedCategory(null)
      }
    }
    if (showQuickReasons) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showQuickReasons])

  const handleQuickDistraction = useCallback((reason: string) => {
    addDistraction({
      reason,
      timestamp: new Date(),
      taskId,
      pomodoroSessionId,
    })
    setShowQuickReasons(false)
    setSelectedCategory(null)
  }, [addDistraction, taskId, pomodoroSessionId])

  const handleCustomDistraction = useCallback(() => {
    if (!customReason.trim()) return
    addDistraction({
      reason: customReason.trim(),
      timestamp: new Date(),
      taskId,
      pomodoroSessionId,
    })
    setCustomReason('')
  }, [addDistraction, taskId, pomodoroSessionId, customReason])

  if (compact) {
    return (
      <div className="relative" ref={panelRef}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 gap-1.5 px-3 rounded-full transition-all duration-300',
            showQuickReasons 
              ? 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 hover:text-amber-600' 
              : 'text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500'
          )}
          onClick={() => setShowQuickReasons(!showQuickReasons)}
        >
          <AlertTriangle className={cn('h-4 w-4 transition-transform', showQuickReasons && 'rotate-12')} />
          <span className="text-xs font-medium">分心</span>
          {sessionDistractions.length > 0 && (
            <Badge className="ml-0.5 h-4 min-w-4 px-1 text-[10px] bg-amber-500 text-white">
              {sessionDistractions.length}
            </Badge>
          )}
        </Button>
        
        {showQuickReasons && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="bg-card/95 backdrop-blur-xl border rounded-2xl shadow-2xl overflow-hidden w-[320px]">
              <div className="p-3 border-b bg-gradient-to-r from-amber-500/5 to-orange-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-amber-500/10 p-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </div>
                    <span className="text-sm font-semibold">记录分心</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 rounded-full"
                    onClick={() => {
                      setShowQuickReasons(false)
                      setSelectedCategory(null)
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="p-3">
                {recentReasons.length > 0 && !selectedCategory && (
                  <div className="mb-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">最近使用</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recentReasons.map((reason) => (
                        <button
                          key={reason}
                          onClick={() => handleQuickDistraction(reason)}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/50 hover:bg-muted transition-colors"
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!selectedCategory ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">选择分类</p>
                    {DISTRACTION_CATEGORIES.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="rounded-lg p-1.5"
                            style={{ backgroundColor: `${category.color}15` }}
                          >
                            <category.icon className="h-4 w-4" style={{ color: category.color }} />
                          </div>
                          <span className="text-sm font-medium">{category.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">{category.items.length}项</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-3 transition-colors"
                    >
                      <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                      返回分类
                    </button>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DISTRACTION_CATEGORIES.find(c => c.id === selectedCategory)?.items.map((item) => {
                        const category = DISTRACTION_CATEGORIES.find(c => c.id === selectedCategory)
                        return (
                          <button
                            key={item.key}
                            onClick={() => handleQuickDistraction(item.label)}
                            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all active:scale-[0.98]"
                          >
                            <item.icon 
                              className="h-4 w-4" 
                              style={{ color: category?.color }} 
                            />
                            <span className="text-xs font-medium">{item.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <Separator className="my-3" />
                
                <div className="flex gap-2">
                  <Input
                    placeholder="自定义原因..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customReason.trim()) {
                        handleCustomDistraction()
                      }
                    }}
                    className="h-9 text-xs"
                  />
                  <Button 
                    size="sm"
                    className="h-9 px-3" 
                    onClick={handleCustomDistraction}
                    disabled={!customReason.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {sessionDistractions.length > 0 && (
                <div className="px-3 pb-3">
                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-amber-600/80 font-medium">本次专注</span>
                      <Badge variant="secondary" className="text-[10px] h-4 bg-amber-500/15 text-amber-600">
                        {sessionDistractions.length} 次
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {sessionDistractions.slice(-3).reverse().map((d) => (
                        <span 
                          key={d.id} 
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground"
                        >
                          {d.reason}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className={cn('overflow-hidden', isTimerRunning && 'border-amber-500/30')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('rounded-lg p-1.5', isTimerRunning ? 'bg-amber-500/10' : 'bg-muted')}>
              <AlertTriangle className={cn('h-4 w-4', isTimerRunning ? 'text-amber-500' : 'text-muted-foreground')} />
            </div>
            <div>
              <CardTitle className="text-sm">分心记录</CardTitle>
              <CardDescription className="text-xs">记录专注过程中的打断</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sessionDistractions.length > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-600">
                {sessionDistractions.length} 次
              </Badge>
            )}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogContent className="max-w-md p-0 overflow-hidden" onClick={(e) => e.preventDefault()}>
                <DialogHeader className="p-4 border-b bg-gradient-to-r from-amber-500/5 to-orange-500/5">
                  <DialogTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    记录分心
                  </DialogTitle>
                </DialogHeader>
                <div className="p-4 space-y-4">
                  {recentReasons.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">最近使用</p>
                      <div className="flex flex-wrap gap-1.5">
                        {recentReasons.map((reason) => (
                          <button
                            key={reason}
                            onClick={() => {
                              handleQuickDistraction(reason)
                              setShowDialog(false)
                            }}
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted/50 hover:bg-muted transition-colors"
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {DISTRACTION_CATEGORIES.map((category) => (
                    <div key={category.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <category.icon className="h-4 w-4" style={{ color: category.color }} />
                        <span className="text-xs font-medium text-muted-foreground">{category.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {category.items.map((item) => (
                          <Button
                            key={item.key}
                            variant="outline"
                            size="sm"
                            className="justify-start gap-2 h-9 px-3 border-border/50 hover:border-primary/30"
                            onClick={() => {
                              handleQuickDistraction(item.label)
                              setShowDialog(false)
                            }}
                          >
                            <item.icon className="h-3.5 w-3.5" style={{ color: category.color }} />
                            <span className="text-xs">{item.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <Separator />
                  
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">自定义原因</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="输入自定义原因..."
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customReason.trim()) {
                            handleCustomDistraction()
                            setShowDialog(false)
                          }
                        }}
                        className="h-9"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-9 px-4"
                        onClick={() => {
                          handleCustomDistraction()
                          setShowDialog(false)
                        }}
                        disabled={!customReason.trim()}
                      >
                        添加
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      {sessionDistractions.length > 0 && (
        <CardContent className="space-y-1.5 pt-0">
          {sessionDistractions.slice(0, 6).map((d) => (
            <div
              key={d.id}
              className="group flex items-center justify-between rounded-lg border px-2.5 py-1.5 bg-amber-500/[0.03] hover:bg-amber-500/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1 shrink-0">
                  <TrendingDown className="h-3 w-3 text-amber-500/60" />
                  <Clock className="h-3 w-3 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(d.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className="text-xs truncate">{d.reason}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                onClick={() => deleteDistraction(d.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {sessionDistractions.length > 6 && (
            <p className="text-[10px] text-muted-foreground text-center">
              还有 {sessionDistractions.length - 6} 条记录...
            </p>
          )}
          <div className="mt-2 rounded-lg bg-gradient-to-r from-amber-500/5 to-amber-500/10 p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-amber-500/70" />
                <span className="text-[11px] font-medium text-amber-600/80">今日分心总览</span>
              </div>
              <span className="text-[11px] font-semibold text-amber-600">
                {todayDistractions.length} 次
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              {ALL_REASONS.slice(0, 4).map((r) => {
                const count = todayDistractions.filter(d => d.reason === r.label).length
                if (!count) return null
                return (
                  <div key={r.key} className="flex items-center gap-1">
                    <r.icon className="h-2.5 w-2.5 text-muted-foreground/60" />
                    <span className="text-[10px] text-muted-foreground">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      )}
      {sessionDistractions.length === 0 && (
        <CardContent className="pt-0">
          <div className="py-4 text-center">
            <Zap className="mx-auto h-4 w-4 text-chart-2/40 mb-1.5" />
            <p className="text-xs text-muted-foreground">暂无分心记录，继续保持</p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
