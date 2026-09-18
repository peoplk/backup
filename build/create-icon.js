/**
 * FocusFlow 应用图标生成器
 *
 * 设计：Modern Dark 风格的应用磁贴
 *   - 深色圆角磁贴（近黑蓝），顶部一道极淡的高光保证立体感
 *   - 大开口进度环（番茄钟表盘语义），蓝→靛→紫渐变，圆头端帽
 *   - 中心焦点圆点，强化"专注"语义
 *   - 不含任何字母字形：字母在 16x16 下会糊成色块
 *
 * 为什么重写旧版：
 *   1. 旧版用最近邻缩放（Math.floor）生成小尺寸，16/24/32 边缘严重锯齿
 *   2. 旧版只有 256/48/32/16 四档，缺 24/64/128，Windows 会拿 256 硬缩出模糊图标
 *   3. 旧版把轨道、圆点、字母全部等比缩到 16px，细节互相糊死
 *   4. 旧版输出的是全 PNG 条目 ICO，兼容性不如"小尺寸 DIB + 大尺寸 PNG"的常规布局
 *
 * 本版做法：
 *   - sharp/librsvg 矢量渲染，先以 4x 超采样再 lanczos3 降采样，保证边缘干净
 *   - 逐尺寸光学适配（optical sizing）：小尺寸主动减元素、加粗细，而不是等比缩小
 *   - 标准多尺寸 ICO：16/24/32/48/64 用 BMP/DIB 条目，128/256 用 PNG 条目
 *
 * 用法：node build/create-icon.js
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.join(__dirname, '..')
const PUBLIC_DIR = path.join(ROOT, 'public')

const VB = 256
const CX = VB / 2
const CY = VB / 2

/**
 * 逐尺寸光学适配参数。
 * 小尺寸下轨道和圆点会互相挤成一团，因此主动去掉它们并把环身加粗，
 * 让 16x16 在任务栏里依然读得出"带开口的环"这个核心形状。
 */
function params(size) {
  if (size <= 16) return { r: 63, w: 36, track: false, dot: 0, gap: 84 }
  if (size <= 24) return { r: 62, w: 31, track: false, dot: 16, gap: 82 }
  if (size <= 48) return { r: 63, w: 28, track: false, dot: 15, gap: 80 }
  return { r: 64, w: 26, track: true, dot: 15, gap: 80 }
}

function arcPath(cx, cy, r, startDeg, sweepDeg) {
  const a0 = (startDeg * Math.PI) / 180
  const a1 = ((startDeg + sweepDeg) * Math.PI) / 180
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  const large = sweepDeg > 180 ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

/** 生成指定尺寸档位的矢量图。返回 256 单位坐标系的 SVG 字符串。 */
function iconSvg(size) {
  const p = params(size)
  const start = -90 + p.gap / 2
  const sweep = 360 - p.gap
  // 顶部高光只在有大尺寸时才有意义；极细描边从 24px 起加，
  // 否则深色磁贴在 Windows 深色任务栏上会与背景糊在一起。
  const sheen = size >= 64
  const hairline = size >= 24

  const parts = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VB}" height="${VB}" viewBox="0 0 ${VB} ${VB}">`,
    '<defs>',
    '<linearGradient id="tile" x1="0" y1="0" x2="0.35" y2="1">',
    '<stop offset="0" stop-color="#1C2233"/>',
    '<stop offset="0.55" stop-color="#131826"/>',
    '<stop offset="1" stop-color="#0B0E15"/>',
    '</linearGradient>',
    '<linearGradient id="arc" x1="0.08" y1="0.02" x2="0.95" y2="0.9">',
    '<stop offset="0" stop-color="#4EA8FF"/>',
    '<stop offset="0.45" stop-color="#6C6CF5"/>',
    '<stop offset="1" stop-color="#B15CF7"/>',
    '</linearGradient>',
    '<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.14"/>',
    '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>',
    '</linearGradient>',
    '<clipPath id="tileClip"><rect x="6" y="6" width="244" height="244" rx="56"/></clipPath>',
    '</defs>'
  )

  parts.push('<rect x="6" y="6" width="244" height="244" rx="56" fill="url(#tile)"/>')

  if (sheen) {
    parts.push(
      '<g clip-path="url(#tileClip)"><rect x="6" y="6" width="244" height="104" fill="url(#sheen)"/></g>'
    )
  }

  if (hairline) {
    parts.push(
      '<rect x="6.5" y="6.5" width="243" height="243" rx="55.5" fill="none" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="1.5"/>'
    )
  }

  if (p.track) {
    parts.push(
      `<circle cx="${CX}" cy="${CY}" r="${p.r}" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="${p.w}"/>`
    )
  }

  parts.push(
    `<path d="${arcPath(CX, CY, p.r, start, sweep)}" fill="none" stroke="url(#arc)" stroke-width="${p.w}" stroke-linecap="round"/>`
  )

  if (p.dot > 0) {
    parts.push(`<circle cx="${CX}" cy="${CY}" r="${p.dot}" fill="#E8EEFF"/>`)
  }

  parts.push('</svg>')
  return parts.join('')
}

