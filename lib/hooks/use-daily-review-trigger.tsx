'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { DailyReviewDialog } from '@/components/daily-review-dialog'

const DAILY_REVIEW_LAST_SHOWN_KEY = 'focusflow-daily-review-last-shown'

/**
 * 监听时间并在到达每日回顾时间时自动弹窗
 * - 默认 21:00
 * - 每天只弹一次（除非用户主动打开）
 * - 提供手动打开的 API
 */
export function DailyReviewTrigger() {
  const { dailyReviewSettings, markDailyReviewShown } = useAppStore()
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const triggeredRef = useRef(false)

  useEffect(() => {
    setEnabled(!!dailyReviewSettings?.enabled)
  }, [dailyReviewSettings?.enabled])

  // 暴露手动打开 API
  useEffect(() => {
    window.__openDailyReview = () => setOpen(true)
    return () => {
      window.__openDailyReview = undefined
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      triggeredRef.current = false
      return
    }

    const checkTime = () => {
      if (triggeredRef.current) return
      if (typeof window === 'undefined') return

      const now = new Date()
      const reviewTime = dailyReviewSettings?.reviewTime || '21:00'
      const [hh, mm] = reviewTime.split(':').map((n) => parseInt(n, 10))
      if (Number.isNaN(hh) || Number.isNaN(mm)) return

      // 1 分钟内匹配（避免重复弹）
      const targetMinutes = hh * 60 + mm
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const dateKey = now.toISOString().slice(0, 10)

      // 同一日只弹一次
      const lastShown =
        dailyReviewSettings?.lastReviewDate ||
        (typeof window !== 'undefined' ? localStorage.getItem(DAILY_REVIEW_LAST_SHOWN_KEY) : null)

      if (lastShown === dateKey) {
        triggeredRef.current = true
        return
      }

      if (currentMinutes >= targetMinutes) {
        triggeredRef.current = true
        setOpen(true)
        if (typeof window !== 'undefined') {
          localStorage.setItem(DAILY_REVIEW_LAST_SHOWN_KEY, dateKey)
        }
        // 写入 store 中的最后回顾日期
        markDailyReviewShown(dateKey)
      }
    }

    checkTime()
    const interval = setInterval(checkTime, 30 * 1000)
    return () => clearInterval(interval)
  }, [enabled, dailyReviewSettings?.reviewTime, dailyReviewSettings?.lastReviewDate, markDailyReviewShown])

  return <DailyReviewDialog open={open} onOpenChange={setOpen} />
}
