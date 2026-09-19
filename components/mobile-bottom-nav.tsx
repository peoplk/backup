'use client'

import { LayoutDashboard, CheckSquare, Timer, Trophy, BarChart3, Menu } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const ITEMS = [
  { id: 'dashboard', label: '概览', icon: LayoutDashboard },
  { id: 'tasks', label: '任务', icon: CheckSquare },
  { id: 'focus', label: '专注', icon: Timer },
  { id: 'habits', label: '习惯', icon: Trophy },
  { id: 'analytics', label: '统计', icon: BarChart3 },
] as const

/** 窄屏（<lg）底部导航：五个主视图直达，「更多」唤起完整侧边抽屉 */
export function MobileBottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden border-t border-border/50 bg-background/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="移动端导航"
    >
      <div className="grid grid-cols-6">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeView === id
          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 text-2xs transition-colors active:scale-95',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.4]')} />
              <span>{label}</span>
            </button>
          )
        })}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-2xs text-muted-foreground transition-colors active:scale-95"
        >
          <Menu className="h-5 w-5" />
          <span>更多</span>
        </button>
      </div>
    </nav>
  )
}
