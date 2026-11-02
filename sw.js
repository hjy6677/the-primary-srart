'use strict';

/**
 * 时序 · 离线应用外壳
 *
 * 只缓存页面运行所需的静态文件，不缓存：
 * - /api/ 下的同步接口
 * - 跨域请求
 * - 用户事件数据（数据在 localStorage / 同步服务器）
 *
 * 更新版本时请同时修改 CACHE_NAME。
 */

const CACHE_PREFIX = 'shixu-shell-';
const CACHE_NAME = 'shixu-shell-v3';
const SCOPE = self.registration.scope;
const INDEX_URL = new URL('index.html', SCOPE).href;
// 不把 manifest 放进预缓存：公网隧道可能把浏览器的 manifest 请求
// 重定向到安全确认页，跨域重定向会让整个 cache.addAll() 失败。
const SHELL_URLS = [
  'index.html',
  'styles.css',
  'app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
].map((path) => new URL(path, SCOPE).href);
const SHELL_SET = new Set(SHELL_URLS);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function offlineResponse() {
  return new Response('当前离线，且应用外壳尚未缓存完成。', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(INDEX_URL, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(INDEX_URL);
        return cached || offlineResponse();
      }
    })());
    return;
  }

  if (!SHELL_SET.has(url.href)) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    const networkPromise = fetch(request).then(async (response) => {
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(networkPromise);
      return cached;
    }
    return (await networkPromise) || offlineResponse();
  })());
});
