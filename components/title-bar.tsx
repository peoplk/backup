'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { 
  Minus, Square, X, Copy, LayoutGrid, 
  ChevronDown, FileText, Edit, View, AppWindow, HelpCircle,
  Plus, Play, Settings, Home, ListTodo, Target, BarChart3, Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import type { AppState } from '@/lib/store/types'

// 编辑类命令：优先使用标准剪贴板/选择 API，替代已废弃的 execCommand
function execEditCommand(command: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'): void {
  const editable = document.activeElement as HTMLElement | null
  try {
    if (command === 'copy' || command === 'cut') {
      const selection = window.getSelection()
      const selectedText = selection ? selection.toString() : ''
      if (selectedText) {
        navigator.clipboard?.writeText(selectedText).catch(() => {})
        return
      }
      if (editable && /^(INPUT|TEXTAREA)$/.test(editable.tagName)) {
        const input = editable as HTMLInputElement | HTMLTextAreaElement
        const text = input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0)
        navigator.clipboard?.writeText(text).catch(() => {})
        return
      }
      return
    }
    if (command === 'paste') {
      navigator.clipboard?.readText?.().then(
        (text) => {
          const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null
          if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) {
            const start = el.selectionStart ?? el.value.length
            const end = el.selectionEnd ?? el.value.length
            el.value = el.value.slice(0, start) + text + el.value.slice(end)
            el.dispatchEvent(new Event('input', { bubbles: true }))
          }
        },
        () => {}
      )
      return
    }
    if (command === 'selectAll') {
      const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null
      if (el && 'select' in el) el.select()
      else window.getSelection()?.selectAllChildren(document.body)
      return
    }
  } catch {
    // 剪贴板权限受限时静默忽略，不影响主流程
  }
}

interface MenuItem {
  label: string
  icon?: React.ReactNode
  accelerator?: string
  action?: () => void
  separator?: boolean
  items?: MenuItem[]
}

const menuConfig: { label: string; icon?: React.ReactNode; items: MenuItem[] }[] = [
  {
    label: '文件',
    icon: <FileText className="h-3.5 w-3.5" />,
    items: [
      { label: '新建任务', icon: <Plus className="h-3.5 w-3.5" />, accelerator: 'Ctrl+N', action: () => {} },
      { label: '快速添加', icon: <Plus className="h-3.5 w-3.5" />, accelerator: 'Ctrl+Shift+A', action: () => {} },
      { separator: true, label: '' },
      { label: '开始专注', icon: <Play className="h-3.5 w-3.5" />, accelerator: 'Ctrl+Space', action: () => {} },
    ]
  },
  {
    label: '编辑',
    icon: <Edit className="h-3.5 w-3.5" />,
    items: [
      { label: '撤销', accelerator: 'Ctrl+Z', action: () => execEditCommand('undo') },
      { label: '重做', accelerator: 'Ctrl+Y', action: () => execEditCommand('redo') },
      { separator: true, label: '' },
      { label: '剪切', accelerator: 'Ctrl+X', action: () => execEditCommand('cut') },
      { label: '复制', accelerator: 'Ctrl+C', action: () => execEditCommand('copy') },
      { label: '粘贴', accelerator: 'Ctrl+V', action: () => execEditCommand('paste') },
      { separator: true, label: '' },
      { label: '全选', accelerator: 'Ctrl+A', action: () => execEditCommand('selectAll') },
    ]
  },
  {
    label: '视图',
    icon: <View className="h-3.5 w-3.5" />,
    items: [
      { label: '仪表板', icon: <Home className="h-3.5 w-3.5" />, accelerator: 'Ctrl+1', action: () => {} },
      { label: '任务与日程', icon: <ListTodo className="h-3.5 w-3.5" />, accelerator: 'Ctrl+2', action: () => {} },
      { label: '专注模式', icon: <Play className="h-3.5 w-3.5" />, accelerator: 'Ctrl+3', action: () => {} },
      { label: '习惯打卡', icon: <Target className="h-3.5 w-3.5" />, accelerator: 'Ctrl+4', action: () => {} },
      { label: '目标管理', icon: <Target className="h-3.5 w-3.5" />, accelerator: 'Ctrl+5', action: () => {} },
      { label: '数据分析', icon: <BarChart3 className="h-3.5 w-3.5" />, accelerator: 'Ctrl+6', action: () => {} },
      { label: '倒数纪念日', icon: <Calendar className="h-3.5 w-3.5" />, accelerator: 'Ctrl+7', action: () => {} },
      { label: '日历', icon: <Calendar className="h-3.5 w-3.5" />, accelerator: 'Ctrl+9', action: () => {} },
      { label: '时间块', icon: <Calendar className="h-3.5 w-3.5" />, action: () => {} },
      { label: '设置', icon: <Settings className="h-3.5 w-3.5" />, accelerator: 'Ctrl+8', action: () => {} },
    ]
  },
  {
    label: '窗口',
    icon: <AppWindow className="h-3.5 w-3.5" />,
    items: [
      { label: '最小化', accelerator: 'Ctrl+M', action: () => window.electronAPI?.minimizeWindow() },
      { label: '最大化', accelerator: 'Ctrl+Shift+M', action: () => window.electronAPI?.maximizeWindow() },
      { label: '关闭', accelerator: 'Ctrl+W', action: () => window.electronAPI?.closeWindow() },
      { separator: true, label: '' },
      { label: '桌面小组件', icon: <LayoutGrid className="h-3.5 w-3.5" />, accelerator: 'Ctrl+Shift+W', action: () => window.electronAPI?.toggleWidget() },
    ]
  },
  {
    label: '帮助',
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    items: [
      { label: '关于 FocusFlow', action: () => {} },
      { separator: true, label: '' },
      { label: '快捷键', accelerator: 'Ctrl+/', action: () => {} },
    ]
  }
]

