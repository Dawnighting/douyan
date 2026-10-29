/* 斗研积分 · Service Worker（网络优先 + 离线兜底） */
var CACHE = "douyan-v3";
var ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./css/style.css",
  "./js/config.js",
  "./js/store.js",
  "./js/public.js",
  "./js/admin.js",
  "./data/site.json",
  "./manifest.webmanifest",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) { return hit || caches.match("./index.html"); });
    })
  );
});
