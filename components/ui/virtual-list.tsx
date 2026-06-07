'use client'

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  overscan?: number
  onEndReached?: () => void
  endReachedThreshold?: number
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className,
  overscan = 3,
  onEndReached,
  endReachedThreshold = 0.8,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const totalHeight = items.length * itemHeight

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight)
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const end = start + visibleCount + overscan

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length, end),
    }
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan])

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end)
  }, [items, visibleRange])

  const offsetY = visibleRange.start * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    setScrollTop(target.scrollTop)

    if (onEndReached) {
      const { scrollTop, scrollHeight, clientHeight } = target
      if (scrollTop + clientHeight >= scrollHeight * endReachedThreshold) {
        onEndReached()
      }
    }
  }, [onEndReached, endReachedThreshold])

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={visibleRange.start + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, visibleRange.start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface AutoVirtualListProps<T> {
  items: T[]
  estimatedItemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  overscan?: number
  onEndReached?: () => void
  endReachedThreshold?: number
}

export function AutoVirtualList<T>({
  items,
  estimatedItemHeight,
  renderItem,
  className,
  overscan = 3,
  onEndReached,
  endReachedThreshold = 0.8,
}: AutoVirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height)
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const totalHeight = items.length * estimatedItemHeight

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / estimatedItemHeight)
    const visibleCount = Math.ceil(containerHeight / estimatedItemHeight)
    const end = start + visibleCount + overscan

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length, end),
    }
  }, [scrollTop, estimatedItemHeight, containerHeight, items.length, overscan])

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end)
  }, [items, visibleRange])

  const offsetY = visibleRange.start * estimatedItemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    setScrollTop(target.scrollTop)

    if (onEndReached) {
      const { scrollTop, scrollHeight, clientHeight } = target
      if (scrollTop + clientHeight >= scrollHeight * endReachedThreshold) {
        onEndReached()
      }
    }
  }, [onEndReached, endReachedThreshold])

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => (
            <div key={visibleRange.start + index}>
              {renderItem(item, visibleRange.start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface LazyListProps<T> {
  items: T[]
  initialCount?: number
  increment?: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  loadingComponent?: React.ReactNode
}

export function LazyList<T>({
  items,
  initialCount = 20,
  increment = 20,
  renderItem,
  className,
  loadingComponent,
}: LazyListProps<T>) {
  const [visibleCount, setVisibleCount] = useState(initialCount)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const visibleItems = useMemo(() => 
    items.slice(0, visibleCount),
    [items, visibleCount]
  )

  const hasMore = visibleCount < items.length

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(c => Math.min(c + increment, items.length))
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, increment, items.length])

  return (
    <div className={className}>
      {visibleItems.map((item, index) => (
        <div key={index}>{renderItem(item, index)}</div>
      ))}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {loadingComponent || (
            <div className="text-sm text-muted-foreground">加载更多...</div>
          )}
        </div>
      )}
    </div>
  )
}
