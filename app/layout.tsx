import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { TitleBar } from '@/components/title-bar'
import { ErrorBoundary } from '@/components/error-boundary'
import { Toaster } from '@/components/ui/sonner'
import { PwaRegister } from '@/components/pwa-register'
import './globals.css'

const inter = {
  variable: "--font-inter",
}
const geistMono = {
  variable: "--font-mono",
}

export const metadata: Metadata = {
  title: 'FocusFlow - 生产力管理应用',
  description: '一款集时间追踪、任务管理、番茄钟于一体的专业生产力工具',
  generator: 'v0.app',
  manifest: '/manifest.json',
  applicationName: 'FocusFlow',
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: '/icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f5' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1c1e' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('theme-mode')||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(m==='dark'||(m==='system'&&d))document.documentElement.classList.add('dark')}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background">
          <TitleBar />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Toaster richColors position="bottom-right" />
        <PwaRegister />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
