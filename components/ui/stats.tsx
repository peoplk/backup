import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  iconBgColor?: string
  progress?: number
  className?: string
  gradient?: boolean
  gradientFrom?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-chart-1',
  iconBgColor = 'bg-chart-1/10',
  progress,
  className,
  gradient = false,
  gradientFrom = 'chart-1',
}: StatCardProps) {
  return (
    <Card className={cn(
      className,
      gradient && `bg-gradient-to-br from-${gradientFrom}/8 to-transparent`
    )}>
      <CardContent className={cn('p-4', gradient && 'flex items-center gap-4')}>
        <div className={cn(
          'rounded-2xl p-3 transition-transform duration-200',
          gradient ? `${iconBgColor.replace('/10', '/20')}` : iconBgColor
        )}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div className={gradient ? '' : 'flex items-start justify-between'}>
          <div className={gradient ? '' : 'space-y-1.5'}>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <div className="flex items-baseline gap-1.5">
              <span className={cn('font-bold tracking-tight', gradient ? 'text-xl' : 'text-2xl')}>{value}</span>
              {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
            </div>
          </div>
        </div>
        {progress !== undefined && <Progress value={progress} className="mt-3 h-1.5" />}
      </CardContent>
    </Card>
  )
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('py-12 text-center text-muted-foreground', className)}>
      <Icon className="mx-auto h-12 w-12 opacity-30 mb-3" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

interface StatsGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function StatsGrid({ children, columns = 4, className }: StatsGridProps) {
  const gridCols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  )
}
