import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import { TitleBar } from '@/components/title-bar'
import { ErrorBoundary } from '@/components/error-boundary'
import { WhiteNoiseProvider } from '@/lib/white-noise-context'
import { Toaster } from '@/components/ui/sonner'
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
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
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

const themeScript = `
  (function() {
    try {
      var mode = localStorage.getItem('theme-mode') || 'system';
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = mode === 'dark' || (mode === 'system' && prefersDark);
      if (isDark) document.documentElement.classList.add('dark');
    } catch(e) {}
  })();
`

const capacitorScript = `
  (function() {
    window.__IS_CAPACITOR__ = false;
    var checkCapacitor = function() {
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        window.__IS_CAPACITOR__ = true;
        document.documentElement.classList.add('capacitor-native');
      }
    };
    checkCapacitor();
    if (!window.__IS_CAPACITOR__) {
      setTimeout(checkCapacitor, 0);
      setTimeout(checkCapacitor, 100);
    }
  })();
`

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
        {process.env.NEXT_PUBLIC_IS_CAPACITOR === 'true' && (
          <>
            <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
            <meta httpEquiv="Pragma" content="no-cache" />
            <meta httpEquiv="Expires" content="0" />
          </>
        )}
      </head>
      <body className="font-sans antialiased bg-background">
        <Script
          id="theme-script"
          strategy="beforeInteractive"
        >
          {themeScript}
        </Script>
        <Script
          id="capacitor-script"
          strategy="beforeInteractive"
        >
          {capacitorScript}
        </Script>
        <WhiteNoiseProvider>
          <TitleBar />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Toaster richColors position="bottom-right" />
        </WhiteNoiseProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