function MenuDropdown({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const { setActiveView } = useAppStore()
  
  const handleClick = (item: MenuItem) => {
    if (item.action) {
      const viewMap: Record<string, AppState['activeView']> = {
        '仪表板': 'dashboard',
        '任务与日程': 'tasks',
        '专注模式': 'focus',
        '习惯打卡': 'habits',
        '目标管理': 'goals',
        '数据分析': 'analytics',
        '倒数纪念日': 'anniversaries',
        '日历': 'calendar',
        '时间块': 'time-block',
        '设置': 'settings',
      }

      if (item.label in viewMap) {
        setActiveView(viewMap[item.label])
      } else if (item.label === '新建任务' || item.label === '快速添加') {
        if (typeof window !== 'undefined') {
           window.__openQuickCapture?.()
        }
      } else if (item.label === '开始专注') {
        setActiveView('focus')
      } else if (item.label === '快捷键') {
        if (typeof window !== 'undefined') {
           window.__openKeyboardShortcuts?.()
        }
      } else if (item.label === '关于 FocusFlow') {
        setActiveView('settings')
      } else {
        item.action()
      }
    }
    onClose()
  }

  return (
    <div className="absolute left-0 top-full mt-1.5 min-w-[220px] rounded-xl border border-black/[0.06] dark:border-white/10 bg-white/95 dark:bg-[#161a23]/95 backdrop-blur-2xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.35)] dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.7)] ring-1 ring-black/[0.02] dark:ring-white/[0.04] z-50 py-1.5 animate-fade-in-up origin-top">
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={index} className="h-px bg-zinc-200/80 dark:bg-white/[0.06] my-1 mx-2.5" />
        }
        return (
          <button
            key={index}
            onClick={() => handleClick(item)}
            className="w-full flex items-center justify-between gap-4 px-2.5 py-[7px] text-[13px] group transition-colors rounded-md mx-1 hover:bg-indigo-500/[0.08] dark:hover:bg-indigo-400/[0.12]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {item.icon && (
                <span className="text-muted-foreground/70 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors shrink-0">
                  {item.icon}
                </span>
              )}
              <span className="truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors">
                {item.label}
              </span>
            </div>
            {item.accelerator && (
              <span className="shrink-0 text-[10px] leading-none font-medium text-muted-foreground/50 px-1.5 py-1 rounded border border-zinc-200/70 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.04] group-hover:border-indigo-500/20 dark:group-hover:border-indigo-300/20">
                {item.accelerator}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isFullscreen = useAppStore((state) => state.isFullscreen)
  const pathname = usePathname()

  useEffect(() => {
    setIsElectron(!!window.electronAPI)
    if (window.electronAPI) {
      window.electronAPI.isMaximized().then(setIsMaximized).catch(() => setIsMaximized(false))
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isWidget = pathname.startsWith('/widget')

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow()
  }

  const handleMaximize = async () => {
    window.electronAPI?.maximizeWindow()
    setTimeout(async () => {
      try {
        const maximized = await window.electronAPI?.isMaximized()
        setIsMaximized(!!maximized)
      } catch {
        // 忽略 IPC 异常
      }
    }, 100)
  }

  const handleClose = () => {
    window.electronAPI?.closeWindow()
  }

  const handleToggleWidget = () => {
    window.electronAPI?.toggleWidget()
  }

  if (!isElectron || isFullscreen || isWidget) return null

  return (
    <div 
      className="h-10 flex items-center justify-between relative select-none win11-titlebar"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center h-full" ref={menuRef}>
        <div className="flex items-center gap-2 px-3">
          <div className="w-4 h-4 rounded-sm bg-gradient-to-br from-chart-1 to-chart-2 flex items-center justify-center">
            <span className="text-white text-[8px] font-bold">F</span>
          </div>
          <span className="text-xs font-medium opacity-80">FocusFlow</span>
        </div>

        <div 
          className="flex items-center h-full ml-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {menuConfig.map((menu) => (
            <div key={menu.label} className="relative flex items-center h-full">
              <button
                onClick={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}
                onMouseEnter={() => activeMenu && setActiveMenu(menu.label)}
                className={cn(
                  'relative h-8 px-3 flex items-center gap-1 text-xs font-medium transition-all rounded-md',
                  activeMenu === menu.label
                    ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-500/[0.08] dark:bg-indigo-400/[0.12]'
                    : 'hover:bg-black/5 dark:hover:bg-white/[0.07]'
                )}
              >
                {menu.label}
                <ChevronDown className={cn(
                  'h-3 w-3 transition-transform duration-200',
                  activeMenu === menu.label ? 'rotate-180 opacity-80' : 'opacity-50'
                )} />
              </button>
              {activeMenu === menu.label && (
                <span className="absolute bottom-0 left-2.5 right-2.5 h-[2px] rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
              )}
              {activeMenu === menu.label && (
                <MenuDropdown items={menu.items} onClose={() => setActiveMenu(null)} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div 
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleToggleWidget}
          className="h-8 px-3 mr-1 flex items-center gap-1.5 text-xs font-medium hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors rounded-md"
          title="桌面小组件"
          aria-label="桌面小组件"
        >
          <LayoutGrid className="h-3.5 w-3.5 opacity-70" />
          <span className="opacity-80">小组件</span>
        </button>
        
        <div className="flex items-center h-full">
          <button
            onClick={handleMinimize}
            className="h-full w-12 flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-muted-foreground/70 hover:text-foreground transition-colors"
            title="最小化"
            aria-label="最小化"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          
          <button
            onClick={handleMaximize}
            className="h-full w-12 flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-muted-foreground/70 hover:text-foreground transition-colors"
            title={isMaximized ? '还原' : '最大化'}
            aria-label={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? (
              <Copy className="h-3 w-3" />
            ) : (
              <Square className="h-3 w-3" />
            )}
          </button>
          
          <button
            onClick={handleClose}
            className="h-8 w-12 mr-1.5 flex items-center justify-center text-muted-foreground/70 hover:text-white hover:bg-red-500/90 transition-colors rounded-md"
            title="关闭"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
