/* =========================================================
   数据层：GitHub 仓库 JSON（公开读取 + 管理端提交）
   ========================================================= */
(function () {
  "use strict";

  var cfg = window.APP_CONFIG;
  var gh = cfg.github;
  var remoteSha = null;

  function emptyData() {
    return { members: [], events: [], points: [], teachers: [], redemptions: [], updatedAt: null };
  }

  function apiUrl() {
    return "https://api.github.com/repos/" + gh.owner + "/" + gh.repo + "/contents/" + gh.dataPath;
  }

  function headers(token) {
    return {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  function decodeBase64Utf8(b64) {
    var bin = atob(String(b64 || "").replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function encodeBase64Utf8(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  /* 公开端：读 Pages 上的静态 JSON */
  async function loadPublic() {
    var res = await fetch("./data/site.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("数据文件读取失败（" + res.status + "）");
    var data = await res.json();
    return Object.assign(emptyData(), data);
  }

  function getToken() {
    return localStorage.getItem("douyan_gh_token") || "";
  }

  function setToken(t) {
    if (t) localStorage.setItem("douyan_gh_token", t);
    else localStorage.removeItem("douyan_gh_token");
  }

  /* 管理端：读 GitHub 上的权威数据（带 sha，保存时需要） */
  async function loadRemote(token) {
    var res = await fetch(apiUrl() + "?ref=" + gh.branch, { headers: headers(token), cache: "no-store" });
    if (res.status === 401) throw new Error("Token 无效或已过期");
    if (res.status === 404) throw new Error("仓库或数据文件不存在，或 Token 没有该仓库权限");
    if (!res.ok) throw new Error("读取失败（" + res.status + "）");
    var j = await res.json();
    remoteSha = j.sha;
    var text = decodeBase64Utf8(j.content);
    var data = text ? JSON.parse(text) : emptyData();
    return Object.assign(emptyData(), data);
  }

  /* 管理端：保存（提交一次 commit，Pages 约 1 分钟生效） */
  async function saveRemote(token, data) {
    data.updatedAt = new Date().toISOString();
    var res = await fetch(apiUrl(), {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, headers(token)),
      body: JSON.stringify({
        message: "斗研数据更新 " + data.updatedAt,
        content: encodeBase64Utf8(JSON.stringify(data, null, 2)),
        branch: gh.branch,
        sha: remoteSha
      })
    });
    if (res.status === 409) throw new Error("数据已被其他人修改，请刷新页面后重试");
    if (!res.ok) {
      var msg = "";
      try { msg = (await res.json()).message || ""; } catch (e) {}
      throw new Error("保存失败（" + res.status + "）" + (msg ? "：" + msg : ""));
    }
    var j = await res.json();
    remoteSha = j.content && j.content.sha;
    return j;
  }

  window.Store = {
    loadPublic: loadPublic,
    loadRemote: loadRemote,
    saveRemote: saveRemote,
    getToken: getToken,
    setToken: setToken
  };
})();
