// WebDAV 同步层
// 通过 HTTP Basic Auth 与 WebDAV 服务器交互，提供与 firebase.ts / supabase.ts 对等的同步能力
// 无 SDK 依赖，浏览器/Node 环境通用

const WEBDAV_CONFIG_KEY = 'focusflow-webdav-config'
const DEFAULT_REMOTE_PATH = 'focusflow'
const DEFAULT_POLL_INTERVAL = 30 // 秒

export interface WebDAVConfigInput {
  serverUrl: string
  username: string
  password: string
  remotePath?: string
  syncInterval?: number
}

interface StoredConfig {
  serverUrl: string
  username: string
  password: string
  remotePath: string
  syncInterval: number
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

export interface SyncState {
  status: SyncStatus
  lastSyncAt: Date | null
  error: string | null
  userId: string | null
  isEnabled: boolean
}

export type SyncProtocol = 'webdav' | 'oss'

export type WebDAVPreset = {
  /** 协议类型 —— 决定推送/拉取走 webdav.ts 还是 aliyun-oss.ts */
  protocol: SyncProtocol
  name: string
  url: string
  description: string
}

/**
 * 预设服务列表
 * 1. 坚果云（默认）—— WebDAV
 * 2. 阿里云 OSS —— 使用 AccessKey + HMAC-SHA1 签名，无需 SDK
 * 3. 自定义 —— WebDAV
 */
export const WebDAV_PRESET_SERVERS: WebDAVPreset[] = [
  {
    protocol: 'webdav',
    name: '坚果云',
    url: 'https://dav.jianguoyun.com/dav/',
    description: '国内常用 WebDAV 服务，建议使用应用专用密码',
  },
  {
    protocol: 'oss',
    name: '阿里云 OSS',
    url: 'oss://',
    description: '对象存储，需 AccessKey + Bucket',
  },
  {
    protocol: 'webdav',
    name: '自定义',
    url: '',
    description: '输入你自己的 WebDAV 服务器地址',
  },
]

/** 根据预设名识别协议 */
export function getPresetProtocol(presetName: string): SyncProtocol {
  const preset = WebDAV_PRESET_SERVERS.find((p) => p.name === presetName)
  return preset?.protocol ?? 'webdav'
}

export function getPresetServers(): WebDAVPreset[] {
  return WebDAV_PRESET_SERVERS
}

function loadStoredConfig(): StoredConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(WEBDAV_CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredConfig>
    if (!parsed.serverUrl || !parsed.username) return null
    return {
      serverUrl: parsed.serverUrl,
      username: parsed.username,
      password: parsed.password ?? '',
      remotePath: parsed.remotePath || DEFAULT_REMOTE_PATH,
      syncInterval: parsed.syncInterval || DEFAULT_POLL_INTERVAL,
    }
  } catch {
    return null
  }
}

let currentConfig: StoredConfig | null = loadStoredConfig()

function initWebDAV(config: WebDAVConfigInput): boolean {
  if (!config.serverUrl?.trim() || !config.username?.trim()) return false
  currentConfig = {
    serverUrl: config.serverUrl.replace(/\/+$/, ''),
    username: config.username,
    password: config.password,
    remotePath: config.remotePath?.trim() || DEFAULT_REMOTE_PATH,
    syncInterval: config.syncInterval || DEFAULT_POLL_INTERVAL,
  }
  return true
}

export function getIsWebDAVConfigured(): boolean {
  return !!currentConfig && !!currentConfig.serverUrl && !!currentConfig.username
}

export function getWebDAVConfig(): WebDAVConfigInput | null {
  if (!currentConfig) return null
  return { ...currentConfig }
}

export function saveWebDAVConfig(config: WebDAVConfigInput): boolean {
  if (!config.serverUrl?.trim() || !config.username?.trim()) return false
  const stored: StoredConfig = {
    serverUrl: config.serverUrl.replace(/\/+$/, ''),
    username: config.username,
    password: config.password,
    remotePath: config.remotePath?.trim() || DEFAULT_REMOTE_PATH,
    syncInterval: config.syncInterval || DEFAULT_POLL_INTERVAL,
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(stored))
  }
  return initWebDAV(config)
}

