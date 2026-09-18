const fs = require('fs')
const path = require('path')

const standaloneDir = path.join(__dirname, '..', '.next', 'standalone')
const serverDir = path.join(__dirname, '..', 'server')
const publicDir = path.join(__dirname, '..', 'public')
const staticDir = path.join(__dirname, '..', '.next', 'static')

console.log('Building server for Electron...')

let actualStandaloneDir = standaloneDir
if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
  const subDirs = fs.readdirSync(standaloneDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
  
  for (const subDir of subDirs) {
    const subServerJs = path.join(standaloneDir, subDir, 'server.js')
    if (fs.existsSync(subServerJs)) {
      actualStandaloneDir = path.join(standaloneDir, subDir)
      console.log(`Found server.js in subdirectory: ${subDir}`)
      break
    }
  }
}

if (!fs.existsSync(actualStandaloneDir) || !fs.existsSync(path.join(actualStandaloneDir, 'server.js'))) {
  console.error('Standalone build not found. Run "npm run build" first.')
  process.exit(1)
}

if (fs.existsSync(serverDir)) {
  try {
    fs.rmSync(serverDir, { recursive: true, maxRetries: 5, retryDelay: 200 })
  } catch (err) {
    // Windows 上若 FocusFlow 正在运行，它会占用 server/ 下的文件，
    // 此时 rmSync 既删不掉也不会自动失败，表现为构建永久卡住且没有任何输出。
    // 这里主动失败并给出可执行的原因，避免又一次静默挂起。
    console.error('')
    console.error(`[build:server] 无法清空 server/ 目录: ${err.code || err.message}`)
    console.error('  最常见原因：FocusFlow 应用（含它拉起的 node server.js 后端）仍在运行，占用了 server/ 下的文件。')
    console.error('  请先完全退出 FocusFlow（含托盘图标），再重新执行构建。')
    process.exit(1)
  }
}

fs.mkdirSync(serverDir, { recursive: true })

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      try {
        fs.copyFileSync(srcPath, destPath)
      } catch (err) {
        console.error('')
        console.error(`[build:server] 复制失败: ${destPath}`)
        console.error(`  原因: ${err.code || err.message}`)
        console.error('  目标文件被占用时，通常意味着 FocusFlow 仍在运行，请完全退出后重试。')
        process.exit(1)
      }
    }
  }
}

console.log('Copying standalone files...')
copyDir(actualStandaloneDir, serverDir)

console.log('Copying static files...')
const destStaticDir = path.join(serverDir, '.next', 'static')
fs.mkdirSync(destStaticDir, { recursive: true })
copyDir(staticDir, destStaticDir)

console.log('Copying public files...')
const destPublicDir = path.join(serverDir, 'public')
fs.mkdirSync(destPublicDir, { recursive: true })
if (fs.existsSync(publicDir)) {
  copyDir(publicDir, destPublicDir)
}

const serverJs = path.join(serverDir, 'server.js')
let content = fs.readFileSync(serverJs, 'utf-8')
content = content.replace(/\.next/g, './.next')
// 防御性收紧：忽略环境变量中的 HOSTNAME（Git Bash/CI 常注入机器名），
// 仅接受专用变量 FOCUSFLOW_HOST 且必须为回环地址，否则一律回落 127.0.0.1
content = content.replace(
  /const hostname = process\.env\.HOSTNAME \|\| ['"](?:0\.0\.0\.0|127\.0\.0\.1)['"]/,
  [
    "const __ffHostRequested = process.env.FOCUSFLOW_HOST || '127.0.0.1'",
    "const hostname = ['127.0.0.1', 'localhost', '::1'].includes(__ffHostRequested) ? __ffHostRequested : '127.0.0.1'",
  ].join('\n')
)
fs.writeFileSync(serverJs, content)

console.log('Server build complete!')
console.log(`Server directory: ${serverDir}`)
