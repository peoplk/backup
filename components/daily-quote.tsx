'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  RefreshCw,
  Lightbulb,
  Sunrise,
  Sunset,
  Moon,
  Sun,
  Target,
  Brain,
  Coffee,
  Zap,
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const QUOTES = [
  { text: '专注是效率的灵魂。一次只做一件事，做到最好。', author: '佚名', icon: Target, color: 'text-blue-500' },
  { text: '不要等待完美的时刻，抓住当下，让它变得完美。', author: '佚名', icon: Zap, color: 'text-amber-500' },
  { text: '成功的秘诀在于每天都比昨天更努力一点。', author: '佚名', icon: Sparkles, color: 'text-purple-500' },
  { text: '时间是最公平的，每人每天都是24小时，差别在于如何利用。', author: '佚名', icon: Brain, color: 'text-emerald-500' },
  { text: '伟大的成就源于每日微小努力的积累。', author: '罗宾·夏玛', icon: Heart, color: 'text-rose-500' },
  { text: '有计划地工作，而不是让工作支配你。', author: '佚名', icon: Lightbulb, color: 'text-cyan-500' },
  { text: '待办清单不是越长越好，做好最重要的三件事就够了。', author: '艾维·李', icon: Target, color: 'text-indigo-500' },
  { text: '休息不是浪费时间，而是为了更高效地工作。', author: '佚名', icon: Coffee, color: 'text-orange-500' },
  { text: '深度工作一小时代替分散注意力的四小时。', author: '卡尔·纽波特', icon: Brain, color: 'text-teal-500' },
  { text: '把大目标分解成小步骤，每完成一步都是进步。', author: '佚名', icon: Zap, color: 'text-lime-500' },
  { text: '自律是连接目标和成就之间的桥梁。', author: '佚名', icon: Target, color: 'text-sky-500' },
  { text: '你的注意力流向哪里，你的人生就走向哪里。', author: '佚名', icon: Lightbulb, color: 'text-violet-500' },
  { text: '行动是治愈恐惧的良药，而犹豫拖延将不断滋养恐惧。', author: '戴尔·卡耐基', icon: Zap, color: 'text-red-500' },
  { text: '知而不行，是为不知。行动是最好的学习方式。', author: '王阳明', icon: Lightbulb, color: 'text-blue-600' },
  { text: '不积跬步，无以至千里；不积小流，无以成江海。', author: '荀子', icon: Heart, color: 'text-emerald-600' },
  { text: '今日事今日毕，勿将今事待明日。', author: '文嘉', icon: Target, color: 'text-orange-600' },
  { text: '专注当下，就是最好的时间管理。', author: '佚名', icon: Brain, color: 'text-fuchsia-500' },
  { text: '每天进步1%，一年后就是37倍。', author: '詹姆斯·克利尔', icon: Sparkles, color: 'text-amber-600' },
  { text: '比忙碌更重要的是做对的事。', author: '彼得·德鲁克', icon: Lightbulb, color: 'text-cyan-600' },
  { text: '一个专注的早晨，决定一整天的高效。', author: '佚名', icon: Sunrise, color: 'text-yellow-500' },
]

const FOCUS_TIPS = [
  '尝试将手机放在另一个房间，减少分心。',
  '每完成一个番茄钟，站起来活动两分钟。',
  '早上是大多数人最高效的时段，优先处理重要任务。',
  '使用「两分钟法则」：如果一件事两分钟内能完成，立即去做。',
  '写下你的每日目标，完成率提升42%。',
  '先做最难的事，剩下的任务会变得轻松。',
  '定期整理工作区，整洁的环境带来清晰的思路。',
  '关闭不必要的通知，保护你的专注时间。',
  '把相似的任务批量处理，减少切换成本。',
  '每晚花五分钟规划明天的任务，效率翻倍。',
]

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getTimeGreeting(): { greeting: string; icon: typeof Sun; color: string } {
  const hour = new Date().getHours()
  if (hour < 6) return { greeting: '夜深了，注意休息 🌙', icon: Moon, color: 'text-indigo-500' }
  if (hour < 9) return { greeting: '早上好！开启高效一天 ☀️', icon: Sunrise, color: 'text-amber-500' }
  if (hour < 12) return { greeting: '上午好！黄金专注时段 ⚡', icon: Sun, color: 'text-orange-500' }
  if (hour < 14) return { greeting: '中午好！适当休息充电 🔋', icon: Coffee, color: 'text-amber-600' }
  if (hour < 17) return { greeting: '下午好！冲刺完成目标 🎯', icon: Target, color: 'text-blue-500' }
  if (hour < 21) return { greeting: '晚上好！复盘今天的收获 📝', icon: Sunset, color: 'text-purple-500' }
  return { greeting: '夜深了，回顾与规划 🌙', icon: Moon, color: 'text-indigo-500' }
}

export function DailyQuote() {
  const [quote, setQuote] = useState(QUOTES[0])
  const [tip, setTip] = useState(FOCUS_TIPS[0])
  const [greeting] = useState(getTimeGreeting())

  useEffect(() => {
    setQuote(getRandomItem(QUOTES))
    setTip(getRandomItem(FOCUS_TIPS))
  }, [])

  const refreshQuote = () => {
    let newQuote: typeof QUOTES[0]
    do {
      newQuote = getRandomItem(QUOTES)
    } while (newQuote.text === quote.text && QUOTES.length > 1)
    setQuote(newQuote)
    setTip(getRandomItem(FOCUS_TIPS))
  }

  const QuoteIcon = quote.icon
  const GreetingIcon = greeting.icon

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent shadow-lg group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
      <CardContent className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-primary/10 p-2">
              <GreetingIcon className={cn('h-5 w-5', greeting.color)} />
            </div>
            <span className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              {greeting.greeting}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 transition-all duration-300 hover:rotate-180"
            onClick={refreshQuote}
            title="换一句"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        <div className="flex items-start gap-3 mb-4">
          <div className="mt-1 shrink-0 rounded-lg bg-primary/10 p-2">
            <QuoteIcon className={cn('h-5 w-5', quote.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-medium leading-relaxed text-foreground/90">
              「{quote.text}」
            </p>
            <p className="text-sm text-muted-foreground mt-1.5 font-medium">
              —— {quote.author}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-muted/30 p-3 border border-border/30">
          <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            💡 <span className="font-medium text-amber-600 dark:text-amber-400">小贴士：</span>{tip}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
