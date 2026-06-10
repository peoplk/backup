// S3 compatible sync layer using AWS Signature V4
const S3_CONFIG_KEY = 'focusflow-s3-config'
const DEFAULT_REMOTE_KEY = 'focusflow-sync.json'
const DEFAULT_POLL_INTERVAL = 30

export interface S3ConfigInput {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle?: boolean
  remoteKey?: string
  syncInterval?: number
}

interface StoredConfig {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  remoteKey: string
  syncInterval: number
}

export type S3Preset = {
  name: string
  region: string
  endpoint: string
  forcePathStyle: boolean
  description: string
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

export interface SyncState {
  status: SyncStatus
  lastSyncAt: Date | null
  error: string | null
  userId: string | null
  isEnabled: boolean
}

export const S3_PRESET_SERVICES: S3Preset[] = [
  { name: '阿里云 OSS · 杭州', region: 'oss-cn-hangzhou', endpoint: 'https://oss-cn-hangzhou.aliyuncs.com', forcePathStyle: true, description: '华东1（杭州）' },
  { name: '阿里云 OSS · 上海', region: 'oss-cn-shanghai', endpoint: 'https://oss-cn-shanghai.aliyuncs.com', forcePathStyle: true, description: '华东2（上海）' },
  { name: '阿里云 OSS · 北京', region: 'oss-cn-beijing', endpoint: 'https://oss-cn-beijing.aliyuncs.com', forcePathStyle: true, description: '华北2（北京）' },
  { name: '阿里云 OSS · 深圳', region: 'oss-cn-shenzhen', endpoint: 'https://oss-cn-shenzhen.aliyuncs.com', forcePathStyle: true, description: '华南1（深圳）' },
  { name: '阿里云 OSS · 广州', region: 'oss-cn-guangzhou', endpoint: 'https://oss-cn-guangzhou.aliyuncs.com', forcePathStyle: true, description: '华南2（广州）' },
  { name: '阿里云 OSS · 成都', region: 'oss-cn-chengdu', endpoint: 'https://oss-cn-chengdu.aliyuncs.com', forcePathStyle: true, description: '西南1（成都）' },
  { name: '阿里云 OSS · 香港', region: 'oss-cn-hongkong', endpoint: 'https://oss-cn-hongkong.aliyuncs.com', forcePathStyle: true, description: '香港' },
  { name: '阿里云 OSS · 新加坡', region: 'oss-ap-southeast-1', endpoint: 'https://oss-ap-southeast-1.aliyuncs.com', forcePathStyle: true, description: '新加坡' },
  { name: '阿里云 OSS · 美西', region: 'oss-us-west-1', endpoint: 'https://oss-us-west-1.aliyuncs.com', forcePathStyle: true, description: '美西1（硅谷）' },
  { name: 'MinIO', region: 'us-east-1', endpoint: '', forcePathStyle: true, description: '自建 MinIO，需填写地址' },
  { name: 'AWS S3', region: 'us-east-1', endpoint: 'https://s3.amazonaws.com', forcePathStyle: false, description: 'Amazon S3' },
  { name: '自定义 S3', region: '', endpoint: '', forcePathStyle: true, description: '任意 S3 兼容服务' },
]

let currentConfig: StoredConfig | null = (() => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(S3_CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredConfig>
    if (!parsed.endpoint || !parsed.bucket || !parsed.accessKeyId || !parsed.secretAccessKey) return null
    return {
      endpoint: parsed.endpoint,
      region: parsed.region || 'us-east-1',
      bucket: parsed.bucket,
      accessKeyId: parsed.accessKeyId,
      secretAccessKey: parsed.secretAccessKey,
      forcePathStyle: parsed.forcePathStyle ?? true,
      remoteKey: parsed.remoteKey || DEFAULT_REMOTE_KEY,
      syncInterval: parsed.syncInterval || DEFAULT_POLL_INTERVAL,
    }
  } catch {
    return null
  }
})()

