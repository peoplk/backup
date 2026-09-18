'use client'

import { useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { FileText, Download, Loader2 } from 'lucide-react'
import { exportHTMLToPDF, formatHM, formatNumber, escapeHTML } from '@/lib/pdf-export'
import { toast } from 'sonner'

type ReportType = 'weekly' | 'monthly' | 'custom'

function getDateRange(type: ReportType): { start: Date; end: Date; label: string } {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  if (type === 'weekly') {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    return { start, end, label: '周报' }
  }
  if (type === 'monthly') {
    const start = new Date(now)
    start.setDate(now.getDate() - 29)
    start.setHours(0, 0, 0, 0)
    return { start, end, label: '月报' }
  }
  // 90 天
  const start = new Date(now)
  start.setDate(now.getDate() - 89)
  start.setHours(0, 0, 0, 0)
  return { start, end, label: '90 天报告' }
}

export function ReportExportDialog() {
  const { tasks, pomodoroSessions, focusGoals, achievements } = useAppStore(
    useShallow((s) => ({
      tasks: s.tasks,
      pomodoroSessions: s.pomodoroSessions,
      focusGoals: s.focusGoals,
      achievements: s.achievements,
    }))
  )
  const [type, setType] = useState<ReportType>('weekly')
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { start, end, label } = useMemo(() => getDateRange(type), [type])

  // 计算报表数据
  const report = useMemo(() => {
    const sessions = pomodoroSessions.filter((s) => {
      const t = new Date(s.completedAt).getTime()
      return t >= start.getTime() && t <= end.getTime() && s.type === 'work'
    })
    const totalMinutes = Math.round(sessions.reduce((acc, s) => acc + s.duration / 60, 0))
    const totalSessions = sessions.length
    // 日均按报表区间的真实天数均分（周报 7 / 月报 30 / 90 天报告 90），不再恒除 7
    const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))
    const avgPerDay = totalSessions / dayCount
    const completedTasks = tasks.filter(
      (t) => t.status === 'done' && t.completedAt && new Date(t.completedAt) >= start && new Date(t.completedAt) <= end
    )
    const totalCompletedTasks = completedTasks.length

    // 按日聚合
    const byDate = new Map<string, { count: number; minutes: number; tasks: Set<string> }>()
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toDateString()
      byDate.set(key, { count: 0, minutes: 0, tasks: new Set() })
    }
    sessions.forEach((s) => {
      const key = new Date(s.completedAt).toDateString()
      const entry = byDate.get(key)
      if (entry) {
        entry.count += 1
        entry.minutes += Math.round(s.duration / 60)
      }
    })
    completedTasks.forEach((t) => {
      if (!t.completedAt) return
      const key = new Date(t.completedAt).toDateString()
      const entry = byDate.get(key)
      if (entry) entry.tasks.add(t.id)
    })

    // 找出高效日 / 低效日
    let peakDay = { date: '', count: 0 }
    let lowDay = { date: '', count: Infinity }
    byDate.forEach((v, k) => {
      if (v.count > peakDay.count) peakDay = { date: k, count: v.count }
      if (v.count < lowDay.count) lowDay = { date: k, count: v.count }
    })

    // 项目聚合
    const byProject = new Map<string, { count: number; minutes: number }>()
    sessions.forEach((s) => {
      const project = s.taskId
        ? tasks.find((t) => t.id === s.taskId)?.project
        : '无项目'
      const key = project || '无项目'
      const entry = byProject.get(key) || { count: 0, minutes: 0 }
      entry.count += 1
      entry.minutes += Math.round(s.duration / 60)
      byProject.set(key, entry)
    })
    const topProjects = Array.from(byProject.entries())
      .sort((a, b) => b[1].minutes - a[1].minutes)
      .slice(0, 5)

    // 时段分布
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, minutes: 0 }))
    sessions.forEach((s) => {
      const h = new Date(s.completedAt).getHours()
      byHour[h].minutes += Math.round(s.duration / 60)
    })
    const peakHour = byHour.reduce((acc, cur) => (cur.minutes > acc.minutes ? cur : acc))

    // 解锁的成就
    const unlocked = achievements.filter((a) => a.earned)

    // 任务完成度：分母为报表结束前已创建且未归档的任务（区间内"应完成"的口径），
    // 不再拿全部任务当分母导致完成度失真
    const taskTotal = tasks.filter((t) => !t.archived && new Date(t.createdAt) <= end).length
    const taskCompletion = taskTotal > 0 ? Math.round((totalCompletedTasks / taskTotal) * 100) : 0

    return {
      totalMinutes,
      totalSessions,
      avgPerDay,
      totalCompletedTasks,
      taskCompletion,
      dayCount,
      // 输出区间内全部每日明细（此前月报/90 天报告被截断到最后 7 天）
      byDate: Array.from(byDate.entries()),
      peakDay,
      lowDay: lowDay.count === Infinity ? null : lowDay,
      topProjects,
      peakHour,
      unlocked,
    }
  }, [pomodoroSessions, tasks, achievements, start, end])

  const handleExport = () => {
    setExporting(true)
    try {
      const innerHTML = renderReportHTML({ report, type, start, end, label, focusGoals })
      const fileName = `FocusFlow-${label}-${new Date().toISOString().slice(0, 10)}`
      exportHTMLToPDF({ title: `FocusFlow ${label}`, innerHTML, fileName })
      toast.success('正在打开打印对话框…', { description: '请选择"另存为 PDF"' })
      setOpen(false)
    } catch (e: any) {
      toast.error('导出失败', { description: e?.message })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          导出报表
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            导出 {label}
          </DialogTitle>
          <DialogDescription>
            生成可分享的 PDF 报告，涵盖番茄数、时长、任务、习惯等关键数据
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">报表类型</label>
            <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">📅 近 7 天</SelectItem>
                <SelectItem value="monthly">📆 近 30 天</SelectItem>
                <SelectItem value="custom">📈 近 90 天</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 预览摘要 */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">专注时长</span>
              <Badge variant="secondary">{formatHM(report.totalMinutes)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">番茄数</span>
              <Badge variant="secondary">{formatNumber(report.totalSessions)} 个</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">完成任务</span>
              <Badge variant="secondary">{report.totalCompletedTasks} 个</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">日均番茄</span>
              <Badge variant="secondary">{report.avgPerDay.toFixed(1)} 个</Badge>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                生成中…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1.5" />
                生成 PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 报表 HTML 模板
function renderReportHTML({
  report,
  type,
  start,
  end,
  label,
  focusGoals,
}: {
  report: any
  type: ReportType
  start: Date
  end: Date
  label: string
  focusGoals: { dailyMinutes: number; weeklyMinutes: number; dailyPomodoros: number }
}): string {
  const dateRange = `${start.toLocaleDateString('zh-CN')} ~ ${end.toLocaleDateString('zh-CN')}`
  const dailyGoalDays = (() => {
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000)
    return Math.max(1, days + 1)
  })()

  return `
    <h1>${label}</h1>
    <p class="subtitle">统计区间：${dateRange} · 共 ${dailyGoalDays} 天</p>

    <h2>概览数据</h2>
    <div class="grid grid-4">
      <div class="card">
        <div class="stat-value">${formatHM(report.totalMinutes)}</div>
        <div class="stat-label">总专注时长</div>
      </div>
      <div class="card">
        <div class="stat-value">${report.totalSessions}</div>
        <div class="stat-label">完成番茄数</div>
      </div>
      <div class="card">
        <div class="stat-value">${report.totalCompletedTasks}</div>
        <div class="stat-label">完成任务</div>
      </div>
      <div class="card">
        <div class="stat-value">${report.taskCompletion}%</div>
        <div class="stat-label">任务完成度</div>
      </div>
    </div>

    <h2>目标完成情况</h2>
    <table>
      <tr>
        <th>指标</th>
        <th>实际</th>
        <th>目标</th>
        <th>达成率</th>
      </tr>
      <tr>
        <td>日均专注时长</td>
        <td>${Math.round(report.totalMinutes / dailyGoalDays)} 分钟</td>
        <td>${focusGoals.dailyMinutes} 分钟</td>
        <td>${Math.round((report.totalMinutes / dailyGoalDays / focusGoals.dailyMinutes) * 100)}%</td>
      </tr>
      <tr>
        <td>日均番茄数</td>
        <td>${report.avgPerDay.toFixed(1)} 个</td>
        <td>${focusGoals.dailyPomodoros} 个</td>
        <td>${Math.round((report.avgPerDay / focusGoals.dailyPomodoros) * 100)}%</td>
      </tr>
    </table>

    <h2>每日专注</h2>
    <table>
      <tr>
        <th>日期</th>
        <th>番茄数</th>
        <th>时长</th>
      </tr>
      ${report.byDate
        .map(([date, v]: any) => {
          const d = new Date(date)
          const label = `${d.getMonth() + 1}/${d.getDate()}（${['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}）`
          return `<tr><td>${label}</td><td>${v.count}</td><td>${v.minutes} 分钟</td></tr>`
        })
        .join('')}
    </table>

    ${
      report.topProjects.length > 0
        ? `<h2>项目投入 TOP 5</h2>
    <table>
      <tr>
        <th>项目</th>
        <th>番茄数</th>
        <th>时长</th>
      </tr>
      ${report.topProjects
        .map(
          ([name, v]: any) =>
            `<tr><td>${escapeHTML(name)}</td><td>${v.count}</td><td>${v.minutes} 分钟</td></tr>`
        )
        .join('')}
    </table>`
        : ''
    }

    <h2>关键洞察</h2>
    <ul>
      ${
        report.peakDay.count > 0
          ? `<li>高效日：${new Date(report.peakDay.date).toLocaleDateString('zh-CN')}（${report.peakDay.count} 个番茄）</li>`
          : ''
      }
      ${
        report.lowDay
          ? `<li>待提升日：${new Date(report.lowDay.date).toLocaleDateString('zh-CN')}（${report.lowDay.count} 个番茄）</li>`
          : ''
      }
      <li>高峰时段：${report.peakHour.hour}:00-${report.peakHour.hour + 1}:00（${report.peakHour.minutes} 分钟）</li>
    </ul>

    ${
      report.unlocked.length > 0
        ? `<h2>已解锁成就（${report.unlocked.length}）</h2>
    <ul>
      ${report.unlocked
        .slice(0, 10)
        .map((a: any) => `<li>${escapeHTML(a.name)} — ${escapeHTML(a.description)}</li>`)
        .join('')}
    </ul>`
        : ''
    }
  `
}
