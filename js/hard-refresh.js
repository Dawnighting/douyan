/* 页面内强制刷新：清理旧缓存和 Service Worker 后重新加载。 */
(function () {
  "use strict";

  async function hardRefresh(button) {
    var buttons = document.querySelectorAll("[data-hard-refresh]");
    buttons.forEach(function (item) {
      item.disabled = true;
      if (item === button) item.textContent = "刷新中…";
    });

    try {
      if ("serviceWorker" in navigator) {
        var registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(function (registration) {
          return registration.unregister().catch(function () { return false; });
        }));
      }
    } catch (e) {
      console.warn("注销 Service Worker 失败", e);
    }

    try {
      if ("caches" in window) {
        var keys = await caches.keys();
        await Promise.all(keys.map(function (key) {
          return caches.delete(key).catch(function () { return false; });
        }));
      }
    } catch (e) {
      console.warn("清理浏览器缓存失败", e);
    }

    var url = new URL(window.location.href);
    url.searchParams.set("_hard_refresh", Date.now().toString());
    window.location.replace(url.toString());
  }

  document.querySelectorAll("[data-hard-refresh]").forEach(function (button) {
    button.addEventListener("click", function () {
      hardRefresh(button);
    });
  });
})();
