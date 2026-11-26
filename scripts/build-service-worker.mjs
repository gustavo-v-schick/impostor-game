import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

async function collect(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(entries.map((entry) => {
    const relative = prefix + entry.name
    return entry.isDirectory()
      ? collect(join(directory, entry.name), relative + '/')
      : [relative]
  }))
  return paths.flat().filter((path) => path !== 'sw.js').sort()
}

const files = await collect('dist')
const hash = createHash('sha256')
for (const file of files) {
  hash.update(file)
  hash.update(await readFile(join('dist', file)))
}
const cacheName = 'impostor-game-' + hash.digest('hex').slice(0, 16)

const source = `
const CACHE = ${JSON.stringify(cacheName)}
const PREFIX = 'impostor-game-'
const SHELL = new URL('index.html', self.registration.scope).href
const FILES = ${JSON.stringify(files)}.map(path => new URL(path, self.registration.scope).href)

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    if (request.mode === 'navigate') {
      return await cache.match(SHELL) || fetch(request)
    }
    return await cache.match(request) || fetch(request)
  })())
})
`
await writeFile('dist/sw.js', source)
console.log('Offline cache:', cacheName, '(' + files.length + ' files)')
