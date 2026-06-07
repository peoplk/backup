import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_CONFIG_KEY = 'focusflow-supabase-config'

export interface SupabaseConfigInput {
  url: string
  anonKey: string
  /**
   * 可选：表名。默认 `focusflow_state`。
   * 适配器会把整个 store JSON 写入到该表的 `data` 字段，
   * 主键 `user_id` 用来区分不同用户。
   */
  tableName?: string
}

interface StoredConfig {
  url: string
  anonKey: string
  tableName: string
}

function loadStoredConfig(): StoredConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return null
}

function buildConfig(): StoredConfig | null {
  const stored = loadStoredConfig()
  if (stored) return stored
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && anonKey) {
    return { url, anonKey, tableName: 'focusflow_state' }
  }
  return null
}

let supabaseClient: SupabaseClient | null = null
let currentUserId: string | null = null
let currentConfig: StoredConfig | null = null

function tryInitFromStorageOrEnv(): boolean {
  const config = buildConfig()
  if (!config) return false
  return initSupabase(config)
}

function initSupabase(config: StoredConfig): boolean {
  try {
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
    currentConfig = config
    return true
  } catch (err) {
    console.warn('Supabase initialization failed', err)
    supabaseClient = null
    currentConfig = null
    return false
  }
}

tryInitFromStorageOrEnv()

export function getIsSupabaseConfigured(): boolean {
  return !!supabaseClient && !!currentConfig
}

export function getSupabaseConfig(): SupabaseConfigInput | null {
  if (!currentConfig) return null
  return {
    url: currentConfig.url,
    anonKey: currentConfig.anonKey,
    tableName: currentConfig.tableName,
  }
}

export function saveSupabaseConfig(config: SupabaseConfigInput): boolean {
  if (!config.url || !config.anonKey) return false
  const tableName = config.tableName?.trim() || 'focusflow_state'
  if (typeof window !== 'undefined') {
    localStorage.setItem(
      SUPABASE_CONFIG_KEY,
      JSON.stringify({ url: config.url, anonKey: config.anonKey, tableName })
    )
  }
  return initSupabase({ url: config.url, anonKey: config.anonKey, tableName })
}

export function reinitializeSupabase(): boolean {
  supabaseClient = null
  currentConfig = null
  currentUserId = null
  return tryInitFromStorageOrEnv()
}

function getClient(): SupabaseClient | null {
  return supabaseClient
}

function getTableName(): string {
  return currentConfig?.tableName || 'focusflow_state'
}

function generateUserId(): string {
  const key = 'focusflow-supabase-anonymous-id'
  if (typeof window === 'undefined') return 'ssr-user'
  let id = localStorage.getItem(key)
  if (!id) {
    id = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(key, id)
  }
  return id
}

/**
 * 确保一个稳定的用户 ID。
 * - 优先使用当前已登录用户
 * - 否则使用 localStorage 中的匿名 ID
 */
export async function ensureSupabaseAuth(): Promise<string | null> {
  const client = getClient()
  if (!client) return null

  try {
    const { data } = await client.auth.getSession()
    if (data.session?.user?.id) {
      currentUserId = data.session.user.id
      return currentUserId
    }
  } catch {
    /* ignore */
  }

  // 未登录则使用匿名 ID
  currentUserId = generateUserId()
  return currentUserId
}

export function getCurrentSupabaseUserId(): string | null {
  return currentUserId
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'synced' | 'error'
  lastSyncAt: Date | null
  error: string | null
  userId: string | null
  isEnabled: boolean
  provider: 'supabase' | null
}

let syncStatusCallback: ((state: Partial<SyncState>) => void) | null = null

export function setSupabaseSyncStatusCallback(cb: (state: Partial<SyncState>) => void) {
  syncStatusCallback = cb
}

function emitStatus(partial: Partial<SyncState>) {
  syncStatusCallback?.(partial)
}

export async function syncToSupabase(userId: string, data: Record<string, unknown>): Promise<void> {
  const client = getClient()
  if (!client) throw new Error('Supabase 未配置')
  const table = getTableName()

  emitStatus({ status: 'syncing', error: null })

  const { error } = await client.from(table).upsert(
    {
      user_id: userId,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) throw error
  emitStatus({ status: 'synced', lastSyncAt: new Date(), error: null })
}

export async function syncFromSupabase(userId: string): Promise<Record<string, unknown> | null> {
  const client = getClient()
  if (!client) return null
  const table = getTableName()

  const { data, error } = await client.from(table).select('data').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return null
  return (data.data as Record<string, unknown>) || null
}

export function subscribeToSupabase(
  userId: string,
  callback: (data: Record<string, unknown>) => void
): () => void {
  const client = getClient()
  if (!client) return () => {}

  const table = getTableName()
  const channel = client
    .channel(`focusflow-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      (payload) => {
        const next = (payload.new as { data?: Record<string, unknown> } | null)?.data
        if (next) callback(next)
      }
    )
    .subscribe()

  return () => {
    try {
      client.removeChannel(channel)
    } catch {
      /* ignore */
    }
  }
}

export async function mergeLocalAndSupabase(
  userId: string,
  localData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const cloud = await syncFromSupabase(userId)
  if (!cloud) return localData
  // 简单合并：云端为准，但保留本地未上传的新增项
  const merged: Record<string, unknown> = { ...cloud }
  for (const key of Object.keys(localData)) {
    if (!(key in cloud)) merged[key] = localData[key]
  }
  return merged
}

export function setOfflineMode(offline: boolean) {
  // Supabase 默认行为即为网络可达时同步，无需特殊处理
  if (offline) {
    emitStatus({ status: 'idle' })
  }
}

export async function signInWithSupabaseEmail(email: string, password: string): Promise<string | null> {
  const client = getClient()
  if (!client) return null
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  if (!data.user) return null
  currentUserId = data.user.id
  return data.user.id
}

export async function signUpWithSupabaseEmail(email: string, password: string): Promise<string | null> {
  const client = getClient()
  if (!client) return null
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  if (!data.user) return null
  currentUserId = data.user.id
  return data.user.id
}

export async function signOutSupabase(): Promise<void> {
  const client = getClient()
  if (!client) return
  await client.auth.signOut()
  currentUserId = null
}
