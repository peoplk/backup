import type { ActivityCategory } from '@/lib/types'

/**
 * 前台应用分类器：依据进程名与窗口标题把活动归入 工作 / 分心 / 中性。
 * 规则保持轻量（纯正则），分类结果仅用于本地统计展示。
 */

// 已知分心类桌面应用（进程名小写匹配）
const DISTRACTION_APPS = [
  'wechat', 'weixin', 'qq', 'lark', 'feishu', 'dingtalk', 'wxwork',
  'douyin', 'tiktok', 'bilibili', 'iqiyi', 'youku', 'steam', 'epicgameslauncher',
  'cloudmusic', 'qqmusic', 'kugou', 'kuwo',
]

// 已知工作类应用
const WORK_APPS = [
  'code', 'vscode', 'idea64', 'pycharm64', 'webstorm64', 'goland64', 'clion64',
  'devenv', 'cursor', 'sublime_text', 'notepad\\+\\+', 'obsidian', 'typora',
  'windowsterminal', 'cmd', 'powershell', 'pwsh', 'wt',
  'winword', 'excel', 'powerpnt', 'onenote', 'outlook', 'wps', 'et', 'wpp',
  'notion', 'gitkraken', 'fork', 'postman', 'docker', 'python', 'node', 'java',
  'xmind', 'draw.io',
]

// 浏览器进程：需结合窗口标题关键词细分
const BROWSERS = /^(chrome|msedge|firefox|brave|opera|vivaldi|360se|360chrome|qqbrowser|sogouExplorer)/

// 标题中的分心站点关键词（覆盖主流中文/国际站点）
const DISTRACTION_TITLE_KEYWORDS = [
  '哔哩哔哩', 'bilibili', '抖音', 'douyin', 'tiktok', '微博', 'weibo',
  '知乎', 'zhihu', '小红书', 'xiaohongshu', '淘宝', 'taobao', '京东', 'jd.com',
  '拼多多', 'yangkeduo', '爱奇艺', 'iqiyi', '优酷', 'youku', '腾讯视频', 'v.qq',
  'youtube', 'netflix', 'facebook', 'instagram', 'twitter', 'reddit',
  '网易音乐', 'QQ音乐', 'steam', 'epic games', '游戏', '斗地主', '麻将',
]

const WORK_TITLE_KEYWORDS = [
  'github', 'gitlab', 'stack overflow', 'stackoverflow', 'docs', 'documentation',
  'visual studio', 'vs code', 'jetbrains', 'figma', 'jira', 'confluence',
  'notion.so', '语雀', 'yuque', '飞书文档', 'google docs',
]

function matchesAny(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase()
  return patterns.some((p) => lower.includes(p))
}

export function categorizeApp(appName: string, title?: string): ActivityCategory {
  const app = (appName || '').toLowerCase()
  const t = title || ''

  if (matchesAny(app, DISTRACTION_APPS)) return 'distraction'
  if (matchesAny(app, WORK_APPS)) return 'work'

  if (BROWSERS.test(app)) {
    if (matchesAny(t, DISTRACTION_TITLE_KEYWORDS)) return 'distraction'
    if (matchesAny(t, WORK_TITLE_KEYWORDS)) return 'work'
    return 'neutral'
  }

  // 资源管理器等系统应用视为中性
  if (/^(explorer|searchhost|shellexperiencehost|textinputhost)$/.test(app)) return 'neutral'

  return 'neutral'
}
