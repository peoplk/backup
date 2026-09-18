const { build } = require('electron-builder')
const fs = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

// 默认走 package.json 里的 github 发布配置；FOCUSFLOW_UPDATE_URL 仅用于切换到自建 generic 源
const updateUrl = process.env.FOCUSFLOW_UPDATE_URL || ''

const config = {
  ...(pkg.build || {}),
  publish: updateUrl
    ? { provider: 'generic', url: updateUrl }
    : (pkg.build && pkg.build.publish) || { provider: 'github', owner: 'peoplk', repo: 'backup' },
}

console.log(`[build-electron] publish: ${updateUrl ? `generic ${updateUrl}` : JSON.stringify(config.publish)}`)

const args = process.argv.slice(2)
const buildOptions = {}

// electron-builder 26 JS API：平台选项须传 "target[:arch]" 字符串数组
// （true 或 ['x64'] 分别会触发 types is not iterable / Unknown target: x64）
// target 名从 package.json 的 build.<platform>.target 读取，架构由命令行追加后缀
function targetsFor(platform) {
  const configured = pkg.build && pkg.build[platform] && pkg.build[platform].target
  const list = Array.isArray(configured) ? configured : [configured]
  return list.map((t) => (typeof t === 'string' ? t : t && t.target)).filter(Boolean)
}

const archSuffix = args.includes('--x64')
  ? ':x64'
  : args.includes('--arm64')
  ? ':arm64'
  : args.includes('--ia32')
  ? ':ia32'
  : ''

if (args.includes('--win')) {
  const names = targetsFor('win')
  buildOptions.win = archSuffix ? names.map((t) => `${t}${archSuffix}`) : names
}
if (args.includes('--mac')) {
  const names = targetsFor('mac')
  buildOptions.mac = archSuffix ? names.map((t) => `${t}${archSuffix}`) : names
}
if (args.includes('--linux')) {
  const names = targetsFor('linux')
  buildOptions.linux = archSuffix ? names.map((t) => `${t}${archSuffix}`) : names
}
if (args.includes('--dir')) {
  buildOptions.dir = true
}

build({ config, ...buildOptions }).catch((err) => {
  console.error(err)
  process.exit(1)
})