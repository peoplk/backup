import { NextResponse } from 'next/server'
import type { LLMConfig } from '@/lib/llm-assistant'

// 简单的进程内限流，防止单个客户端滥用/烧配额
const rateBuckets = new Map<string, number[]>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

function rateLimited(key: string): boolean {
  const now = Date.now()
  const bucket = (rateBuckets.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (bucket.length >= RATE_LIMIT) {
    rateBuckets.set(key, bucket)
    return true
  }
  bucket.push(now)
  rateBuckets.set(key, bucket)
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) rateBuckets.delete(k)
    }
  }
  return false
}

export async function POST(request: Request) {
  let body: { prompt?: string; config?: LLMConfig } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '无效请求体' }, { status: 400 })
  }

  // 本地单机服务：不信任可伪造的 X-Forwarded-For，统一按固定 key 限流
  if (rateLimited('local')) {
    return NextResponse.json({ error: '请求过于频繁，请稍后重试' }, { status: 429 })
  }

  const { prompt, config } = body
  if (!prompt || !config?.apiKey) {
    return NextResponse.json({ error: '缺少 prompt 或 API Key' }, { status: 400 })
  }

  const rawBaseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  let baseUrl: URL
  try {
    baseUrl = new URL(rawBaseUrl)
  } catch {
    return NextResponse.json({ error: 'Base URL 无效' }, { status: 400 })
  }

  // 仅允许 https，且拒绝内网/回环/链接本地目标，防止服务端请求伪造（SSRF）
  if (baseUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Base URL 必须为 https' }, { status: 400 })
  }
  const host = baseUrl.hostname.toLowerCase()
  const isBlockedHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    /\.local$/.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d)\./.test(host) ||
    /^fc[0-9a-f]{2}:|^fd/.test(host)
  if (isBlockedHost) {
    return NextResponse.json({ error: 'Base URL 不允许指向内网地址' }, { status: 400 })
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `你是 FocusFlow 时间管理应用的任务解析助手。
将用户的自然语言请求解析为任务列表，只输出 JSON，格式：
{"tasks":[{"title":"任务标题","dueDate":"YYYY-MM-DD（可选，今天用 today，明天用 tomorrow）","priority":"urgent|high|medium|low（可选）","estimatedPomodoros":1,"notes":"补充说明（可选）"}]}
如果输入不是任务相关（问候、闲聊等），输出 {"tasks":[]}。`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return NextResponse.json(
        { error: `上游 LLM 返回错误 ${res.status}: ${errText.slice(0, 200)}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? '{"tasks":[]}'

    let parsed: { tasks?: unknown[] }
    try {
      const match = content.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : content)
    } catch {
      parsed = { tasks: [] }
    }

    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.slice(0, 10).map((t) => {
          const item = (t ?? {}) as Record<string, unknown>
          const title = String(item.title ?? '').trim()
          if (!title) return null
          const dueDate = typeof item.dueDate === 'string' ? item.dueDate.trim() : undefined
          const toLocalDateStr = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          const resolvedDate =
            dueDate === 'today' || dueDate === '今天'
              ? toLocalDateStr(new Date())
              : dueDate === 'tomorrow' || dueDate === '明天'
              ? toLocalDateStr(new Date(Date.now() + 86400000))
              : dueDate
          return {
            title,
            dueDate: resolvedDate,
            priority:
              typeof item.priority === 'string' &&
              ['urgent', 'high', 'medium', 'low'].includes(item.priority)
                ? item.priority
                : 'medium',
            estimatedPomodoros:
              typeof item.estimatedPomodoros === 'number'
                ? Math.max(1, Math.min(12, Math.round(item.estimatedPomodoros)))
                : undefined,
            notes: typeof item.notes === 'string' && item.notes ? item.notes : undefined,
          }
        })
        .filter((t): t is NonNullable<typeof t> => t !== null)
      : []

    return NextResponse.json({ tasks })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'LLM 请求失败' },
      { status: 500 }
    )
  }
}
