'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DesktopWidget } from '@/components/desktop-widget'
import { TimerFloat } from '@/components/timer-float'
import { ThemeProvider } from '@/components/theme-provider'

function WidgetContent() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')

  if (mode === 'timer') {
    return <TimerFloat />
  }
  return <DesktopWidget />
}

export default function WidgetPage() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <Suspense fallback={null}>
        <WidgetContent />
      </Suspense>
    </ThemeProvider>
  )
}
