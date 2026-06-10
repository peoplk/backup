// 阿里云 OSS 同步层
// 浏览器端使用 REST API + HMAC-SHA1 签名（OSS v1 签名），无需 SDK
// 仅实现最小可用：putObject（推送）/ getObject（拉取）/ headBucket（测试连接）
// 参考：https://help.aliyun.com/zh/oss/developer-reference/restful-overview

const OSS_CONFIG_KEY = 'focusflow-oss-config'
const DEFAULT_REMOTE_KEY = 'focusflow-sync.json'

export interface OSSConfigInput {
  /** 形如 https://oss-cn-hangzhou.aliyuncs.com */
  endpoint: string
  bucket: string
  /** AccessKey ID */
  accessKeyId: string
  /** AccessKey Secret */
  accessKeySecret: string
  /** 远端对象 Key，默认 focusflow-sync.json */
  remoteKey?: string
  /** 轮询间隔（秒） */
  syncInterval?: number
}

interface StoredConfig {
  endpoint: string
  bucket: string
  accessKeyId: string
  accessKeySecret: string
  remoteKey: string
  syncInterval: number
}

export type OSSPreset = {
  name: string
  region: string
  endpoint: string
  description: string
}

/** 常用 OSS Region 预设 —— 用户只需选 Region 即可 */
export const OSS_PRESET_REGIONS: OSSPreset[] = [
  { name: '杭州', region: 'oss-cn-hangzhou', endpoint: 'https://oss-cn-hangzhou.aliyuncs.com', description: '华东1（杭州）' },
  { name: '上海', region: 'oss-cn-shanghai', endpoint: 'https://oss-cn-shanghai.aliyuncs.com', description: '华东2（上海）' },
  { name: '北京', region: 'oss-cn-beijing', endpoint: 'https://oss-cn-beijing.aliyuncs.com', description: '华北2（北京）' },
  { name: '深圳', region: 'oss-cn-shenzhen', endpoint: 'https://oss-cn-shenzhen.aliyuncs.com', description: '华南1（深圳）' },
  { name: '广州', region: 'oss-cn-guangzhou', endpoint: 'https://oss-cn-guangzhou.aliyuncs.com', description: '华南2（广州）' },
  { name: '成都', region: 'oss-cn-chengdu', endpoint: 'https://oss-cn-chengdu.aliyuncs.com', description: '西南1（成都）' },
  { name: '香港', region: 'oss-cn-hongkong', endpoint: 'https://oss-cn-hongkong.aliyuncs.com', description: '香港' },
  { name: '新加坡', region: 'oss-ap-southeast-1', endpoint: 'https://oss-ap-southeast-1.aliyuncs.com', description: '新加坡' },
  { name: '美西', region: 'oss-us-west-1', endpoint: 'https://oss-us-west-1.aliyuncs.com', description: '美西1（硅谷）' },
]

let currentConfig: StoredConfig | null = (() => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(OSS_CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredConfig>
    if (!parsed.endpoint || !parsed.bucket || !parsed.accessKeyId || !parsed.accessKeySecret) return null
    return {
      endpoint: parsed.endpoint,
      bucket: parsed.bucket,
      accessKeyId: parsed.accessKeyId,
      accessKeySecret: parsed.accessKeySecret,
      remoteKey: parsed.remoteKey || DEFAULT_REMOTE_KEY,
      syncInterval: parsed.syncInterval || 30,
    }
  } catch {
    return null
  }
})()

function initOSS(config: OSSConfigInput): boolean {
  if (!config.endpoint?.trim() || !config.bucket?.trim() || !config.accessKeyId?.trim() || !config.accessKeySecret?.trim()) {
    return false
  }
  currentConfig = {
    endpoint: config.endpoint.replace(/\/+$/, ''),
    bucket: config.bucket.trim(),
    accessKeyId: config.accessKeyId.trim(),
    accessKeySecret: config.accessKeySecret,
    remoteKey: config.remoteKey?.trim() || DEFAULT_REMOTE_KEY,
    syncInterval: config.syncInterval || 30,
  }
  return true
}

export function getIsOSSConfigured(): boolean {
  return !!currentConfig
}

export function getOSSConfig(): OSSConfigInput | null {
  if (!currentConfig) return null
  return { ...currentConfig }
}

export function saveOSSConfig(config: OSSConfigInput): boolean {
  if (!initOSS(config)) return false
  if (typeof window !== 'undefined') {
    localStorage.setItem(OSS_CONFIG_KEY, JSON.stringify(currentConfig))
  }
  return true
}

