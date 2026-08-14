'use client'

import { useEffect } from 'react'

export default function WidgetError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[WidgetError]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4 p-6">
      <p className="text-sm text-muted-foreground">小组件加载出错</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        重试
      </button>
    </div>
  )
}
