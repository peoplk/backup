const { build } = require('electron-builder')
const fs = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

const updateUrl = process.env.FOCUSFLOW_UPDATE_URL || 'https://example.com/focusflow-releases/'

const config = {
  ...(pkg.build || {}),
  publish: {
    provider: 'generic',
    url: updateUrl,
  },
}

console.log(`[build-electron] publish url: ${updateUrl}`)

const args = process.argv.slice(2)
const buildOptions = {}

if (args.includes('--win')) {
  buildOptions.win = args.includes('--x64') ? ['x64'] : true
}
if (args.includes('--mac')) {
  buildOptions.mac = true
}
if (args.includes('--linux')) {
  buildOptions.linux = true
}
if (args.includes('--dir')) {
  buildOptions.dir = true
}

build({ config, ...buildOptions }).catch((err) => {
  console.error(err)
  process.exit(1)
})