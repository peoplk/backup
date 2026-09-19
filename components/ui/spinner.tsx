import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="加载中"
      className={cn(
        'h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary',
        className,
      )}
    />
  )
}
