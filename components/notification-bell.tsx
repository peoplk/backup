'use client'

import { useAppStore } from '@/lib/store'
import type { Notification } from '@/lib/types'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Heart,
  Timer,
  Trophy,
  Calendar,
  Check,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/format'

const notificationIcons: Record<Notification['type'], React.ComponentType<{ className?: string }>> = {
  'task-due': Calendar,
  'task-overdue': AlertCircle,
  'habit-reminder': Timer,
  'anniversary': Heart,
  'pomodoro': Timer,
  'achievement': Trophy,
}

const notificationColors: Record<Notification['type'], string> = {
  'task-due': 'text-chart-1',
  'task-overdue': 'text-destructive',
  'habit-reminder': 'text-chart-2',
  'anniversary': 'text-chart-3',
  'pomodoro': 'text-chart-1',
  'achievement': 'text-chart-4',
}

const notificationRoutes: Record<Notification['type'], string> = {
  'task-due': 'tasks',
  'task-overdue': 'tasks',
  'habit-reminder': 'habits',
  'anniversary': 'anniversaries',
  'pomodoro': 'pomodoro',
  'achievement': 'analytics',
}

export function NotificationBell() {
  const { 
    notifications, 
    markNotificationRead, 
    markAllNotificationsRead,
    clearNotifications,
    setActiveView 
  } = useAppStore(useShallow((s) => ({
    notifications: s.notifications,
    markNotificationRead: s.markNotificationRead,
    markAllNotificationsRead: s.markAllNotificationsRead,
    clearNotifications: s.clearNotifications,
    setActiveView: s.setActiveView,
  })))

  const unreadCount = notifications.filter(n => !n.read).length

  const handleNotificationClick = (notification: Notification) => {
    markNotificationRead(notification.id)
    const route = notification.actionUrl || notificationRoutes[notification.type]
    if (route) {
      setActiveView(route as 'dashboard' | 'tasks' | 'focus' | 'analytics' | 'habits' | 'anniversaries' | 'settings' | 'goals' | 'time-block')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 w-5 justify-center rounded-full p-0 text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px]">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">通知</h3>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={markAllNotificationsRead}
                >
                  <Check className="h-3 w-3 mr-1" />
                  全部已读
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={clearNotifications}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                清空
              </Button>
            </div>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Bell className="mx-auto h-8 w-8 opacity-50 mb-2" />
            <p className="text-sm">暂无通知</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.type]
              const colorClass = notificationColors[notification.type]

              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-3 p-3 cursor-pointer',
                    !notification.read && 'bg-muted/50'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={cn('mt-0.5 shrink-0', colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        'text-sm font-medium truncate',
                        !notification.read && 'text-foreground'
                      )}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {formatRelativeTime(notification.timestamp)}
                    </p>
                  </div>
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
