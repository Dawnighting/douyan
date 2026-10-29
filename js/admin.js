/* =========================================================
   管理端逻辑
   ========================================================= */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.APP_CONFIG;
  var C = cfg.collections;

  var state = {
    members: [],
    events: [],
    points: [],
    teachers: [],
    redemptions: [],
    editingTeacherId: null
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtTime(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return d.getMonth() + 1 + "/" + d.getDate() + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  /* ---------- 登录 ---------- */
  function showLogin() {
    $("login-view").hidden = false;
    $("main-view").hidden = true;
  }

  function showMain(user) {
    $("login-view").hidden = true;
    $("main-view").hidden = false;
    $("admin-user").textContent = "已登录：" + (user && (user.username || user.email || user.uid) || "管理员");
    loadAll();
  }

  async function init() {
    TCB.init();
    var user = await TCB.currentUser();
    if (user && user.uid === cfg.adminUid) {
      showMain(user);
    } else {
      if (user) { try { await TCB.signOut(); } catch (e) {} }
      showLogin();
    }
  }

  $("login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var err = $("login-err");
    err.hidden = true;
    try {
      await TCB.signIn($("login-user").value.trim(), $("login-pass").value);
      showMain(await TCB.currentUser());
    } catch (ex) {
      err.textContent = "登录失败：" + (ex.message || ex);
      err.hidden = false;
    }
  });

  $("btn-logout").addEventListener("click", async function () {
    await TCB.signOut();
    showLogin();
  });

  /* ---------- 数据加载 ---------- */
  async function loadAll() {
    try {
      var res = await Promise.all([
        TCB.members(), TCB.events(), TCB.points(), TCB.teachers(), TCB.redemptions()
      ]);
      state.members = res[0] || [];
      state.events = res[1] || [];
      state.points = res[2] || [];
      state.teachers = res[3] || [];
      state.redemptions = res[4] || [];
      renderEventSelect();
      renderMemberDatalist();
      renderEntryList();
      renderMemberRows();
      renderTeacherRows();
      renderRedeemList();
    } catch (ex) {
      alert("数据加载失败：" + (ex.message || ex) + "\n请检查集合是否创建、权限规则是否正确。");
    }
  }

  /* ---------- 赛事 ---------- */
  function renderEventSelect() {
    var sel = $("event-select");
    var prev = sel.value;
    sel.innerHTML = "";
    if (state.events.length === 0) {
      sel.innerHTML = '<option value="">（还没有赛事，请先新建）</option>';
      return;
    }
    state.events.forEach(function (ev) {
      var opt = document.createElement("option");
      opt.value = ev._id;
      opt.textContent = ev.name + (ev.date ? " · " + ev.date : "");
      sel.appendChild(opt);
    });
    if (prev && state.events.some(function (ev) { return ev._id === prev; })) sel.value = prev;
  }

  $("btn-create-event").addEventListener("click", async function () {
    var name = $("event-name").value.trim();
    if (!name) { alert("请填写赛事名称"); return; }
    var date = $("event-date").value || new Date().toISOString().slice(0, 10);
    await TCB.add(C.events, { name: name, type: $("event-type").value, date: date });
    $("event-name").value = "";
    state.events = await TCB.events();
    renderEventSelect();
  });

  /* ---------- 积分登记 ---------- */
  function findMember(name) {
    var key = String(name || "").trim().toLowerCase();
    return state.members.find(function (m) {
      return String(m.name || "").trim().toLowerCase() === key ||
        String(m.nickname || "").trim().toLowerCase() === key;
    });
  }

  async function ensureMember(name) {
    var m = findMember(name);
    if (m) return m;
    var id = await TCB.add(C.members, { name: name.trim(), nickname: "", avatar: "", active: true });
    state.members = await TCB.members();
    renderMemberDatalist();
    return state.members.find(function (x) { return x._id === id; }) || findMember(name);
  }

  async function addEntry(name, points, reason) {
    name = String(name || "").trim();
    points = parseInt(points, 10);
    if (!name) throw new Error("请填写成员名字");
    if (!Number.isInteger(points) || points === 0) throw new Error("积分需为非 0 整数");
    var evId = $("event-select").value;
    if (!evId) throw new Error("请先选择或新建赛事");
    var ev = state.events.find(function (e) { return e._id === evId; });
    var member = await ensureMember(name);
    await TCB.add(C.points, {
      memberId: member._id,
      memberName: member.name,
      eventId: evId,
      eventName: ev ? ev.name : "",
      points: points,
      reason: reason || ""
    });
  }

  async function quickAdd() {
    try {
      await addEntry($("entry-name").value, $("entry-points").value, $("entry-reason").value);
      $("entry-name").value = "";
      $("entry-points").value = "";
      $("entry-reason").value = "";
      $("entry-name").focus();
      state.points = await TCB.points();
      renderEntryList();
      renderMemberRows();
    } catch (ex) {
      alert(ex.message || ex);
    }
  }

  $("btn-add-entry").addEventListener("click", quickAdd);
  $("entry-points").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); quickAdd(); }
  });

  $("btn-bulk-import").addEventListener("click", async function () {
    var text = $("bulk-text").value.trim();
    if (!text) { alert("请先粘贴要导入的内容"); return; }
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var ok = 0, fail = [];
    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].split(/[\s,，、\t]+/).filter(Boolean);
      if (parts.length < 2) { fail.push(lines[i]); continue; }
      try {
        await addEntry(parts[0], parts[1], parts.slice(2).join(" "));
        ok++;
      } catch (ex) {
        fail.push(lines[i] + "（" + (ex.message || ex) + "）");
      }
    }
    $("bulk-text").value = fail.join("\n");
    state.points = await TCB.points();
    renderEntryList();
    renderMemberRows();
    alert("导入完成：成功 " + ok + " 条" + (fail.length ? "，失败 " + fail.length + " 条（已留在输入框）" : ""));
  });

  function renderEntryList() {
    var list = $("entry-list");
    var rows = state.points.slice(0, 30);
    if (rows.length === 0) { list.innerHTML = '<p class="empty">暂无登记记录</p>'; return; }
    list.innerHTML = rows.map(function (p) {
      return '<div class="entry-item">' +
        '<span class="who">' + escapeHtml(p.memberName || "") + "</span>" +
        '<span class="pts">' + (p.points > 0 ? "+" : "") + p.points + "</span>" +
        '<span class="grow meta">' + escapeHtml(p.eventName || "") + (p.reason ? " · " + escapeHtml(p.reason) : "") + "</span>" +
        '<span class="meta">' + fmtTime(p.ts) + "</span>" +
        '<button class="btn btn-small btn-danger" data-del="' + p._id + '">删</button>' +
        "</div>";
    }).join("");
    list.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("确定删除这条积分记录？")) return;
        await TCB.remove(C.points, btn.getAttribute("data-del"));
        state.points = await TCB.points();
        renderEntryList();
        renderMemberRows();
      });
    });
  }

  /* ---------- 成员 ---------- */
  function renderMemberDatalist() {
    $("member-list").innerHTML = state.members.map(function (m) {
      return '<option value="' + escapeHtml(m.name) + '"></option>';
    }).join("");
  }

  function memberTotal(id) {
    return state.points.filter(function (p) { return p.memberId === id; })
      .reduce(function (s, p) { return s + (Number(p.points) || 0); }, 0);
  }

  function renderMemberRows() {
    var tbody = $("member-rows");
    if (state.members.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="empty">暂无成员</td></tr>'; return; }
    tbody.innerHTML = state.members.map(function (m) {
      return "<tr><td>" + escapeHtml(m.name) + (m.nickname ? ' <span class="hint">' + escapeHtml(m.nickname) + "</span>" : "") +
        "</td><td>" + memberTotal(m._id) + "</td>" +
        '<td class="actions"><button class="btn btn-small" data-edit="' + m._id + '">编辑</button> ' +
        '<button class="btn btn-small btn-danger" data-del="' + m._id + '">删除</button></td></tr>';
    }).join("");
    tbody.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var m = state.members.find(function (x) { return x._id === btn.getAttribute("data-edit"); });
        var name = prompt("成员名字", m.name || "");
        if (name === null) return;
        var nick = prompt("备注名（可空）", m.nickname || "");
        if (nick === null) return;
        var av = prompt("头像图片链接（可空）", m.avatar || "");
        if (av === null) return;
        await TCB.update(C.members, m._id, { name: name.trim(), nickname: nick.trim(), avatar: av.trim() });
        state.members = await TCB.members();
        renderMemberRows();
        renderMemberDatalist();
      });
    });
    tbody.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.getAttribute("data-del");
        var m = state.members.find(function (x) { return x._id === id; });
        if (!confirm("删除成员「" + (m ? m.name : "") + "」及其所有积分记录？")) return;
        var rows = state.points.filter(function (p) { return p.memberId === id; });
        for (var i = 0; i < rows.length; i++) await TCB.remove(C.points, rows[i]._id);
        await TCB.remove(C.members, id);
        state.members = await TCB.members();
        state.points = await TCB.points();
        renderMemberRows();
        renderMemberDatalist();
        renderEntryList();
      });
    });
  }

  $("btn-add-member").addEventListener("click", async function () {
    var name = $("m-name").value.trim();
    if (!name) { alert("请填写成员名字"); return; }
    if (findMember(name)) { alert("已存在同名成员"); return; }
    await TCB.add(C.members, { name: name, nickname: $("m-nick").value.trim(), avatar: $("m-avatar").value.trim(), active: true });
    $("m-name").value = ""; $("m-nick").value = ""; $("m-avatar").value = "";
    state.members = await TCB.members();
    renderMemberRows();
    renderMemberDatalist();
  });

  /* ---------- 老师 ---------- */
  function parseChars(text) {
    return text.split(/\r?\n/).map(function (line) {
      var parts = line.trim().split(/[\s,，\t]+/).filter(Boolean);
      if (!parts.length) return null;
      return { name: parts[0], rank: parts.slice(1).join("") || "" };
    }).filter(Boolean);
  }

  function parseTeach(text) {
    return text.split(/[\s,，、\/]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function resetTeacherForm() {
    state.editingTeacherId = null;
    ["t-name", "t-avatar", "t-points", "t-chars", "t-teach", "t-pro", "t-bio"].forEach(function (id) { $(id).value = ""; });
    $("t-mode").value = "经典";
    $("btn-save-teacher").textContent = "保存老师";
  }

  $("btn-reset-teacher").addEventListener("click", resetTeacherForm);

  $("btn-save-teacher").addEventListener("click", async function () {
    var name = $("t-name").value.trim();
    if (!name) { alert("请填写老师名字"); return; }
    var data = {
      name: name,
      avatar: $("t-avatar").value.trim(),
      mode: $("t-mode").value,
      characters: parseChars($("t-chars").value),
      teachingChars: parseTeach($("t-teach").value),
      points: parseInt($("t-points").value, 10) || 0,
      pro: $("t-pro").value.trim(),
      bio: $("t-bio").value.trim(),
      active: true
    };
    if (state.editingTeacherId) {
      await TCB.update(C.teachers, state.editingTeacherId, data);
    } else {
      data.sort = Date.now();
      await TCB.add(C.teachers, data);
    }
    resetTeacherForm();
    state.teachers = await TCB.teachers();
    renderTeacherRows();
  });

  function renderTeacherRows() {
    var tbody = $("teacher-rows");
    if (state.teachers.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="empty">暂无老师</td></tr>'; return; }
    tbody.innerHTML = state.teachers.map(function (t) {
      return "<tr><td>" + escapeHtml(t.name) + (t.pro ? ' <span class="hint">' + escapeHtml(t.pro) + "签约</span>" : "") +
        "</td><td>" + (t.points || 0) + "</td>" +
        '<td class="actions"><button class="btn btn-small" data-edit="' + t._id + '">编辑</button> ' +
        '<button class="btn btn-small btn-danger" data-del="' + t._id + '">删除</button></td></tr>';
    }).join("");
    tbody.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var t = state.teachers.find(function (x) { return x._id === btn.getAttribute("data-edit"); });
        state.editingTeacherId = t._id;
        $("t-name").value = t.name || "";
        $("t-avatar").value = t.avatar || "";
        $("t-mode").value = t.mode || "经典";
        $("t-points").value = t.points != null ? t.points : "";
        $("t-chars").value = (t.characters || []).map(function (c) { return c.name + " " + (c.rank || ""); }).join("\n");
        $("t-teach").value = (t.teachingChars || []).join("，");
        $("t-pro").value = t.pro || "";
        $("t-bio").value = t.bio || "";
        $("btn-save-teacher").textContent = "保存修改";
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    tbody.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("确定删除这位老师？")) return;
        await TCB.remove(C.teachers, btn.getAttribute("data-del"));
        state.teachers = await TCB.teachers();
        renderTeacherRows();
      });
    });
  }

  /* ---------- 兑换 ---------- */
  function renderRedeemList() {
    var list = $("redeem-list");
    var rows = state.redemptions.filter(function (r) { return r.status === "pending"; });
    if (rows.length === 0) { list.innerHTML = '<p class="empty">暂无待处理的兑换申请</p>'; return; }
    list.innerHTML = rows.map(function (r) {
      return '<div class="entry-item">' +
        '<span class="who">' + escapeHtml(r.memberName || "") + "</span>" +
        '<span class="grow meta">兑换「' + escapeHtml(r.teacherName || "") + "」 · " + (r.points || 0) + " 积分 · " + fmtTime(r.ts) + "</span>" +
        '<button class="btn btn-small btn-primary" data-ok="' + r._id + '">通过</button>' +
        '<button class="btn btn-small" data-no="' + r._id + '">拒绝</button>' +
        "</div>";
    }).join("");
    list.querySelectorAll("[data-ok]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var r = state.redemptions.find(function (x) { return x._id === btn.getAttribute("data-ok"); });
        if (!confirm("确认通过并扣除 " + (r.points || 0) + " 积分？")) return;
        await TCB.add(C.points, {
          memberId: r.memberId,
          memberName: r.memberName,
          eventId: "",
          eventName: "积分兑换",
          points: -(Number(r.points) || 0),
          reason: "兑换教学：" + (r.teacherName || "")
        });
        await TCB.update(C.redemptions, r._id, { status: "approved", processedAt: new Date().toISOString() });
        state.redemptions = await TCB.redemptions();
        state.points = await TCB.points();
        renderRedeemList();
        renderEntryList();
        renderMemberRows();
      });
    });
    list.querySelectorAll("[data-no]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.getAttribute("data-no");
        await TCB.update(C.redemptions, id, { status: "rejected", processedAt: new Date().toISOString() });
        state.redemptions = await TCB.redemptions();
        renderRedeemList();
      });
    });
  }

  /* ---------- 导出 ---------- */
  $("btn-export").addEventListener("click", function () {
    var data = {
      exportedAt: new Date().toISOString(),
      envId: cfg.envId,
      members: state.members,
      events: state.events,
      point_entries: state.points,
      teachers: state.teachers,
      redemptions: state.redemptions
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "douyan-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ---------- 选项卡 ---------- */
  document.querySelectorAll("#admin-tabs .tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#admin-tabs .tab-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });
      document.querySelectorAll("#main-view .tab-panel").forEach(function (p) { p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab); });
    });
  });

  init();
})();