function initS3(config: S3ConfigInput): boolean {
  if (!config.endpoint?.trim() || !config.bucket?.trim() || !config.accessKeyId?.trim() || !config.secretAccessKey?.trim()) {
    return false
  }
  currentConfig = {
    endpoint: config.endpoint.replace(/\/+$/, ''),
    region: config.region?.trim() || 'us-east-1',
    bucket: config.bucket.trim(),
    accessKeyId: config.accessKeyId.trim(),
    secretAccessKey: config.secretAccessKey,
    forcePathStyle: config.forcePathStyle ?? true,
    remoteKey: config.remoteKey?.trim() || DEFAULT_REMOTE_KEY,
    syncInterval: config.syncInterval || DEFAULT_POLL_INTERVAL,
  }
  return true
}

export function getIsS3Configured(): boolean {
  return !!currentConfig && !!currentConfig.endpoint && !!currentConfig.bucket && !!currentConfig.accessKeyId
}

export function getS3Config(): S3ConfigInput | null {
  if (!currentConfig) return null
  return { ...currentConfig }
}

export function saveS3Config(config: S3ConfigInput): boolean {
  if (!initS3(config)) return false
  if (typeof window !== 'undefined') {
    localStorage.setItem(S3_CONFIG_KEY, JSON.stringify(currentConfig))
  }
  return true
}

export function clearS3Config(): void {
  currentConfig = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem(S3_CONFIG_KEY)
  }
}

export function reinitializeS3(): boolean {
  if (typeof window === 'undefined') return false
  const raw = localStorage.getItem(S3_CONFIG_KEY)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConfig>
    if (!parsed.endpoint || !parsed.bucket || !parsed.accessKeyId || !parsed.secretAccessKey) return false
    currentConfig = {
      endpoint: parsed.endpoint,
      region: parsed.region || 'us-east-1',
      bucket: parsed.bucket,
      accessKeyId: parsed.accessKeyId,
      secretAccessKey: parsed.secretAccessKey,
      forcePathStyle: parsed.forcePathStyle ?? true,
      remoteKey: parsed.remoteKey || DEFAULT_REMOTE_KEY,
      syncInterval: parsed.syncInterval || DEFAULT_POLL_INTERVAL,
    }
    return true
  } catch {
    return false
  }
}

let syncStatusCallback: ((state: Partial<SyncState>) => void) | null = null

export function setS3SyncStatusCallback(cb: (state: Partial<SyncState>) => void) {
  syncStatusCallback = cb
}

function emitStatus(partial: Partial<SyncState>) {
  syncStatusCallback?.(partial)
}

const enc = new TextEncoder()

async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const buffer = typeof data === 'string' ? enc.encode(data) : data
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(key: Uint8Array | ArrayBuffer, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key instanceof Uint8Array ? (key.buffer as ArrayBuffer) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return new Uint8Array(sig)
}

async function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string = 's3'): Promise<Uint8Array> {
  const kDate = await hmacSha256(enc.encode(`AWS4${secretKey}`), dateStamp)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  return await hmacSha256(kService, 'aws4_request')
}

function uriEncode(str: string, encodeSlash = true): string {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    const ch = str.charAt(i)
    if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch === '_' || ch === '-' || ch === '~' || ch === '.') {
      result += ch
    } else if (ch === '/' && !encodeSlash) {
      result += ch
    } else {
      const bytes = new TextEncoder().encode(ch)
      for (const b of bytes) {
        result += '%' + b.toString(16).toUpperCase().padStart(2, '0')
      }
    }
  }
  return result
}

function getHostFromUrl(urlStr: string): string {
  try {
    return new URL(urlStr).host
  } catch {
    const match = urlStr.match(/^https?:\/\/([^\/]+)/)
    return match ? match[1] : ''
  }
}

function getPathnameFromUrl(urlStr: string): string {
  try {
    return new URL(urlStr).pathname
  } catch {
    const match = urlStr.match(/^https?:\/\/[^\/]+(\/.*)/)
    return match ? match[1] : '/'
  }
}

function buildS3Url(config: StoredConfig, objectKey: string): string {
  const endpoint = config.endpoint
  if (config.forcePathStyle) {
    return `${endpoint}/${config.bucket}/${uriEncode(objectKey, false)}`
  }
  const url = new URL(endpoint)
  return `${url.protocol}//${config.bucket}.${url.host}/${uriEncode(objectKey, false)}`
}

