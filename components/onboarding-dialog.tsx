'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  ListTodo,
  Timer,
  Database,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Cloud,
  ShieldCheck,
  CalendarClock,
  Tags,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModKeyLabels } from '@/lib/platform'
import { setOnboardingComplete } from '@/lib/onboarding'

interface OnboardingStep {
  icon: React.ElementType
  iconClass: string
  title: string
  description: string
  tips: Array<{ icon: React.ElementType; text: string }>
}

export function OnboardingDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const modKeys = useModKeyLabels()
  const [step, setStep] = useState(0)

  const steps: OnboardingStep[] = [
    {
      icon: Sparkles,
      iconClass: 'from-chart-1 to-chart-3',
      title: '欢迎使用 FocusFlow',
      description: '一款属于你的桌面工作台：任务、番茄专注、习惯与目标，所有数据本地保存，随时可备份带走。',
      tips: [],
    },
    {
      icon: ListTodo,
      iconClass: 'from-emerald-500 to-teal-500',
      title: '一行文字，直接成任务',
      description: '不用逐项填表，像发消息一样写下待办，日期、优先级、标签会被自动识别。',
      tips: [
        { icon: Keyboard, text: `随时按 ${modKeys.mod}+${modKeys.shift}+A 呼出快速捕获` },
        { icon: CalendarClock, text: '例如「明天下午3点写周报 #工作 !高」' },
        { icon: Tags, text: '支持 #标签、@项目、!优先级、~能量' },
      ],
    },
    {
      icon: Timer,
      iconClass: 'from-blue-500 to-cyan-500',
      title: '进入心流状态',
      description: '番茄钟帮你切块时间，氛围音帮你屏蔽噪声。开始专注后，剩下的交给节奏。',
      tips: [
        { icon: Timer, text: '番茄钟支持自动休息与任务绑定' },
        { icon: Sparkles, text: '雨声、咖啡馆、森林等多轨氛围音可自由混音' },
        { icon: ShieldCheck, text: '严格模式下可屏蔽分心网站与应用' },
      ],
    },
    {
      icon: Database,
      iconClass: 'from-violet-500 to-purple-500',
      title: '数据完全属于你',
      description: '一切记录保存在本地并自动轮换备份；需要多端同步时，可配置自己的 S3 云存储。',
      tips: [
        { icon: Database, text: '本地自动备份，最近 10 份可随时恢复' },
        { icon: Cloud, text: '设置 → 云同步，接入 S3 跨设备同步' },
      ],
    },
  ]

  const current = steps[step]
  const Icon = current.icon
  const isLast = step === steps.length - 1

  const finish = () => {
    setOnboardingComplete()
    onOpenChange(false)
  }

  const next = () => {
    if (isLast) {
      finish()
    } else {
      setStep(step + 1)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // 任意方式关闭都视为完成引导，之后仅在设置中手动打开
        if (!next) setOnboardingComplete()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>新手引导</DialogTitle>
        </DialogHeader>

        <div className="px-8 pt-10 pb-6 flex flex-col items-center text-center">
          <div className={cn('rounded-3xl bg-gradient-to-br p-4 shadow-lg mb-5', current.iconClass)}>
            <Icon className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">{current.title}</h2>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{current.description}</p>

          {current.tips.length > 0 && (
            <div className="mt-5 w-full space-y-2 text-left">
              {current.tips.map((tip, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2">
                  <tip.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="text-xs text-muted-foreground">{tip.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={finish}>
            跳过
          </Button>
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/25'
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {step > 0 && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStep(step - 1)} aria-label="上一步">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" onClick={next} className="gap-1">
              {isLast ? '开始使用' : '下一步'}
              {isLast ? <ArrowRight className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
