import type { FocusShieldItem } from '@/lib/types'

export const DEFAULT_BLOCKED_WEBSITES: FocusShieldItem[] = [
  { id: 'shield-weibo', type: 'website', name: '微博', pattern: 'weibo.com', enabled: true },
  { id: 'shield-douyin', type: 'website', name: '抖音', pattern: 'douyin.com', enabled: true },
  { id: 'shield-bilibili', type: 'website', name: 'B站', pattern: 'bilibili.com', enabled: true },
  { id: 'shield-zhihu', type: 'website', name: '知乎', pattern: 'zhihu.com', enabled: false },
  { id: 'shield-xiaohongshu', type: 'website', name: '小红书', pattern: 'xiaohongshu.com', enabled: true },
  { id: 'shield-taobao', type: 'website', name: '淘宝', pattern: 'taobao.com', enabled: true },
  { id: 'shield-jd', type: 'website', name: '京东', pattern: 'jd.com', enabled: false },
  { id: 'shield-tencentvideo', type: 'website', name: '腾讯视频', pattern: 'v.qq.com', enabled: true },
]

export const DEFAULT_BLOCKED_APPS: FocusShieldItem[] = [
  { id: 'shield-wechat', type: 'app', name: '微信', pattern: 'WeChat', enabled: false },
  { id: 'shield-qq', type: 'app', name: 'QQ', pattern: 'QQ', enabled: false },
  { id: 'shield-dingtalk', type: 'app', name: '钉钉', pattern: 'DingTalk', enabled: false },
  { id: 'shield-wxwork', type: 'app', name: '企业微信', pattern: 'WXWork', enabled: false },
]

export const DEFAULT_ALLOWED_WEBSITES: FocusShieldItem[] = [
  { id: 'shield-notion', type: 'website', name: 'Notion', pattern: 'notion.so', enabled: true },
  { id: 'shield-github', type: 'website', name: 'GitHub', pattern: 'github.com', enabled: true },
  { id: 'shield-gdocs', type: 'website', name: 'Google Docs', pattern: 'docs.google.com', enabled: true },
  { id: 'shield-figma', type: 'website', name: 'Figma', pattern: 'figma.com', enabled: true },
  { id: 'shield-feishu-doc', type: 'website', name: '飞书文档', pattern: 'feishu.cn', enabled: true },
  { id: 'shield-yuque', type: 'website', name: '语雀', pattern: 'yuque.com', enabled: true },
]

export const DEFAULT_ALLOWED_APPS: FocusShieldItem[] = [
  { id: 'shield-vscode', type: 'app', name: 'VS Code', pattern: 'Code', enabled: true },
  { id: 'shield-feishu', type: 'app', name: '飞书', pattern: 'Feishu', enabled: true },
  { id: 'shield-wxwork', type: 'app', name: '企业微信', pattern: 'WXWork', enabled: true },
  { id: 'shield-dingtalk', type: 'app', name: '钉钉', pattern: 'DingTalk', enabled: true },
]

export const DEFAULT_BLACKLIST_ITEMS: FocusShieldItem[] = [
  ...DEFAULT_BLOCKED_WEBSITES,
  ...DEFAULT_BLOCKED_APPS,
]

export const DEFAULT_WHITELIST_ITEMS: FocusShieldItem[] = [
  ...DEFAULT_ALLOWED_WEBSITES,
  ...DEFAULT_ALLOWED_APPS,
]

// ─── 盾配置的本地存储约定（UI 与定时调度共用同一数据源） ───

export const SHIELD_STORAGE_KEYS = {
  blacklist: 'focusflow-focus-shield-v2',
  whitelist: 'focusflow-focus-shield-whitelist-v2',
  mode: 'focusflow-shield-mode',
} as const

export type ShieldModeValue = 'blacklist' | 'whitelist'

/** 读取当前生效的盾清单（与专注盾 UI 使用完全相同的键与回退逻辑） */
export function readActiveShieldConfig(): {
  websites: string[]
  apps: string[]
  mode: ShieldModeValue
} {
  if (typeof window === 'undefined') {
    return { websites: [], apps: [], mode: 'blacklist' }
  }
  let mode: ShieldModeValue = 'blacklist'
  try {
    mode = localStorage.getItem(SHIELD_STORAGE_KEYS.mode) === 'whitelist' ? 'whitelist' : 'blacklist'
  } catch {
    mode = 'blacklist'
  }

  const fallback =
    mode === 'blacklist'
      ? [...DEFAULT_BLOCKED_WEBSITES, ...DEFAULT_BLOCKED_APPS]
      : [...DEFAULT_ALLOWED_WEBSITES, ...DEFAULT_ALLOWED_APPS]

  let items: FocusShieldItem[] = fallback
  try {
    const raw = localStorage.getItem(SHIELD_STORAGE_KEYS[mode])
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) items = parsed
    }
  } catch {
    items = fallback
  }

  return {
    websites: items.filter((i) => i?.enabled && i.type === 'website').map((i) => String(i.pattern)),
    apps: items.filter((i) => i?.enabled && i.type === 'app').map((i) => String(i.pattern)),
    mode,
  }
}