async function s3Request(
  method: 'PUT' | 'GET' | 'HEAD' | 'DELETE',
  config: StoredConfig,
  objectKey: string,
  options: { body?: ArrayBuffer | string; contentType?: string } = {}
): Promise<Response> {
  const service = 's3'
  const region = config.region || 'us-east-1'
  const now = new Date()
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const dateStamp = amzDate.substring(0, 8)

  const url = buildS3Url(config, objectKey)

  let payloadHash: string
  if (options.body) {
    const bodyData = typeof options.body === 'string' ? enc.encode(options.body) : new Uint8Array(options.body)
    payloadHash = await sha256Hex(bodyData.buffer as unknown as ArrayBuffer)
  } else {
    payloadHash = await sha256Hex('')
  }

  const host = getHostFromUrl(url)
  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  if (options.contentType) {
    headers['content-type'] = options.contentType
  }

  const signedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort()
  const signedHeaders = signedHeaderKeys.join(';')
  const canonicalHeaders = signedHeaderKeys
    .map(k => `${k}:${headers[k.toLowerCase() as keyof typeof headers] ?? headers[k]}\n`)
    .join('')

  const canonicalQueryString = ''
  const pathname = getPathnameFromUrl(url)
  const canonicalRequest = [
    method,
    uriEncode(pathname, false),
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = await getSigningKey(config.secretAccessKey, dateStamp, region, service)
  const signatureBuffer = await hmacSha256(signingKey, stringToSign)
  const signature = Array.from(signatureBuffer).map(b => b.toString(16).padStart(2, '0')).join('')

  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const requestHeaders: Record<string, string> = {
    ...headers,
    Authorization: authorization,
  }
  delete requestHeaders.host

  return fetch(url, {
    method,
    headers: requestHeaders,
    body: options.body || undefined,
  })
}

function fnv1a32(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

function deriveUserId(accessKeyId: string): string {
  return `s3-${fnv1a32(accessKeyId)}`
}

export async function ensureS3Auth(): Promise<string | null> {
  if (!getIsS3Configured() || !currentConfig) return null
  return deriveUserId(currentConfig.accessKeyId)
}

export function getCurrentS3User(): string | null {
  return currentConfig?.accessKeyId ?? null
}

export async function testS3Connection(config: S3ConfigInput): Promise<{ success: boolean; message: string }> {
  if (!config.endpoint?.trim()) return { success: false, message: '请填写 Endpoint' }
  if (!config.bucket?.trim()) return { success: false, message: '请填写 Bucket 名称' }
  if (!config.accessKeyId?.trim()) return { success: false, message: '请填写 AccessKey ID' }
  if (!config.secretAccessKey?.trim()) return { success: false, message: '请填写 AccessKey Secret' }

  const stored: StoredConfig = {
    endpoint: config.endpoint.replace(/\/+$/, ''),
    region: config.region?.trim() || 'us-east-1',
    bucket: config.bucket.trim(),
    accessKeyId: config.accessKeyId.trim(),
    secretAccessKey: config.secretAccessKey,
    forcePathStyle: config.forcePathStyle ?? true,
    remoteKey: config.remoteKey?.trim() || DEFAULT_REMOTE_KEY,
    syncInterval: config.syncInterval || DEFAULT_POLL_INTERVAL,
  }

  try {
    const res = await s3Request('HEAD', stored, stored.remoteKey)
    if (res.ok) return { success: true, message: '连接成功（对象已存在）' }
    if (res.status === 404) return { success: true, message: '连接成功（对象不存在，推送时将自动创建）' }

    const errBody = await res.text().catch(() => '')
    const ossCode = errBody.match(/<Code>([^<]+)<\/Code>/)?.[1]
    const ossMsg = errBody.match(/<Message>([^<]+)<\/Message>/)?.[1]
    const detail = [ossCode, ossMsg].filter(Boolean).join(' · ')
    const requestId = res.headers.get('x-amz-request-id') || res.headers.get('x-oss-request-id') || ''

    if (res.status === 403) {
      return { success: false, message: `认证失败或无访问权限（${detail || '请检查 AccessKey 与 Bucket'}）${requestId ? ' · RequestId: ' + requestId : ''}` }
    }
    if (res.status === 400 && /SignatureDoesNotMatch/i.test(detail)) {
      return { success: false, message: `签名不匹配（${detail}）${requestId ? ' · RequestId: ' + requestId : ''}` }
    }
    return { success: false, message: `服务器返回 ${res.status}${detail ? ' · ' + detail : ''}${requestId ? ' · RequestId: ' + requestId : ''}` }
  } catch (err) {
    const raw = err instanceof Error ? err.message : '连接失败'
    if (/failed to fetch|networkerror|load failed/i.test(raw)) {
      return {
        success: false,
        message: `网络/CORS 错误：${raw}。浏览器端调用 S3 需配置 Bucket CORS 规则（来源: ${typeof location !== 'undefined' ? location.origin : '本应用'}，方法: GET/HEAD/PUT，允许 Headers: x-amz-content-sha256, x-amz-date, Authorization, Content-Type）。`,
      }
    }
    return { success: false, message: raw }
  }
}

export async function syncToS3(_userId: string, data: Record<string, unknown>): Promise<void> {
  if (!getIsS3Configured() || !currentConfig) {
    throw new Error('S3 未配置')
  }
  emitStatus({ status: 'syncing', error: null })
  try {
    const body = JSON.stringify({ data, updatedAt: new Date().toISOString() })
    const res = await s3Request('PUT', currentConfig, currentConfig.remoteKey, { body, contentType: 'application/json' })
    if (!res.ok && res.status !== 200 && res.status !== 201) {
      const errText = await res.text().catch(() => '')
      const code = errText.match(/<Code>([^<]+)<\/Code>/)?.[1]
      const msg = errText.match(/<Message>([^<]+)<\/Message>/)?.[1]
      throw new Error(`上传失败：${res.status}${code ? ' · ' + code : ''}${msg ? ' · ' + msg : ''}`)
    }
    emitStatus({ status: 'synced', lastSyncAt: new Date(), error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : '上传失败'
    emitStatus({ status: 'error', error: message })
    throw err
  }
}

export async function syncFromS3(_userId: string): Promise<Record<string, unknown> | null> {
  if (!getIsS3Configured() || !currentConfig) return null
  const res = await s3Request('GET', currentConfig, currentConfig.remoteKey)
  if (res.status === 404) return null
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    const code = errText.match(/<Code>([^<]+)<\/Code>/)?.[1]
    throw new Error(`下载失败：${res.status}${code ? ' · ' + code : ''}`)
  }
  const json = (await res.json()) as { data?: Record<string, unknown> } | null
  return json?.data ?? null
}

export function subscribeToS3(userId: string, callback: (data: Record<string, unknown>) => void): () => void {
  const interval = (currentConfig?.syncInterval || DEFAULT_POLL_INTERVAL) * 1000
  let stopped = false

  const tick = async () => {
    if (stopped) return
    try {
      const data = await syncFromS3(userId)
      if (data) callback(data)
    } catch {
      // silent
    }
  }

  tick()
  const timer = setInterval(tick, interval)

  return () => {
    stopped = true
    clearInterval(timer)
  }
}

export async function mergeLocalAndS3(userId: string, localData: Record<string, unknown>): Promise<Record<string, unknown>> {
  const cloud = await syncFromS3(userId)
  if (!cloud) {
    await syncToS3(userId, localData)
    return localData
  }

  const merged: Record<string, unknown> = { ...cloud }
  for (const key of Object.keys(localData)) {
    const localValue = localData[key]
    const cloudValue = cloud[key]

    if (Array.isArray(localValue) && Array.isArray(cloudValue)) {
      const localMap = new Map((localValue as Array<{ id: string; updatedAt?: Date | string }>).map((it) => [it.id, it]))
      const cloudMap = new Map((cloudValue as Array<{ id: string; updatedAt?: Date | string }>).map((it) => [it.id, it]))
      const mergedMap = new Map(cloudMap)
      for (const [id, localItem] of localMap) {
        const cloudItem = cloudMap.get(id)
        if (!cloudItem) {
          mergedMap.set(id, localItem)
        } else {
          const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0
          const cloudTime = (cloudItem as { updatedAt?: Date | string }).updatedAt ? new Date((cloudItem as { updatedAt?: Date | string }).updatedAt!).getTime() : 0
          if (localTime > cloudTime) mergedMap.set(id, localItem)
        }
      }
      merged[key] = Array.from(mergedMap.values())
    } else if (localValue !== undefined) {
      merged[key] = localValue
    }
  }

  await syncToS3(userId, merged)
  return merged
}

export async function signOutS3(): Promise<void> {
  emitStatus({ status: 'idle' })
}
