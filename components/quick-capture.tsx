'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Zap,
  Plus,
  Calendar,
  Tag,
  Clock,
  Target,
  Sparkles,
  ArrowRight,
  Keyboard,
  Lightbulb,
} from 'lucide-react'
import { parseEnhancedInput, validateParsedInput, getSmartSuggestions } from '@/lib/smart-input-enhanced'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const QUICK_CAPTURE_HOTKEYS = ['ctrl+shift+a', 'meta+shift+a']

export function QuickCapture() {
  const { addTask } = useAppStore()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')

  const parsed = input ? parseEnhancedInput(input) : null
  const validation = parsed ? validateParsedInput(parsed) : { valid: true, warnings: [], suggestions: [] }
  const suggestions = input ? getSmartSuggestions(input) : []

  const openCapture = useCallback(() => {
    setInput('')
    setOpen(true)
  }, [])

  // 暴露给其他组件调用
  useEffect(() => {
    ;(window as any).__openQuickCapture = openCapture
    return () => {
      delete (window as any).__openQuickCapture
    }
  }, [openCapture])

  // 监听全局快捷键 Ctrl+Shift+A
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey
      const isShift = e.shiftKey
      if (isMod && isShift && (e.key === 'A' || e.key === 'a')) {
        // 避免在输入框中触发
        const target = e.target as HTMLElement
        const tag = target.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) {
          return
        }
        e.preventDefault()
        openCapture()
      }
      // ESC 关闭
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, openCapture])

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return
    if (!parsed || !parsed.title) {
      toast.error('请输入任务标题')
      return
    }
    addTask({
      title: parsed.title,
      description: undefined,
      type: 'task',
      priority: parsed.priority || 'medium',
      project: parsed.project || '',
      tags: parsed.tags || [],
      dueDate: parsed.dueDate,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      status: 'todo',
      estimatedPomodoros: parsed.estimatedPomodoros || 1,
      energy: parsed.energy,
    })
    toast.success('任务已添加')
    setInput('')
    setOpen(false)
  }, [input, parsed, addTask])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        <div className="relative overflow-hidden bg-gradient-to-br from-chart-1/8 via-primary/5 to-chart-2/8 px-5 pt-4 pb-3">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-chart-1/15 blur-2xl" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-chart-1 to-primary p-1.5 shadow-md">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  快速捕获
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-md border bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    Ctrl
                  </kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-md border bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    Shift
                  </kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-md border bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    A
                  </kbd>
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  一行自然语言，立即保存为任务
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <Input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="明天下午3点开会 p1 #工作 2🍅"
              className="h-7 border-none bg-transparent px-0 shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/60"
            />
            <Button
              size="sm"
              disabled={!input.trim() || !validation.valid}
              onClick={handleSubmit}
              className="h-7 gap-1 px-3 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              添加
            </Button>
          </div>

          {parsed && parsed.title && (
            <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{parsed.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {parsed.dueDate && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {parsed.dueDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        {parsed.startTime && ` ${parsed.startTime}`}
                      </Badge>
                    )}
                    {parsed.priority && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Target className="h-2.5 w-2.5" />
                        {parsed.priority === 'urgent'
                          ? '紧急'
                          : parsed.priority === 'high'
                          ? '高'
                          : parsed.priority === 'medium'
                          ? '中'
                          : '低'}
                      </Badge>
                    )}
                    {parsed.estimatedPomodoros && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        🍅 {parsed.estimatedPomodoros}
                      </Badge>
                    )}
                    {parsed.project && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        📁 {parsed.project}
                      </Badge>
                    )}
                    {parsed.tags?.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px] gap-1">
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              {validation.warnings.length > 0 && (
                <p className="text-[10px] text-amber-600 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  {validation.warnings[0]}
                </p>
              )}
            </div>
          )}

          {suggestions.length > 0 && !parsed?.title && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.slice(0, 5).map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput((v) => v + ' ' + s)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                >
                  <Lightbulb className="h-3 w-3" />
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {[
              { label: '明天 3点', v: '明天3点' },
              { label: '下周一', v: '下周一' },
              { label: '高优先级', v: 'p1' },
              { label: '2番茄', v: '2🍅' },
              { label: '#工作', v: '#工作' },
              { label: '+项目A', v: '+项目A' },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => setInput((v) => (v ? v + ' ' : '') + q.v)}
                className="rounded-md border border-border/40 bg-background px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:border-border transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t bg-muted/20 px-5 py-2.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Keyboard className="h-3 w-3" />
            <span>Enter 保存 · Esc 关闭</span>
          </div>
          <span>自然语言解析中</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
