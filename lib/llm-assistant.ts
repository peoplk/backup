import { sealSecret, unsealSecret } from '@/lib/credential-vault'
import { toast } from 'sonner'

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
  enabled: boolean
}

export interface TaskIntentResult {
  title: string
  dueDate?: string
  priority?: 'urgent' | 'high' | 'medium' | 'low'
  estimatedPomodoros?: number
  notes?: string
}

const STORAGE_KEY = 'focusflow-llm-config'
const API_KEY_STORAGE_KEY = 'focusflow-llm-api-key'
const DEFAULT_CONFIG: LLMConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  enabled: false,
}

// 内存中的明文 Key 缓存：首次从存储解密后保留，避免重复解密
let memoryApiKey = ''

function readPersisted(): Partial<LLMConfig> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<LLMConfig>
    const { apiKey, ...rest } = parsed
    return rest
  } catch {
    return {}
  }
}

export function getLLMConfig(): LLMConfig {
  return { ...DEFAULT_CONFIG, ...readPersisted(), apiKey: memoryApiKey }
}

export function setLLMConfig(config: Partial<LLMConfig>): LLMConfig {
  const persisted = readPersisted()
  const nextApiKey = config.apiKey !== undefined ? config.apiKey : memoryApiKey
  memoryApiKey = nextApiKey
  if (typeof window !== 'undefined') {
    const { apiKey: _apiKey, ...rest } = { ...persisted, ...config }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
    // API Key 单独密封存储
    if (config.apiKey) {
      void sealSecret(config.apiKey as string)
        .then((sealed) => {
          localStorage.setItem(API_KEY_STORAGE_KEY, sealed)
        })
        .catch(() => {
          toast.error('密钥加密保存失败')
        })
    } else if (config.apiKey === '') {
      // 用户主动清除 key：移除密封副本，避免重启后密钥"复活"
      localStorage.removeItem(API_KEY_STORAGE_KEY)
    }
  }
  return { ...DEFAULT_CONFIG, ...persisted, ...config, apiKey: nextApiKey }
}

/** 启动时恢复已存的 API Key 到内存明文态。 */
export async function initLLMConfig(): Promise<void> {
  if (typeof window === 'undefined') return
  const sealed = localStorage.getItem(API_KEY_STORAGE_KEY)
  if (sealed) {
    memoryApiKey = await unsealSecret(sealed)
  }
}

const SYSTEM_PROMPT = `你是 FocusFlow 时间管理应用的任务解析助手。
将用户的自然语言请求解析为任务列表，只输出 JSON，格式：
{"tasks":[{"title":"任务标题","dueDate":"YYYY-MM-DD（可选，今天用 today，明天用 tomorrow）","priority":"urgent|high|medium|low（可选）","estimatedPomodoros":1,"notes":"补充说明（可选）"}]}
如果输入不是任务相关（问候、闲聊等），输出 {"tasks":[]}。`

export interface TaskIntentResponse {
  tasks: TaskIntentResult[]
}

export async function parseTaskIntent(prompt: string): Promise<TaskIntentResponse> {
  const config = getLLMConfig()
  if (!config.enabled || !config.apiKey) {
    return { tasks: [] }
  }

  const res = await fetch('/api/llm/task-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, config }),
  })

  if (!res.ok) {
    throw new Error(`LLM 请求失败: ${res.status}`)
  }

  const data = (await res.json()) as TaskIntentResponse
  return data
}