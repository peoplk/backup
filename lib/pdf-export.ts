'use client'

/**
 * PDF 导出工具（基于浏览器打印 / Electron 打印到 PDF）
 * 不依赖 jspdf / html2canvas，避免大体积依赖和打包问题
 *
 * 用法：
 * 1. 准备好一个隐藏的 DOM 节点（reportRef）
 * 2. 调用 exportToPDF(node, fileName)
 * 3. Electron / Chrome 中用户选"保存为 PDF"
 */

export interface ExportOptions {
  fileName?: string
  /** 是否同时打开新窗口预览 */
  openInNewWindow?: boolean
}

function buildPrintHTML(title: string, innerHTML: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${escapeHTML(title)}</title>
<style>
  @page {
    size: A4;
    margin: 12mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei",
      "Segoe UI", Roboto, sans-serif;
    color: #1a1a1a;
    line-height: 1.5;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }
  .report {
    max-width: 800px;
    margin: 0 auto;
  }
  .report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #3b82f6;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .report-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 700;
    color: #3b82f6;
  }
  .report-meta {
    font-size: 12px;
    color: #6b7280;
    text-align: right;
  }
  .report h1 {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 6px;
  }
  .report h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 16px 0 8px;
    color: #1f2937;
    border-left: 3px solid #3b82f6;
    padding-left: 8px;
  }
  .report .subtitle {
    font-size: 13px;
    color: #6b7280;
    margin: 0 0 16px;
  }
  .report .grid {
    display: grid;
    gap: 10px;
  }
  .report .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .report .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .report .grid-4 { grid-template-columns: repeat(4, 1fr); }
  .report .card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px 12px;
    background: #f9fafb;
  }
  .report .stat-value {
    font-size: 20px;
    font-weight: 700;
    color: #3b82f6;
  }
  .report .stat-label {
    font-size: 11px;
    color: #6b7280;
    margin-top: 2px;
  }
  .report .footer {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px dashed #d1d5db;
    text-align: center;
    font-size: 11px;
    color: #9ca3af;
  }
  .report table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .report th, .report td {
    border: 1px solid #e5e7eb;
    padding: 6px 8px;
    text-align: left;
  }
  .report th {
    background: #f3f4f6;
    font-weight: 600;
  }
  .report ul {
    margin: 0;
    padding-left: 20px;
  }
  .report .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    background: #dbeafe;
    color: #1e40af;
    font-size: 11px;
  }
  .report .text-emerald-500 { color: #10b981; }
  .report .text-amber-500 { color: #f59e0b; }
  .report .text-rose-500 { color: #f43f5e; }
  @media print {
    body { margin: 0; }
    .report { max-width: 100%; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    svg { shape-rendering: geometricPrecision; }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
</style>
</head>
<body>
  <div class="report">
    <div class="report-header">
      <div class="report-brand">
        <span>🍅</span>
        <span>FocusFlow</span>
      </div>
      <div class="report-meta">
        <div>${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div>${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
    ${innerHTML}
    <div class="footer">
      本报告由 FocusFlow 自动生成 · ${new Date().toISOString()}
    </div>
  </div>
  <script class="no-print">
    // 自动触发打印对话框
    setTimeout(() => {
      try { window.print() } catch (e) { console.warn(e) }
    }, 300)
  </script>
</body>
</html>`
}

/**
 * 将 HTML 字符串导出为 PDF（通过浏览器打印）
 * 在 Electron 中用户可选择"保存为 PDF"；在浏览器中可下载或保存到本地
 */
export function exportHTMLToPDF(opts: {
  title: string
  innerHTML: string
  fileName?: string
}): void {
  const { title, innerHTML, fileName } = opts
  const html = buildPrintHTML(title, innerHTML)

  // Electron 环境：使用 webContents.printToPDF（需要 IPC）
  // 浏览器环境：打开新窗口并触发打印
  if (typeof window !== 'undefined') {
    const w = window.open('', '_blank', 'width=1200,height=1600')
    if (!w) {
      alert('请允许弹窗以导出 PDF')
      return
    }
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.document.title = fileName || title
  }
}

/**
 * 触发 Electron 的"保存 PDF"动作（需 preload 暴露 api）
 */
export async function exportViaElectronPrint(opts: {
  title: string
  innerHTML: string
  fileName: string
}): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const api = window.electronAPI
  if (!api?.printToPDF) return false
  try {
    const html = buildPrintHTML(opts.title, opts.innerHTML)
    const result = await api.printToPDF({ html, fileName: opts.fileName })
    if (result?.success) {
      return true
    }
  } catch (e) {
    console.warn('printToPDF failed', e)
  }
  return false
}

/**
 * 直接从 DOM 节点生成 PDF
 * 把节点内容包装到 print 模板中
 */
export function exportElementToPDF(opts: {
  element: HTMLElement
  title: string
  fileName?: string
  metaTitle?: string
  metaSubtitle?: string
}): void {
  const clone = opts.element.cloneNode(true) as HTMLElement
  // 移除 print 不可见元素
  clone.querySelectorAll('.no-print').forEach((n) => n.remove())

  const innerHTML = `
    <h1>${escapeHTML(opts.metaTitle || opts.title)}</h1>
    ${opts.metaSubtitle ? `<p class="subtitle">${escapeHTML(opts.metaSubtitle)}</p>` : ''}
    ${clone.outerHTML}
  `
  exportHTMLToPDF({ title: opts.title, innerHTML, fileName: opts.fileName })
}

export function escapeHTML(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 把数字格式化为带千分位的字符串
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN')
}

/**
 * 把分钟格式化为 "Xh Ym"
 */
export function formatHM(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── 专注报表 PDF 导出 ────────────────────────────────────────

export interface FocusReportData {
  /** 日期范围描述，如 "近30天" */
  dateRange: string
  /** 每日专注数据 */
  dailyData: Array<{ date: string; minutes: number }>
  /** 总专注时长（分钟） */
  totalFocusMinutes: number
  /** 完成番茄钟数 */
  totalSessions: number
  /** 平均每番茄钟时长（分钟） */
  avgDuration: number
  /** 涉及项目数 */
  projectCount: number
  /** 项目分布 */
  projectData: Array<{
    name: string
    minutes: number
    sessions: number
    taskCount: number
    color: string
  }>
  /** 标签分布 */
  tagData: Array<{
    name: string
    minutes: number
  }>
}

/**
 * 导出专注报表为 PDF
 * 使用浏览器原生 print API，不依赖第三方库
 */
export function exportFocusReportToPDF(data: FocusReportData): void {
  const maxDailyMinutes = Math.max(...data.dailyData.map((d) => d.minutes), 1)

  // 生成每日专注柱状图（SVG 矢量图，打印更清晰）
  const barChartHTML = data.dailyData.length > 0
    ? (() => {
        const barCount = data.dailyData.length
        const chartWidth = 760
        const chartHeight = 150
        const paddingBottom = 26
        const gap = 4
        const maxBarWidth = 18
        const availableWidth = chartWidth - gap * (barCount - 1)
        const barWidth = Math.min(maxBarWidth, availableWidth / barCount)
        const totalBarsWidth = barWidth * barCount + gap * (barCount - 1)
        const startX = (chartWidth - totalBarsWidth) / 2
        const plotHeight = chartHeight - paddingBottom

        const bars = data.dailyData
          .map((d, i) => {
            const height = maxDailyMinutes > 0 ? Math.max((d.minutes / maxDailyMinutes) * plotHeight, 2) : 2
            const x = startX + i * (barWidth + gap)
            const y = plotHeight - height
            return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" rx="2" fill="#3b82f6" ${d.minutes === 0 ? 'opacity="0.2"' : ''} />`
          })
          .join('')

        const labels = data.dailyData
          .map((d, i) => {
            const x = startX + i * (barWidth + gap) + barWidth / 2
            const y = chartHeight - 6
            return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" font-size="9" fill="#9ca3af">${escapeHTML(d.date)}</text>`
          })
          .join('')

        return `<svg width="100%" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none" style="display:block;margin:8px 0 4px;">
          <line x1="0" y1="${plotHeight}" x2="${chartWidth}" y2="${plotHeight}" stroke="#e5e7eb" stroke-width="1" />
          ${bars}
          ${labels}
        </svg>`
      })()
    : '<p style="color:#9ca3af;font-size:12px;text-align:center;padding:20px 0;">暂无数据</p>'

  // 项目分布表格
  const projectTableHTML = data.projectData.length > 0
    ? `<table>
        <thead>
          <tr><th>项目</th><th style="text-align:right">专注时长</th><th style="text-align:right">番茄钟</th><th style="text-align:right">任务数</th><th style="text-align:right">占比</th></tr>
        </thead>
        <tbody>
          ${data.projectData.map((p) => {
            const pct = data.totalFocusMinutes > 0 ? ((p.minutes / data.totalFocusMinutes) * 100).toFixed(1) : '0.0'
            return `<tr>
              <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;vertical-align:middle;"></span>${escapeHTML(p.name)}</td>
              <td style="text-align:right">${formatHM(p.minutes)}</td>
              <td style="text-align:right">${p.sessions}</td>
              <td style="text-align:right">${p.taskCount}</td>
              <td style="text-align:right">${pct}%</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`
    : '<p style="color:#9ca3af;font-size:12px;">暂无项目数据</p>'

  // 标签分布列表
  const tagListHTML = data.tagData.length > 0
    ? `<ul>${data.tagData.map((t) => {
        const pct = data.totalFocusMinutes > 0 ? ((t.minutes / data.totalFocusMinutes) * 100).toFixed(1) : '0.0'
        return `<li>${escapeHTML(t.name)} — ${formatHM(t.minutes)}（${pct}%）</li>`
      }).join('')}</ul>`
    : '<p style="color:#9ca3af;font-size:12px;">暂无标签数据</p>'

  const innerHTML = `
    <h1>专注报表</h1>
    <p class="subtitle">${escapeHTML(data.dateRange)}</p>

    <h2>汇总统计</h2>
    <div class="grid grid-4">
      <div class="card">
        <div class="stat-value">${formatHM(data.totalFocusMinutes)}</div>
        <div class="stat-label">总专注时长</div>
      </div>
      <div class="card">
        <div class="stat-value">${data.totalSessions}</div>
        <div class="stat-label">完成番茄钟</div>
      </div>
      <div class="card">
        <div class="stat-value">${data.avgDuration} 分钟</div>
        <div class="stat-label">平均每番茄钟</div>
      </div>
      <div class="card">
        <div class="stat-value">${data.projectCount}</div>
        <div class="stat-label">涉及项目</div>
      </div>
    </div>

    <h2>每日专注趋势</h2>
    ${barChartHTML}

    <h2>项目分布</h2>
    ${projectTableHTML}

    ${data.tagData.length > 0 ? `<h2>标签分布</h2>${tagListHTML}` : ''}
  `

  exportHTMLToPDF({
    title: '专注报表',
    innerHTML,
    fileName: `专注报表_${data.dateRange}`,
  })
}
