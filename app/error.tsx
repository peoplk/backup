'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div role="alert" className="flex flex-col items-center justify-center min-h-screen bg-background gap-6 p-8">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <span className="text-2xl text-destructive">!</span>
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold text-foreground">应用出错了</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          {process.env.NODE_ENV === 'development' && error.message
            ? error.message
            : '发生了一个意外错误，请尝试刷新页面。'}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          重试
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          刷新页面
        </button>
      </div>
    </div>
  )
}
