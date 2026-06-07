'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Minus, Square, X, Copy, LayoutGrid, 
  ChevronDown, FileText, Edit, View, AppWindow, HelpCircle,
  Plus, Play, Settings, Home, ListTodo, Target, BarChart3, Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

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
      { label: '撤销', accelerator: 'Ctrl+Z', action: () => document.execCommand('undo') },
      { label: '重做', accelerator: 'Ctrl+Y', action: () => document.execCommand('redo') },
      { separator: true, label: '' },
      { label: '剪切', accelerator: 'Ctrl+X', action: () => document.execCommand('cut') },
      { label: '复制', accelerator: 'Ctrl+C', action: () => document.execCommand('copy') },
      { label: '粘贴', accelerator: 'Ctrl+V', action: () => document.execCommand('paste') },
      { separator: true, label: '' },
      { label: '全选', accelerator: 'Ctrl+A', action: () => document.execCommand('selectAll') },
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
      if (item.label === '仪表板') setActiveView('dashboard')
      else if (item.label === '任务与日程') setActiveView('tasks')
      else if (item.label === '专注模式') setActiveView('focus')
      else if (item.label === '习惯打卡') setActiveView('habits')
      else if (item.label === '目标管理') setActiveView('goals')
      else if (item.label === '数据分析') setActiveView('analytics')
      else if (item.label === '倒数纪念日') setActiveView('anniversaries')
      else if (item.label === '设置') setActiveView('settings')
      else if (item.label === '新建任务' || item.label === '快速添加') setActiveView('tasks')
      else if (item.label === '开始专注') setActiveView('focus')
      else item.action()
    }
    onClose()
  }

  return (
    <div className="absolute left-0 top-full mt-1 min-w-[220px] rounded-md border border-white/10 bg-white/80 dark:bg-black/80 backdrop-blur-xl shadow-2xl z-50 py-1 animate-fade-in-up">
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={index} className="h-px bg-black/5 dark:bg-white/5 my-1 mx-2" />
        }
        return (
          <button
            key={index}
            onClick={() => handleClick(item)}
            className="w-full flex items-center justify-between gap-4 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-sm mx-1"
          >
            <div className="flex items-center gap-2.5">
              {item.icon && <span className="text-muted-foreground opacity-70">{item.icon}</span>}
              <span>{item.label}</span>
            </div>
            {item.accelerator && (
              <span className="text-xs text-muted-foreground opacity-60">{item.accelerator}</span>
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

  useEffect(() => {
    setIsElectron(!!window.electronAPI)
    if (window.electronAPI) {
      window.electronAPI.isMaximized().then(setIsMaximized)
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

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow()
  }

  const handleMaximize = async () => {
    window.electronAPI?.maximizeWindow()
    setTimeout(async () => {
      const maximized = await window.electronAPI?.isMaximized()
      setIsMaximized(!!maximized)
    }, 100)
  }

  const handleClose = () => {
    window.electronAPI?.closeWindow()
  }

  const handleToggleWidget = () => {
    window.electronAPI?.toggleWidget()
  }

  if (!isElectron || isFullscreen) return null

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
            <div key={menu.label} className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}
                onMouseEnter={() => activeMenu && setActiveMenu(menu.label)}
                className={cn(
                  'h-8 px-3 flex items-center gap-1 text-xs font-medium transition-all rounded-sm',
                  activeMenu === menu.label 
                    ? 'bg-black/5 dark:bg-white/10' 
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                {menu.label}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
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
          className="h-8 px-3 flex items-center gap-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-sm"
          title="桌面小组件"
        >
          <LayoutGrid className="h-3.5 w-3.5 opacity-70" />
          <span className="opacity-80">小组件</span>
        </button>
        
        <div className="flex items-center h-full ml-1">
          <button
            onClick={handleMinimize}
            className="h-full w-12 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="最小化"
          >
            <Minus className="h-3.5 w-3.5 opacity-70" />
          </button>
          
          <button
            onClick={handleMaximize}
            className="h-full w-12 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? (
              <Copy className="h-3 w-3 opacity-70" />
            ) : (
              <Square className="h-3 w-3 opacity-70" />
            )}
          </button>
          
          <button
            onClick={handleClose}
            className="h-full w-12 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
            title="关闭"
          >
            <X className="h-4 w-4 opacity-70" />
          </button>
        </div>
      </div>
    </div>
  )
}