/** 矢量渲染到目标尺寸：先 4x 超采样，再 lanczos3 降采样，得到干净的抗锯齿边缘。 */
async function renderAt(size) {
  const density = (72 * size * 4) / VB
  const hiPng = await sharp(Buffer.from(iconSvg(size)), { density }).png().toBuffer()
  const base = sharp(hiPng).resize(size, size, { kernel: 'lanczos3', fit: 'fill' })

  const png = await base.clone().png({ compressionLevel: 9 }).toBuffer()
  const { data } = await base.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  return { png, rgba: data }
}

/**
 * 32bpp DIB 条目：BITMAPINFOHEADER + 自下而上的 BGRA 像素 + 全零 AND 掩码。
 * 小尺寸用 DIB 而非 PNG，是 Windows 图标最稳妥的常规布局。
 */
function rgbaToDib(rgba, w, h) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(w, 4)
  header.writeInt32LE(h * 2, 8) // XOR 位图 + AND 掩码
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(0, 16) // BI_RGB
  header.writeUInt32LE(w * h * 4, 20)

  const xor = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    const srcRow = y
    const dstRow = h - 1 - y // DIB 是自下而上
    for (let x = 0; x < w; x++) {
      const s = (srcRow * w + x) * 4
      const d = (dstRow * w + x) * 4
      xor[d] = rgba[s + 2] // B
      xor[d + 1] = rgba[s + 1] // G
      xor[d + 2] = rgba[s] // R
      xor[d + 3] = rgba[s + 3] // A
    }
  }

  const andStride = Math.ceil(w / 32) * 4
  const and = Buffer.alloc(andStride * h) // 全零 = 不透明，透明度由 alpha 通道决定

  return Buffer.concat([header, xor, and])
}

/** 组装多尺寸 ICO。大尺寸用 PNG 条目压缩体积，小尺寸用 DIB 条目保兼容。 */
function buildIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  let offset = 6 + entries.length * 16
  const dirs = []
  for (const e of entries) {
    const d = Buffer.alloc(16)
    d[0] = e.size >= 256 ? 0 : e.size // 256 以 0 表示
    d[1] = e.size >= 256 ? 0 : e.size
    d[2] = 0
    d[3] = 0
    d.writeUInt16LE(1, 4)
    d.writeUInt16LE(32, 6)
    d.writeUInt32LE(e.data.length, 8)
    d.writeUInt32LE(offset, 12)
    dirs.push(d)
    offset += e.data.length
  }

  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.data)])
}

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const PNG_ENTRY_FROM = 128

/** 尺寸对照预览：同一图标在深色与浅色背景下的 1x 实际观感 */
async function writePreview(rendered) {
  const ladder = [256, 128, 64, 48, 32, 24, 16]
  const gap = 24
  const margin = 28
  const rowH = 280
  const width = margin * 2 + ladder.reduce((a, s) => a + s, 0) + gap * (ladder.length - 1)
  const height = rowH * 2

  const overlays = []
  for (let row = 0; row < 2; row++) {
    let x = margin
    const centerY = row * rowH + rowH / 2
    for (const size of ladder) {
      overlays.push({
        input: rendered.get(size).png,
        left: x,
        top: Math.round(centerY - size / 2),
      })
      x += size + gap
    }
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 15, g: 17, b: 23, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width,
            height: rowH,
            channels: 4,
            background: { r: 242, g: 244, b: 248, alpha: 1 },
          },
        })
          .png()
          .toBuffer(),
        left: 0,
        top: rowH,
      },
      ...overlays,
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, 'build', 'icon-preview.png'))
}

async function main() {
  const rendered = new Map()
  for (const size of ICO_SIZES) {
    rendered.set(size, await renderAt(size))
  }
  for (const size of [180]) {
    rendered.set(size, await renderAt(size))
  }

  const pngEntries = ICO_SIZES.filter((s) => s >= PNG_ENTRY_FROM).map((s) => ({
    size: s,
    data: rendered.get(s).png,
  }))
  const dibEntries = ICO_SIZES.filter((s) => s < PNG_ENTRY_FROM).map((s) => ({
    size: s,
    data: rgbaToDib(rendered.get(s).rgba, s, s),
  }))
  const ico = buildIco([...dibEntries, ...pngEntries].sort((a, b) => a.size - b.size))

  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.ico'), ico)
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.png'), rendered.get(256).png)
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.svg'), iconSvg(256))
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-light-32x32.png'), rendered.get(32).png)
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-dark-32x32.png'), rendered.get(32).png)
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-icon.png'), rendered.get(180).png)

  await writePreview(rendered)

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`
  console.log('[create-icon] FocusFlow 图标已生成')
  console.log(`  public/icon.ico              ${kb(ico.length)}  尺寸 ${ICO_SIZES.join('/')}`)
  console.log(`  public/icon.png              ${kb(rendered.get(256).png.length)}  256x256`)
  console.log(`  public/icon.svg              (矢量母版)`)
  console.log(`  public/icon-light-32x32.png  ${kb(rendered.get(32).png.length)}`)
  console.log(`  public/icon-dark-32x32.png   ${kb(rendered.get(32).png.length)}`)
  console.log(`  public/apple-icon.png        ${kb(rendered.get(180).png.length)}  180x180`)
  console.log(`  build/icon-preview.png       (尺寸对照预览)`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[create-icon] 失败:', err)
    process.exit(1)
  })
}

module.exports = { iconSvg, renderAt, buildIco, rgbaToDib, params, ICO_SIZES }
