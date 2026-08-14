import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-6 p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <span className="text-2xl text-muted-foreground">404</span>
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold text-foreground">页面不存在</h1>
        <p className="text-sm text-muted-foreground">
          找不到您请求的页面，请检查 URL 是否正确。
        </p>
      </div>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        返回首页
      </Link>
    </div>
  )
}
