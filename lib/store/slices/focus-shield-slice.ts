import type { FocusShieldConfig, FocusShieldItem, FocusShieldMode } from '@/lib/types'
import type { AppState, AppStoreApi } from '../types'
import { generateId } from '../utils'

type SetState = (
  fn: ((state: AppState) => Partial<AppState>) | Partial<AppState>
) => void

const DEFAULT_BLACKLIST_ITEMS: FocusShieldItem[] = [
  { id: 'shield-weibo', type: 'website', name: '微博', pattern: 'weibo.com', enabled: true },
  { id: 'shield-douyin', type: 'website', name: '抖音', pattern: 'douyin.com', enabled: true },
  { id: 'shield-bilibili', type: 'website', name: 'B站', pattern: 'bilibili.com', enabled: true },
  { id: 'shield-xiaohongshu', type: 'website', name: '小红书', pattern: 'xiaohongshu.com', enabled: true },
  { id: 'shield-taobao', type: 'website', name: '淘宝', pattern: 'taobao.com', enabled: true },
  { id: 'shield-tencentvideo', type: 'website', name: '腾讯视频', pattern: 'v.qq.com', enabled: true },
  { id: 'shield-wechat', type: 'app', name: '微信', pattern: 'WeChat', enabled: false },
  { id: 'shield-qq', type: 'app', name: 'QQ', pattern: 'QQ', enabled: false },
]

const DEFAULT_WHITELIST_ITEMS: FocusShieldItem[] = [
  { id: 'shield-notion', type: 'website', name: 'Notion', pattern: 'notion.so', enabled: true },
  { id: 'shield-github', type: 'website', name: 'GitHub', pattern: 'github.com', enabled: true },
  { id: 'shield-feishu', type: 'website', name: '飞书文档', pattern: 'feishu.cn', enabled: true },
  { id: 'shield-vscode', type: 'app', name: 'VS Code', pattern: 'Code', enabled: true },
]

export const createFocusShieldSlice = (
  set: SetState,
  get: () => AppState,
  store: AppStoreApi
) => ({
  focusShield: {
    mode: 'blacklist' as FocusShieldMode,
    items: DEFAULT_BLACKLIST_ITEMS,
  } as FocusShieldConfig,

  updateFocusShield: (updates: Partial<FocusShieldConfig>) =>
    set((state) => ({
      focusShield: { ...state.focusShield, ...updates },
    })),

  addFocusShieldItem: (item: Omit<FocusShieldItem, 'id'>) =>
    set((state) => ({
      focusShield: {
        ...state.focusShield,
        items: [
          ...state.focusShield.items,
          { ...item, id: generateId() },
        ],
      },
    })),

  deleteFocusShieldItem: (id: string) =>
    set((state) => ({
      focusShield: {
        ...state.focusShield,
        items: state.focusShield.items.filter((i) => i.id !== id),
      },
    })),

  toggleFocusShieldItem: (id: string) =>
    set((state) => ({
      focusShield: {
        ...state.focusShield,
        items: state.focusShield.items.map((i) =>
          i.id === id ? { ...i, enabled: !i.enabled } : i
        ),
      },
    })),

  setFocusShieldMode: (mode: FocusShieldMode) =>
    set((state) => ({
      focusShield: {
        ...state.focusShield,
        mode,
        items:
          mode === state.focusShield.mode
            ? state.focusShield.items
            : mode === 'blacklist'
            ? DEFAULT_BLACKLIST_ITEMS
            : DEFAULT_WHITELIST_ITEMS,
      },
    })),
})
