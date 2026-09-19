/**
 * 云同步负载信封（v2）：可选 gzip 压缩 + AES-256-GCM 端到端加密。
 * 未开启任何选项时保持旧版明文格式 { data, updatedAt }，与 Android 共享核心及旧版本互读兼容。
 */

interface EnvelopeV2 {
  v: 2
  updatedAt: string
  comp: 'gzip' | 'none'
  enc: 'aes-256-gcm' | 'none'
  /** base64；enc != none 时为 PBKDF2 salt(16B) */
  salt?: string
  /** base64；enc != none 时为 AES-GCM iv(12B) */
  iv?: string
  /** base64；明文为 gzip(JSON)（或仅 JSON），加密后为其密文 */
  data: string
}

const PBKDF2_ITERATIONS = 150_000

const b64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

const fromB64 = (s: string): Uint8Array => {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const te = new TextEncoder()
const td = new TextDecoder()

function supportsGzip(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  void writer.write(bytes as unknown as Uint8Array<ArrayBuffer>)
  void writer.close()
  const buf = await new Response(cs.readable).arrayBuffer()
  return new Uint8Array(buf)
}

async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  void writer.write(bytes as unknown as Uint8Array<ArrayBuffer>)
  void writer.close()
  const buf = await new Response(ds.readable).arrayBuffer()
  return new Uint8Array(buf)
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as Uint8Array<ArrayBuffer>, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export interface PackOptions {
  compress: boolean
  encrypt: boolean
  passphrase?: string
}

/** 打包同步负载；返回 JSON 字符串（用于 S3 PUT body） */
export async function packSyncPayload(data: Record<string, unknown>, opts: PackOptions): Promise<string> {
  const plaintext = JSON.stringify(data, (_k, v) => (v instanceof Date ? v.toISOString() : v))

  if (!opts.encrypt && !opts.compress) {
    return JSON.stringify({ data, updatedAt: new Date().toISOString() })
  }

  if (opts.encrypt && !opts.passphrase) {
    throw new Error('已开启端到端加密，但未填写同步口令')
  }

  let bytes: Uint8Array = te.encode(plaintext)
  let comp: EnvelopeV2['comp'] = 'none'
  if (opts.compress && supportsGzip()) {
    bytes = await gzipBytes(bytes)
    comp = 'gzip'
  }

  const env: EnvelopeV2 = {
    v: 2,
    updatedAt: new Date().toISOString(),
    comp,
    enc: 'none',
    data: b64(bytes),
  }

  if (opts.encrypt) {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const key = await deriveKey(opts.passphrase as string, salt)
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as Uint8Array<ArrayBuffer> },
      key,
      bytes as unknown as Uint8Array<ArrayBuffer>
    )
    env.enc = 'aes-256-gcm'
    env.salt = b64(salt)
    env.iv = b64(iv)
    env.data = b64(cipher)
  }

  return JSON.stringify(env)
}

/** 解包同步负载；兼容旧版明文与新信封。encrypted 但缺口令时抛错。 */
export async function unpackSyncPayload(raw: unknown, passphrase?: string): Promise<Record<string, unknown> | null> {
  const obj = raw as EnvelopeV2 | { data?: Record<string, unknown> } | null
  if (!obj || typeof obj !== 'object') return null
  if (!((obj as EnvelopeV2).v === 2)) {
    return (obj as { data?: Record<string, unknown> }).data ?? null
  }
  const env = obj as EnvelopeV2
  if (env.enc !== 'none' && env.enc !== 'aes-256-gcm') {
    throw new Error(`不支持的加密算法：${env.enc}`)
  }
  let bytes = fromB64(env.data)
  if (env.enc === 'aes-256-gcm') {
    if (!passphrase) throw new Error('云端数据已端到端加密，请在同步设置中填写同步口令')
    if (!env.salt || !env.iv) throw new Error('加密信封缺少 salt/iv 参数')
    const key = await deriveKey(passphrase, fromB64(env.salt))
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(env.iv) as unknown as Uint8Array<ArrayBuffer> },
      key,
      bytes as unknown as Uint8Array<ArrayBuffer>
    )
    bytes = new Uint8Array(plain)
  }
  if (env.comp === 'gzip') {
    if (!supportsGzip()) throw new Error('当前环境不支持 gzip 解压（需 Chrome 103+）')
    bytes = await gunzipBytes(bytes)
  }
  return JSON.parse(td.decode(bytes)) as Record<string, unknown>
}

/** 供测试：明文负载 → v2 压缩信封往返 */
export const __testing = { gzipBytes, gunzipBytes, supportsGzip }
