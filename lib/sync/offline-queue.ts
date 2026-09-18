/**
 * 离线推送队列（同步正确性地基之三）：
 * 全量快照推送失败（断网/云端 5xx）时不再静默丢弃，而是持久化暂存并按
 * 指数退避重试；恢复联网后自动补推。
 * 语义：同一时刻只保留最新一份待推快照（全量推送，新快照覆盖旧快照），
 * 重试 12 次仍失败则保留现场等待下一次 enqueue 或手动 flush。
 */

export interface OfflineQueueState {
  snapshot: string | null
  attempts: number
  nextAttemptAt: number
}

export const OFFLINE_QUEUE_MAX_ATTEMPTS = 12
const OFFLINE_QUEUE_KEY = 'focusflow-offline-queue'
/** 退避起点与上限 */
const BACKOFF_BASE_MS = 30 * 1000
const BACKOFF_MAX_MS = 10 * 60 * 1000

export function backoffDelay(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * Math.pow(2, Math.max(0, attempts - 1)))
}

interface Deps {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  /** 待注入的推送函数：成功 resolve，失败 reject */
  push: (snapshot: string) => Promise<void>
  now?: () => number
  setTimeoutFn?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeoutFn?: (t: ReturnType<typeof setTimeout>) => void
}

export function createOfflineQueue(deps: Deps) {
  const { storage, push } = deps
  const now = deps.now ?? (() => Date.now())
  const setTimeoutFn = deps.setTimeoutFn ?? ((fn, ms) => window.setTimeout(fn, ms))
  const clearTimeoutFn = deps.clearTimeoutFn ?? ((t) => window.clearTimeout(t))

  let retryTimer: unknown = null

  function load(): OfflineQueueState {
    try {
      const raw = storage.getItem(OFFLINE_QUEUE_KEY)
      const parsed = raw ? (JSON.parse(raw) as OfflineQueueState) : null
      return parsed && typeof parsed.snapshot === 'string'
        ? parsed
        : { snapshot: null, attempts: 0, nextAttemptAt: 0 }
    } catch {
      return { snapshot: null, attempts: 0, nextAttemptAt: 0 }
    }
  }

  function save(state: OfflineQueueState): void {
    try {
      if (state.snapshot === null) storage.removeItem(OFFLINE_QUEUE_KEY)
      else storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(state))
    } catch {
      // 存储异常不阻塞业务
    }
  }

  function scheduleRetry(): void {
    if (retryTimer !== null) clearTimeoutFn(retryTimer as ReturnType<typeof setTimeout>)
    const state = load()
    if (state.snapshot === null) return
    const delay = Math.max(0, state.nextAttemptAt - now())
    retryTimer = setTimeoutFn(() => { void flush() }, delay)
  }

  /** 入队：新快照覆盖旧快照，重置退避 */
  function enqueue(snapshot: string): void {
    save({ snapshot, attempts: 0, nextAttemptAt: now() })
    scheduleRetry()
  }

  /** 尝试补推；返回是否成功清除队列 */
  async function flush(): Promise<boolean> {
    const state = load()
    if (state.snapshot === null) return true
    if (now() < state.nextAttemptAt) return false
    try {
      await push(state.snapshot)
      save({ snapshot: null, attempts: 0, nextAttemptAt: 0 })
      return true
    } catch {
      const attempts = state.attempts + 1
      if (attempts >= OFFLINE_QUEUE_MAX_ATTEMPTS) {
        // 达到上限：保留快照、停止自动重试，等下次 enqueue 重新计数
        save({ ...state, attempts, nextAttemptAt: Number.MAX_SAFE_INTEGER })
        return false
      }
      save({ ...state, attempts, nextAttemptAt: now() + backoffDelay(attempts) })
      scheduleRetry()
      return false
    }
  }

  function pending(): OfflineQueueState {
    return load()
  }

  function dispose(): void {
    if (retryTimer !== null) clearTimeoutFn(retryTimer as ReturnType<typeof setTimeout>)
    retryTimer = null
  }

  return { enqueue, flush, pending, dispose }
}

/** 自动补推：定时 + 恢复联网事件触发（仅浏览器环境） */
export function startAutoFlush(queue: ReturnType<typeof createOfflineQueue>, intervalMs = 60000): () => void {
  if (typeof window === 'undefined') return () => undefined
  const timer = window.setInterval(() => { void queue.flush() }, intervalMs)
  const onOnline = () => { void queue.flush() }
  window.addEventListener('online', onOnline)
  return () => {
    window.clearInterval(timer)
    window.removeEventListener('online', onOnline)
    queue.dispose()
  }
}

const browserStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null =
  typeof window !== 'undefined' ? window.localStorage : null

/**
 * 浏览器端单例：push 由调用方（store/utils）注入，避免与同步模块循环依赖。
 * SSR 环境下降级为不可用队列。
 */
let singletonPush: ((snapshot: string) => Promise<void>) | null = null
export function setOfflineQueuePush(fn: (snapshot: string) => Promise<void>): void {
  singletonPush = fn
}

export const offlineQueue = browserStorage
  ? createOfflineQueue({
      storage: browserStorage as Storage,
      push: (snapshot) => {
        if (!singletonPush) return Promise.reject(new Error('offline queue push not wired'))
        return singletonPush(snapshot)
      },
    })
  : createOfflineQueue({
      storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
      push: () => Promise.reject(new Error('offline queue unavailable during SSR')),
    })
