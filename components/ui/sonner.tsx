'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        duration: 2500,
        classNames: {
          toast:
            'border border-border/60 bg-popover text-popover-foreground shadow-lg rounded-xl',
          description: 'text-[13px] text-muted-foreground',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'calc(var(--radius) - 4px)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