export function clearOSSConfig(): void {
  currentConfig = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem(OSS_CONFIG_KEY)
  }
}

export function reinitializeOSS(): boolean {
  if (typeof window === 'undefined') return false
  const raw = localStorage.getItem(OSS_CONFIG_KEY)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConfig>
    if (!parsed.endpoint || !parsed.bucket || !parsed.accessKeyId || !parsed.accessKeySecret) return false
    currentConfig = {
      endpoint: parsed.endpoint,
      bucket: parsed.bucket,
      accessKeyId: parsed.accessKeyId,
      accessKeySecret: parsed.accessKeySecret,
      remoteKey: parsed.remoteKey || DEFAULT_REMOTE_KEY,
      syncInterval: parsed.syncInterval || 30,
    }
    return true
  } catch {
    return false
  }
}

// ============================================================
// OSS REST API 签名
// ============================================================

/** Base64 编码（兼容 Node / 浏览器） */
function base64Encode(data: ArrayBuffer | Uint8Array | string): string {
  if (typeof btoa === 'function') {
    if (typeof data === 'string') return btoa(unescape(encodeURIComponent(data)))
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Buffer = (globalThis as any).Buffer
  if (Buffer) return Buffer.from(data instanceof Uint8Array ? data : data, 'utf-8').toString('base64')
  return ''
}

/** HMAC-SHA1，返回 base64 字符串（OSS v1 签名需要 base64） */
async function hmacSha1Base64(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return base64Encode(new Uint8Array(sig))
}

/** 构造 OSS v1 签名
 *
 * 重要：使用 x-oss-date 头而不是 HTTP Date 头。
 *
 * 原因：浏览器/Electron 的 fetch 规范把 `Date` 列为 Forbidden Header Name，
 * 会默默丢弃用户设置的 Date 头，导致签名中的 Date 与实际请求头中的 Date 不一致，
 * 触发 SignatureDoesNotMatch 错误。
 *
 * OSS 规范明确支持 x-oss-date 自定义头作为 Date 的替代，
 * 不受 Forbidden Header 限制，因此是浏览器端 OSS 客户端的标准做法。
 *
 * 详见：https://help.aliyun.com/zh/oss/developer-reference/calculate-the-signature
 *      https://fetch.spec.whatwg.org/#forbidden-header-name
 */
async function signOSSRequest(
  method: 'PUT' | 'GET' | 'HEAD',
  config: StoredConfig,
  objectKey: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ url: string; headers: Record<string, string> }> {
  // 用 ISO 8601 格式（UTC）—— OSS 规范要求
  const ossDate = new Date().toUTCString()
  const contentType = extraHeaders['Content-Type'] || ''
  // CanonicalizedResource: /bucket/object-key，object key 需 URL 编码（保留 /）
  const encodedKey = encodeURIComponent(objectKey)
    .replace(/%2F/g, '/')
    .replace(/\+/g, '%20')
  const objectResource = `/${config.bucket}/${encodedKey}`

  // StringToSign: VERB + "\n" + Content-MD5 + "\n" + Content-Type + "\n" + x-oss-date + "\n" + CanonicalizedOSSHeaders + CanonicalizedResource
  // 注意：使用 x-oss-date 时，StringToSign 中也用同一个值
  const stringToSign = [
    method,
    '',
    contentType,
    ossDate,
    '',
    objectResource,
  ].join('\n')

  const signature = await hmacSha1Base64(config.accessKeySecret, stringToSign)
  const authorization = `OSS ${config.accessKeyId}:${signature}`

  const url = `${config.endpoint}/${config.bucket}/${encodedKey}`
  return {
    url,
    headers: {
      // 关键：用 x-oss-date 而不是 Date，避免 Forbidden Header 拦截
      'x-oss-date': ossDate,
      Authorization: authorization,
      ...extraHeaders,
    },
  }
}

/** 把 username 转成稳定 userId（用作日志/标识） */
function deriveUserId(accessKeyId: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < accessKeyId.length; i++) {
    h ^= accessKeyId.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `oss-${h.toString(16).padStart(8, '0')}`
}

export async function ensureOSSAuth(): Promise<string | null> {
  if (!getIsOSSConfigured() || !currentConfig) return null
  return deriveUserId(currentConfig.accessKeyId)
}

// ============================================================
// 连接测试 / 推送 / 拉取
// ============================================================

export async function testOSSConnection(
  config: OSSConfigInput
): Promise<{ success: boolean; message: string }> {
  if (!config.endpoint?.trim()) return { success: false, message: '请选择或填写 Endpoint' }
  if (!config.bucket?.trim()) return { success: false, message: '请填写 Bucket 名称' }
  if (!config.accessKeyId?.trim()) return { success: false, message: '请填写 AccessKey ID' }
  if (!config.accessKeySecret?.trim()) return { success: false, message: '请填写 AccessKey Secret' }

  const stored: StoredConfig = {
    endpoint: config.endpoint.replace(/\/+$/, ''),
    bucket: config.bucket.trim(),
    accessKeyId: config.accessKeyId.trim(),
    accessKeySecret: config.accessKeySecret,
    remoteKey: config.remoteKey?.trim() || DEFAULT_REMOTE_KEY,
    syncInterval: config.syncInterval || 30,
  }
  try {
    const { url, headers } = await signOSSRequest('HEAD', stored, stored.remoteKey)
    const res = await fetch(url, { method: 'HEAD', headers })
    if (res.ok) return { success: true, message: '连接成功' }
    if (res.status === 404) return { success: true, message: '连接成功（对象不存在，推送时将自动创建）' }
    // 尝试读取 OSS 服务端返回的 XML 错误信息（含 Code/Message/RequestId）
    const errBody = await res.text().catch(() => '')
    const ossCode = errBody.match(/<Code>([^<]+)<\/Code>/)?.[1]
    const ossMsg = errBody.match(/<Message>([^<]+)<\/Message>/)?.[1]
    const requestId = res.headers.get('x-oss-request-id') || ''
    const detail = [ossCode, ossMsg].filter(Boolean).join(' · ')
    if (res.status === 403) {
      return { success: false, message: `认证失败或无访问权限（${detail || '请检查 AccessKey 与 Bucket'}）${requestId ? ' · RequestId: ' + requestId : ''}` }
    }
    if (res.status === 401) {
      return { success: false, message: `认证失败，请检查 AccessKey ID/Secret${requestId ? ' · RequestId: ' + requestId : ''}` }
    }
    if (res.status === 400 && /SignatureDoesNotMatch/i.test(detail)) {
      return { success: false, message: `签名不匹配（${detail}）${requestId ? ' · RequestId: ' + requestId : ''} · 提示：浏览器会自动剥离 Date 头，已改用 x-oss-date 头` }
    }
    return { success: false, message: `服务器返回 ${res.status}${detail ? ' · ' + detail : ''}${requestId ? ' · RequestId: ' + requestId : ''}` }
  } catch (err) {
    const raw = err instanceof Error ? err.message : '连接失败'
    // 浏览器/桌面 WebView 调 OSS 的最常见失败原因 —— CORS 没配置
    if (/failed to fetch|networkerror|load failed/i.test(raw)) {
      return {
        success: false,
        message: `网络/CORS 错误：${raw}。浏览器端调用 OSS 必须在 Bucket 配置 CORS 规则（来源: ${typeof location !== 'undefined' ? location.origin : '本应用'}，方法: GET/HEAD/PUT/POST，允许 Headers: x-oss-date, Authorization, Content-Type）。如果 Bucket 已设公共读，文件直连可以，但 API 仍需 CORS。`,
      }
    }
    return { success: false, message: raw }
  }
}

export async function syncToOSS(
  _userId: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!getIsOSSConfigured() || !currentConfig) {
    throw new Error('OSS 未配置')
  }
  const body = JSON.stringify({ data, updatedAt: new Date().toISOString() })
  const { url, headers } = await signOSSRequest('PUT', currentConfig, currentConfig.remoteKey, {
    'Content-Type': 'application/json',
  })
  const res = await fetch(url, { method: 'PUT', headers, body })
  if (!res.ok) {
    throw new Error(`上传失败：${res.status} ${res.statusText}`)
  }
}

export async function syncFromOSS(
  _userId: string
): Promise<Record<string, unknown> | null> {
  if (!getIsOSSConfigured() || !currentConfig) return null
  const { url, headers } = await signOSSRequest('GET', currentConfig, currentConfig.remoteKey)
  const res = await fetch(url, { method: 'GET', headers })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`下载失败：${res.status}`)
  const json = (await res.json()) as { data?: Record<string, unknown> } | null
  return json?.data ?? null
}
