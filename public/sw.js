/**
 * FocusFlow 最小 Service Worker：
 * - 满足 PWA 可安装性
 * - 预缓存应用外壳，导航请求断网时回退缓存的首页
 * - 静态资源（/_next/static、图标）缓存优先；其余一律直连网络，不干扰动态数据
 */
const CACHE = 'focusflow-v1'
const SHELL = ['/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 导航请求：网络优先，断网回退缓存外壳
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/').then((cached) => cached ?? Response.error()))
    )
    return
  }

  // 带内容哈希的静态资源：缓存优先
  const isStatic = url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icon')
  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
          return response
        })
      })
    )
  }
})
