/* =========================================================
   CloudBase 数据访问封装
   ========================================================= */
(function () {
  "use strict";

  var cfg = window.APP_CONFIG;
  var app = null;
  var auth = null;
  var db = null;

  function init() {
    if (app) return;
    if (!window.cloudbase) throw new Error("CloudBase SDK 未加载");
    app = cloudbase.init({ env: cfg.envId });
    auth = app.auth({ persistence: "local" });
    db = app.database();
  }

  function coll(name) {
    init();
    return db.collection(name);
  }

  async function currentUser() {
    init();
    try {
      return await auth.getCurrentUser();
    } catch (e) {
      return null;
    }
  }

  async function signIn(username, password) {
    init();
    return auth.signIn({ username: username, password: password });
  }

  async function signOut() {
    init();
    return auth.signOut();
  }

  /* 公开端：没有登录态时用匿名身份读取 */
  async function ensureReadable() {
    init();
    var user = await currentUser();
    if (user) return user;
    try {
      return await auth.signInAnonymously();
    } catch (e) {
      console.warn("匿名登录失败（请确认云开发已开启匿名登录）：", e);
      return null;
    }
  }

  /* 分页拉取（客户端单次最多 100 条） */
  async function listAll(name, opts) {
    opts = opts || {};
    var pageSize = 100;
    var all = [];
    var skip = 0;
    var max = opts.max || 3000;
    while (all.length < max) {
      var q = coll(name);
      if (opts.where) q = q.where(opts.where);
      if (opts.orderBy) q = q.orderBy(opts.orderBy, opts.order || "desc");
      var res = await q.skip(skip).limit(pageSize).get();
      var data = (res && res.data) || [];
      all = all.concat(data);
      if (data.length < pageSize) break;
      skip += pageSize;
    }
    return all;
  }

  async function add(name, data) {
    var doc = Object.assign({ ts: Date.now(), createdAt: new Date().toISOString() }, data);
    var res = await coll(name).add(doc);
    return (res && (res.id || res._id)) || null;
  }

  async function update(name, id, data) {
    return coll(name).doc(id).update(data);
  }

  async function remove(name, id) {
    return coll(name).doc(id).remove();
  }

  window.TCB = {
    init: init,
    currentUser: currentUser,
    ensureReadable: ensureReadable,
    signIn: signIn,
    signOut: signOut,
    listAll: listAll,
    add: add,
    update: update,
    remove: remove,
    members: function (max) { return listAll(cfg.collections.members, { max: max || 3000 }); },
    events: function (max) { return listAll(cfg.collections.events, { orderBy: "ts", order: "desc", max: max || 500 }); },
    points: function (max) { return listAll(cfg.collections.points, { orderBy: "ts", order: "desc", max: max || 3000 }); },
    teachers: function (max) { return listAll(cfg.collections.teachers, { orderBy: "sort", order: "asc", max: max || 500 }); },
    redemptions: function (max) { return listAll(cfg.collections.redemptions, { orderBy: "ts", order: "desc", max: max || 500 }); }
  };
})();
