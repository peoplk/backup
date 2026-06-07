export function formatDuration(seconds: number, style: 'full' | 'short' | 'compact' = 'short'): string {
  if (seconds < 0) seconds = 0
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  switch (style) {
    case 'full':
      if (hours > 0 && minutes > 0) {
        return `${hours}小时${minutes}分钟`
      } else if (hours > 0) {
        return `${hours}小时`
      } else if (minutes > 0) {
        return `${minutes}分钟`
      } else {
        return '0分钟'
      }
      
    case 'short':
      if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
      }
      return `${minutes}m`
      
    case 'compact':
      if (hours > 0) {
        return minutes > 0 ? `${hours}:${String(minutes).padStart(2, '0')}` : `${hours}:00`
      }
      return `0:${String(minutes).padStart(2, '0')}`
      
    default:
      return formatDuration(seconds, 'short')
  }
}

export function formatDurationShort(seconds: number): string {
  return formatDuration(seconds, 'short')
}

export function formatDurationCompact(seconds: number): string {
  return formatDuration(seconds, 'compact')
}

export function formatTimeRemaining(seconds: number): string {
  if (seconds < 0) seconds = 0
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const targetDate = date instanceof Date ? date : new Date(date)
  const diffMs = now.getTime() - targetDate.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`
  return `${Math.floor(diffDays / 365)}年前`
}

export function formatCount(count: number, singular: string, plural?: string): string {
  if (count === 1 || count === -1) {
    return `${Math.abs(count)}${singular}`
  }
  return `${Math.abs(count)}${plural || (singular + 's')}`
}

// 统一日期工具函数

/** 获取今天的日期字符串（toDateString 格式），用于日期比较 */
export function getTodayString(): string {
  return new Date().toDateString()
}

/** 判断日期是否是今天 */
export function isToday(date: Date | string): boolean {
  const d = date instanceof Date ? date : new Date(date)
  return d.toDateString() === getTodayString()
}

/** 判断日期是否是本周 */
export function isThisWeek(date: Date | string): boolean {
  const d = date instanceof Date ? date : new Date(date)
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)
  return d >= startOfWeek && d < endOfWeek
}

/** 格式化相对日期描述（今天/明天/昨天/后天/前天/N天前） */
export function formatRelativeDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)

  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '明天'
  if (diffDays === -1) return '昨天'
  if (diffDays === 2) return '后天'
  if (diffDays === -2) return '前天'
  if (diffDays > 0 && diffDays <= 7) return `${diffDays}天后`
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)}天前`
  return d.toLocaleDateString('zh-CN')
}

/** 获取本周一的日期 */
export function getWeekStart(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}
