'use client'

import { useAppStore } from '@/lib/store'
import { parseICS, isValidSubscriptionUrl } from '@/lib/ics-parse'

const FETCH_TIMEOUT_MS = 15000
/** 单个订阅源响应上限 2MB，防止异常源拖垮内存 */
const MAX_BODY_BYTES = 2_000_000

async function refreshOne(calendarId: string): Promise<void> {
  const store = useAppStore.getState()
  const cal = store.subscribedCalendars.find((c) => c.id === calendarId)
  if (!cal || !cal.enabled) return
  if (!isValidSubscriptionUrl(cal.url)) {
    store.updateSubscribedCalendar(calendarId, {
      status: 'error',
      lastError: '无效的订阅地址',
    })
    return
  }

  store.updateSubscribedCalendar(calendarId, { status: 'syncing' })
  try {
    const res = await fetch(cal.url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    if (text.length > MAX_BODY_BYTES) throw new Error('日历内容过大')

    const events = parseICS(text, calendarId)
    useAppStore.getState().setExternalEvents(calendarId, events)
    useAppStore.getState().updateSubscribedCalendar(calendarId, {
      status: 'synced',
      lastError: null,
      lastFetchedAt: new Date(),
    })
  } catch (err) {
    useAppStore.getState().updateSubscribedCalendar(calendarId, {
      status: 'error',
      lastError: err instanceof Error ? err.message : '同步失败',
    })
  }
}

/** 刷新全部启用的订阅（串行执行，失败互不影响） */
export async function refreshAllSubscriptions(): Promise<void> {
  const { subscribedCalendars } = useAppStore.getState()
  for (const cal of subscribedCalendars) {
    if (!cal.enabled) continue
    await refreshOne(cal.id)
  }
}

export function refreshSubscribedCalendar(calendarId: string): Promise<void> {
  return refreshOne(calendarId)
}
