'use client'

import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HABIT_TEMPLATES, type HabitTemplate } from '@/lib/habit-templates'

const TEMPLATE_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'health', name: '健康' },
  { id: 'learning', name: '学习' },
  { id: 'work', name: '工作' },
  { id: 'life', name: '生活' },
  { id: 'fitness', name: '运动' },
  { id: 'mindfulness', name: '冥想' },
] as const

interface HabitTemplatePickerProps {
  onSelect: (template: HabitTemplate) => void
}

/** 添加习惯对话框顶部的模板快选区：点击即预填表单（对标小日常/滴答清单习惯库） */
export function HabitTemplatePicker({ onSelect }: HabitTemplatePickerProps) {
  const [cat, setCat] = useState<string>('all')
  const list = useMemo(
    () => (cat === 'all' ? HABIT_TEMPLATES : HABIT_TEMPLATES.filter(t => t.category === cat)),
    [cat]
  )

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary" />
        从模板开始（点击预填表单）
      </p>
      <div className="flex flex-wrap gap-1">
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={cn(
              'rounded-full px-2 py-0.5 text-2xs transition-all',
              cat === c.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
        {list.map((t) => (
          <button
            key={t.id}
            title={t.description}
            onClick={() => onSelect(t)}
            className="flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            <span>{t.icon}</span>
            <span className="whitespace-nowrap">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
