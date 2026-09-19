'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * 视图级二级菜单：所有界面统一使用本组件做内容分栏。
 * 规范：h-10 胶囊容器、rounded-xl、图标+文本、移动端横向滚动不换行。
 */
function ViewTabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tabs
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      className={cn('gap-3', className)}
    >
      {children}
    </Tabs>
  )
}

function ViewTabsList({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <TabsList
      className={cn(
        'h-10 w-fit max-w-full gap-1 overflow-x-auto rounded-xl p-1.5',
        className,
      )}
    >
      {children}
    </TabsList>
  )
}

function ViewTabsTrigger({
  value,
  badge,
  title,
  className,
  children,
}: {
  value: string
  badge?: React.ReactNode
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <TabsTrigger
      value={value}
      title={title}
      className={cn('rounded-lg px-3.5 text-sm font-medium', className)}
    >
      {children}
      {badge}
    </TabsTrigger>
  )
}

function ViewTabsContent({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <TabsContent value={value} className={cn('mt-0', className)}>
      {children}
    </TabsContent>
  )
}

export { ViewTabs, ViewTabsList, ViewTabsTrigger, ViewTabsContent }
