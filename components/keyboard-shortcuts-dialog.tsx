'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { SHORTCUT_LIST } from '@/lib/shortcuts'
import { Keyboard } from 'lucide-react'

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    window.__openKeyboardShortcuts = () => setOpen(true)
    return () => {
      window.__openKeyboardShortcuts = undefined
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      if (e.key === '?') {
        e.preventDefault()
        setOpen(true)
      }
      
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            快捷键帮助
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">
            使用以下快捷键可以快速操作，提高工作效率
          </p>
          <div className="space-y-2">
            {SHORTCUT_LIST.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm">{shortcut.description}</span>
                <div className="flex gap-1">
                  {shortcut.keys.map((key, i) => (
                    <Badge key={i} variant="secondary" className="text-xs font-mono">
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              按 <Badge variant="outline" className="mx-1 text-xs">?</Badge> 随时打开此帮助面板
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
