import { Spinner } from '@/components/ui/spinner'

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
      <Spinner className="h-10 w-10" />
      <p className="text-sm text-muted-foreground">加载中...</p>
    </div>
  )
}