export function clearWebDAVConfig(): void {
  currentConfig = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem(WEBDAV_CONFIG_KEY)
  }
}

export function reinitializeWebDAV(): boolean {
  currentConfig = null
  const stored = loadStoredConfig()
  if (!stored) return false
  return initWebDAV(stored)
}

let syncStatusCallback: ((state: Partial<SyncState>) => void) | null = null

export function setWebDAVSyncStatusCallback(cb: (state: Partial<SyncState>) => void) {
  syncStatusCallback = cb
}

function emitStatus(partial: Partial<SyncState>) {
  syncStatusCallback?.(partial)
}

function buildAuthHeader(user: string, pass: string): string {
  const raw = `${user}:${pass}`
  if (typeof btoa === 'function') {
    return `Basic ${btoa(unescape(encodeURIComponent(raw)))}`
  }
  // 兼容 Node 环境（SSR/build）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return `Basic ${(globalThis as any).Buffer.from(raw, 'utf-8').toString('base64')}`
}

function fnv1a32(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** 把 username 转成稳定的 userId（用作远端目录名） */
function deriveUserId(username: string): string {
  return `webdav-${fnv1a32(username)}`
}

function getRemoteFilePath(userId: string): string {
  const base = currentConfig?.remotePath || DEFAULT_REMOTE_PATH
  return `${base.replace(/^\/+|\/+$/g, '')}/users/${userId}/sync.json`
}

/**
 * WebDAV 没有真正的鉴权流程。
 * 这里校验配置是否完整，并返回基于用户名的稳定 userId。
 */
export async function ensureWebDAVAuth(): Promise<string | null> {
  if (!getIsWebDAVConfigured() || !currentConfig) return null
  return deriveUserId(currentConfig.username)
}

export function getCurrentWebDAVUser(): string | null {
  return currentConfig?.username ?? null
}

/** 用 MKCOL 逐层创建目录（很多 WebDAV 服务器不支持自动建父目录） */
async function ensureDirectory(fullDirUrl: string, auth: string): Promise<void> {
  // fullDirUrl 是完整的 URL，如 https://dav.example.com/focusflow/users/abc
  // 需要逐层 MKCOL，但只创建 remotePath 下的子目录（服务器根目录应已存在）
  try {
    const url = new URL(fullDirUrl)
    const segments = url.pathname.split('/').filter(Boolean)
    // 从 remotePath 对应的层级开始逐层创建
    let acc = url.origin
    for (const seg of segments) {
      acc += '/' + seg
      const res = await fetch(acc, { method: 'MKCOL', headers: { Authorization: auth } })
      if (res.ok || res.status === 405 || res.status === 301) {
        // 405 = 已存在, 301 = 重定向, 都继续
        continue
      }
      // 其他错误码不中断——目录可能已存在但服务器返回了非标准状态码
    }
  } catch {
    // URL 解析失败或网络错误，静默忽略
    // syncToWebDAV 的 PUT 会在目录不存在时给出更明确的错误
  }
}

export async function testWebDAVConnection(
  config: WebDAVConfigInput
): Promise<{ success: boolean; message: string }> {
  if (!config.serverUrl?.trim()) {
    return { success: false, message: '请填写服务器地址' }
  }
  if (!config.username?.trim()) {
    return { success: false, message: '请填写用户名' }
  }
  const serverUrl = config.serverUrl.replace(/\/+$/, '')
  const auth = buildAuthHeader(config.username, config.password)
  try {
    // 用 PROPFIND Depth: 0 探测根
    const res = await fetch(serverUrl + '/', {
      method: 'PROPFIND',
      headers: { Authorization: auth, Depth: '0' },
    })
    if (res.ok || res.status === 207) {
      return { success: true, message: '连接成功' }
    }
    if (res.status === 401) return { success: false, message: '认证失败，请检查用户名或密码' }
    if (res.status === 403) return { success: false, message: '无访问权限' }
    if (res.status === 404) return { success: false, message: '服务器地址不正确' }
    return { success: false, message: `服务器返回 ${res.status}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : '连接失败'
    return { success: false, message }
  }
}

export async function syncToWebDAV(
  userId: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!getIsWebDAVConfigured() || !currentConfig) {
    throw new Error('WebDAV 未配置')
  }
  emitStatus({ status: 'syncing', error: null })
  try {
    const filePath = getRemoteFilePath(userId)
    const fullUrl = `${currentConfig.serverUrl}/${filePath}`
    const auth = buildAuthHeader(currentConfig.username, currentConfig.password)
    // 先确保父目录存在
    const dirUrl = fullUrl.substring(0, fullUrl.lastIndexOf('/'))
    await ensureDirectory(dirUrl, auth)

    const body = JSON.stringify({ data, updatedAt: new Date().toISOString() })
    const res = await fetch(fullUrl, {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok && res.status !== 201 && res.status !== 204) {
      throw new Error(`上传失败：${res.status}`)
    }
    emitStatus({ status: 'synced', lastSyncAt: new Date(), error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : '上传失败'
    emitStatus({ status: 'error', error: message })
    throw err
  }
}

export async function syncFromWebDAV(
  userId: string
): Promise<Record<string, unknown> | null> {
  if (!getIsWebDAVConfigured() || !currentConfig) return null
  const filePath = getRemoteFilePath(userId)
  const fullUrl = `${currentConfig.serverUrl}/${filePath}`
  const auth = buildAuthHeader(currentConfig.username, currentConfig.password)
  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: { Authorization: auth },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`下载失败：${res.status}`)
  const json = (await res.json()) as { data?: Record<string, unknown> } | null
  return json?.data ?? null
}

export function subscribeToWebDAV(
  userId: string,
  callback: (data: Record<string, unknown>) => void
): () => void {
  // WebDAV 无服务器推送，使用轮询
  const interval = (currentConfig?.syncInterval || DEFAULT_POLL_INTERVAL) * 1000
  let stopped = false

  const tick = async () => {
    if (stopped) return
    try {
      const data = await syncFromWebDAV(userId)
      if (data) callback(data)
    } catch {
      // 静默失败，避免影响主循环
    }
  }

  // 立即拉一次，然后定时轮询
  tick()
  const timer = setInterval(tick, interval)

  return () => {
    stopped = true
    clearInterval(timer)
  }
}

export async function mergeLocalAndWebDAV(
  userId: string,
  localData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const cloud = await syncFromWebDAV(userId)
  if (!cloud) {
    await syncToWebDAV(userId, localData)
    return localData
  }

  const merged: Record<string, unknown> = { ...cloud }
  for (const key of Object.keys(localData)) {
    const localValue = localData[key]
    const cloudValue = cloud[key]

    if (Array.isArray(localValue) && Array.isArray(cloudValue)) {
      const localMap = new Map(
        (localValue as Array<{ id: string; updatedAt?: Date | string }>).map((it) => [it.id, it])
      )
      const cloudMap = new Map(
        (cloudValue as Array<{ id: string; updatedAt?: Date | string }>).map((it) => [it.id, it])
      )
      const mergedMap = new Map(cloudMap)
      for (const [id, localItem] of localMap) {
        const cloudItem = cloudMap.get(id)
        if (!cloudItem) {
          mergedMap.set(id, localItem)
        } else {
          const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0
          const cloudTime = (cloudItem as { updatedAt?: Date | string }).updatedAt
            ? new Date((cloudItem as { updatedAt?: Date | string }).updatedAt!).getTime()
            : 0
          if (localTime > cloudTime) mergedMap.set(id, localItem)
        }
      }
      merged[key] = Array.from(mergedMap.values())
    } else if (localValue !== undefined) {
      merged[key] = localValue
    }
  }

  await syncToWebDAV(userId, merged)
  return merged
}

export async function signOutWebDAV(): Promise<void> {
  // WebDAV 没有真正的"注销"概念——只清空内存中的会话标识
  // 配置仍保留在 localStorage
  emitStatus({ status: 'idle' })
}
