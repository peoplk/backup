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
<title>${title}</title>
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
    const w = window.open('', '_blank', 'width=900,height=1100')
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
  const api = (window as any).electronAPI
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

function escapeHTML(s: string): string {
  return s
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
