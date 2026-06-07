'use client'

import { DesktopWidget } from '@/components/desktop-widget'
import { ThemeProvider } from '@/components/theme-provider'

export default function WidgetPage() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <DesktopWidget />
    </ThemeProvider>
  )
}
