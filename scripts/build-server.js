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
  fs.rmSync(serverDir, { recursive: true })
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
      fs.copyFileSync(srcPath, destPath)
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
fs.writeFileSync(serverJs, content)

console.log('Server build complete!')
console.log(`Server directory: ${serverDir}`)
