'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { getStoredTheme, setTheme, type ThemeMode } from '@/lib/theme'

export function useDarkModeSchedule() {
  const darkModeSchedule = useAppStore((state) => state.darkModeSchedule)

  useEffect(() => {
    if (!darkModeSchedule.enabled) return

    const checkAndApply = () => {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      const parseTime = (time: string) => {
        const [h, m] = time.split(':').map(Number)
        return h * 60 + m
      }

      const lightStart = parseTime(darkModeSchedule.lightStart)
      const darkStart = parseTime(darkModeSchedule.darkStart)

      let expectedMode: ThemeMode
      if (darkStart > lightStart) {
        expectedMode = currentMinutes >= lightStart && currentMinutes < darkStart ? 'light' : 'dark'
      } else {
        expectedMode = currentMinutes >= darkStart && currentMinutes < lightStart ? 'dark' : 'light'
      }

      const currentStored = getStoredTheme()
      if (currentStored !== expectedMode) {
        setTheme(expectedMode)
      }
    }

    checkAndApply()
    const interval = setInterval(checkAndApply, 60000)
    return () => clearInterval(interval)
  }, [darkModeSchedule.enabled, darkModeSchedule.lightStart, darkModeSchedule.darkStart])
}
