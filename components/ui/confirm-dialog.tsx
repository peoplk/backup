'use client'

import { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'success' | 'warning'
  icon?: ReactNode
  onConfirm: () => void
  onCancel?: () => void
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = '确认操作',
  description = '确定要执行此操作吗？',
  confirmText = '确定',
  cancelText = '取消',
  variant = 'default',
  icon,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    if (!isLoading) {
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  const variantStyles = {
    default: {
      button: 'bg-primary hover:bg-primary/90 text-white shadow-lg',
      icon: 'text-chart-1 bg-chart-1/10 border-chart-1/20',
    },
    destructive: {
      button: 'bg-destructive hover:bg-destructive/90 text-white shadow-lg',
      icon: 'text-destructive bg-destructive/10 border-destructive/20',
    },
    success: {
      button: 'bg-success hover:bg-success/90 text-white shadow-lg',
      icon: 'text-success bg-success/10 border-success/20',
    },
    warning: {
      button: 'bg-warning hover:bg-warning/90 text-white shadow-lg',
      icon: 'text-warning bg-warning/10 border-warning/20',
    },
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            {icon && (
              <div className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl border shrink-0",
                variantStyles[variant].icon
              )}>
                {icon}
              </div>
            )}
            <div className="flex-1 pt-1">
              <DialogTitle className="text-lg font-semibold mb-2">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </DialogDescription>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 px-6 py-4 bg-muted/30 border-t">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="min-w-[80px]"
          >
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn("min-w-[100px]", variantStyles[variant].button)}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                处理中...
              </span>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook for using confirm dialog with state management
import { useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

export interface ConfirmOptions {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'success' | 'warning'
  icon?: ReactNode
}

export function useConfirm() {
  const [dialogState, setDialogState] = useState<{
    open: boolean
    options: ConfirmOptions
    resolver: ((value: boolean) => void) | null
  }>({
    open: false,
    options: {},
    resolver: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState((prev) => ({
        ...prev,
        open: true,
        options,
        resolver: resolve,
      }))
    })
  }, [])

  const handleOpenChange = useCallback((open: boolean) => {
    setDialogState(prev => ({
      ...prev,
      open,
    }))
    
    if (!open && dialogState.resolver) {
      dialogState.resolver(false)
    }
  }, [dialogState.resolver])

  const handleConfirm = useCallback(() => {
    if (dialogState.resolver) {
      dialogState.resolver(true)
    }
    setDialogState({
      open: false,
      options: {},
      resolver: null,
    })
  }, [dialogState.resolver])

  const handleCancel = useCallback(() => {
    if (dialogState.resolver) {
      dialogState.resolver(false)
    }
    setDialogState({
      open: false,
      options: {},
      resolver: null,
    })
  }, [dialogState.resolver])

  // Auto-select icon based on variant if not provided
  let icon = dialogState.options.icon
  if (!icon && !dialogState.options.icon) {
    switch (dialogState.options.variant) {
      case 'success':
        icon = <CheckCircle2 className="w-6 h-6" />
        break
      case 'destructive':
        icon = <XCircle className="w-6 h-6" />
        break
      case 'warning':
        icon = <AlertTriangle className="w-6 h-6" />
        break
      default:
        icon = <Info className="w-6 h-6" />
    }
  }

  const DialogComponent = (
    <ConfirmDialog
      open={dialogState.open}
      onOpenChange={handleOpenChange}
      title={dialogState.options.title}
      description={dialogState.options.description}
      confirmText={dialogState.options.confirmText}
      cancelText={dialogState.options.cancelText}
      variant={dialogState.options.variant || 'success'}
      icon={icon}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return {
    confirm,
    DialogComponent,
  }
}
