const CACHE = 'academy-__VERSION__'
const ASSETS = __ASSETS__
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())))
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name=>name.startsWith('academy-') && name!==CACHE).map(name=>caches.delete(name)))).then(() => self.clients.claim())))
self.addEventListener('fetch', event => {
  const url=new URL(event.request.url)
  if(event.request.method!=='GET' || url.origin!==self.location.origin)return
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(async()=>await caches.match('/index.html')??Response.error()))
    return
  }
  if(ASSETS.includes(url.pathname)){
    event.respondWith(caches.match(url.pathname).then(response=>response??fetch(event.request)))
    return
  }
  if(url.pathname.startsWith('/engine/')){
    event.respondWith(caches.match(event.request).then(async cached=>{
      if(cached)return cached
      const response=await fetch(event.request)
      if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone())}
      return response
    }))
  }
})
