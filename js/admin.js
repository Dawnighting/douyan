/* =========================================================
   管理端：本地编辑 → 保存时提交到 GitHub
   ========================================================= */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.APP_CONFIG;

  var state = {
    data: null,
    dirty: false,
    editingTeacherId: null,
    token: ""
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtTime(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return (d.getMonth() + 1) + "/" + d.getDate() + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function setDirty(v) {
    state.dirty = v;
    var el = $("save-state");
    el.textContent = v ? "● 有未保存修改" : "已同步";
    el.style.color = v ? "var(--accent-2)" : "var(--muted)";
    if (v) scheduleAutoSave();
  }

  var autoSaveTimer = null;
  var saving = false;

  function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(function () { saveNow(false); }, 2500);
  }

  async function saveNow(showAlert) {
    if (!state.dirty || saving) return;
    saving = true;
    try {
      $("btn-save").disabled = true;
      $("save-state").textContent = "保存中…";
      await Store.saveRemote(state.token, state.data);
      state.dirty = false;
      $("save-state").textContent = "已自动保存";
      $("save-state").style.color = "var(--muted)";
      if (showAlert) alert("已提交到 GitHub，约 1 分钟后线上生效。");
    } catch (ex) {
      $("save-state").textContent = "● 保存失败，请重试";
      $("save-state").style.color = "var(--danger)";
      if (showAlert) alert(ex.message || ex);
    } finally {
      saving = false;
      $("btn-save").disabled = false;
      if (state.dirty && !autoSaveTimer) scheduleAutoSave();
    }
  }

  window.addEventListener("beforeunload", function (e) {
    if (state.dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  function showLogin() {
    $("login-view").hidden = false;
    $("main-view").hidden = true;
  }

  function showMain() {
    $("login-view").hidden = true;
    $("main-view").hidden = false;
    $("admin-user").textContent = "数据仓库：" + cfg.github.owner + "/" + cfg.github.repo;
    renderAll();
  }

  async function enter(token) {
    state.token = token;
    Store.setToken(token);
    state.data = await Store.loadRemote(token);
    setDirty(false);
    showMain();
  }

  async function init() {
    var saved = Store.getToken();
    if (!saved) { showLogin(); return; }
    try {
      await enter(saved);
    } catch (e) {
      console.warn(e);
      showLogin();
    }
  }

  $("login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var err = $("login-err");
    err.hidden = true;
    try {
      await enter($("login-token").value.trim());
    } catch (ex) {
      err.textContent = "进入失败：" + (ex.message || ex);
      err.hidden = false;
    }
  });

  $("btn-logout").addEventListener("click", function () {
    if (state.dirty && !confirm("有未保存的修改，确定退出？")) return;
    Store.setToken("");
    state.token = "";
    state.data = null;
    showLogin();
  });

  $("btn-save").addEventListener("click", async function () {
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
    if (!state.dirty) { alert("没有需要保存的修改。"); return; }
    await saveNow(true);
  });

  function renderAll() {
    renderEventSelect();
    renderMemberDatalist();
    renderEntryList();
    renderMemberRows();
    renderTeacherRows();
    renderRedeemList();
  }

  /* ---------- 赛事 ---------- */
  function renderEventSelect() {
    var sel = $("event-select");
    var prev = sel.value;
    var events = state.data.events.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    sel.innerHTML = "";
    if (events.length === 0) {
      sel.innerHTML = '<option value="">（还没有赛事，请先新建）</option>';
      return;
    }
    events.forEach(function (ev) {
      var opt = document.createElement("option");
      opt.value = ev.id;
      opt.textContent = ev.name + (ev.date ? " · " + ev.date : "");
      sel.appendChild(opt);
    });
    if (prev && events.some(function (ev) { return ev.id === prev; })) sel.value = prev;
    updateCurrentEventLabel();
  }

  function updateCurrentEventLabel() {
    var sel = $("event-select");
    var ev = state.data.events.find(function (e) { return e.id === sel.value; });
    $("current-event-label").textContent = "当前登记赛事：" + (ev ? ev.name : "（未选择）");
  }

  $("btn-create-event").addEventListener("click", function () {
    var name = $("event-name").value.trim();
    if (!name) { alert("请填写赛事名称"); return; }
    var ev = {
      id: uid(),
      name: name,
      type: $("event-type").value,
      date: $("event-date").value || new Date().toISOString().slice(0, 10),
      ts: Date.now()
    };
    state.data.events.push(ev);
    $("event-name").value = "";
    renderEventSelect();
    $("event-select").value = ev.id;
    updateCurrentEventLabel();
    setDirty(true);
  });

  $("event-select").addEventListener("change", updateCurrentEventLabel);

  /* ---------- 积分登记 ---------- */
  function findMember(name) {
    var key = String(name || "").trim().toLowerCase();
    if (!key) return null;
    return state.data.members.find(function (m) {
      return String(m.name || "").trim().toLowerCase() === key ||
        String(m.nickname || "").trim().toLowerCase() === key;
    });
  }

  function addEntry(name, points, reason) {
    name = String(name || "").trim();
    points = parseInt(points, 10);
    if (!name) throw new Error("请填写成员名字");
    if (!Number.isInteger(points) || points === 0) throw new Error("积分需为非 0 整数");
    var evId = $("event-select").value;
    if (!evId) throw new Error("请先选择或新建赛事");
    var ev = state.data.events.find(function (e) { return e.id === evId; });
    var member = findMember(name);
    if (!member) {
      member = { id: uid(), name: name, nickname: "", avatar: "", active: true, ts: Date.now() };
      state.data.members.push(member);
      renderMemberDatalist();
    }
    state.data.points.push({
      id: uid(),
      memberId: member.id,
      memberName: member.name,
      eventId: evId,
      eventName: ev ? ev.name : "",
      points: points,
      reason: reason || "",
      ts: Date.now()
    });
  }

  function quickAdd() {
    try {
      addEntry($("entry-name").value, $("entry-points").value, $("entry-reason").value);
      $("entry-name").value = "";
      $("entry-points").value = "";
      $("entry-reason").value = "";
      $("entry-name").focus();
      renderEntryList();
      renderMemberRows();
      setDirty(true);
    } catch (ex) {
      alert(ex.message || ex);
    }
  }

  $("btn-add-entry").addEventListener("click", quickAdd);
  $("entry-points").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); quickAdd(); }
  });

  $("btn-bulk-import").addEventListener("click", function () {
    var text = $("bulk-text").value.trim();
    if (!text) { alert("请先粘贴要导入的内容"); return; }
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var ok = 0, fail = [];
    lines.forEach(function (line) {
      var parts = line.split(/[\s,，、\t]+/).filter(Boolean);
      if (parts.length < 2) { fail.push(line); return; }
      try {
        addEntry(parts[0], parts[1], parts.slice(2).join(" "));
        ok++;
      } catch (ex) {
        fail.push(line + "（" + (ex.message || ex) + "）");
      }
    });
    $("bulk-text").value = fail.join("\n");
    renderEntryList();
    renderMemberRows();
    if (ok) setDirty(true);
    alert("导入完成：成功 " + ok + " 条" + (fail.length ? "，失败 " + fail.length + " 条（已留在输入框）" : ""));
  });

  function renderEntryList() {
    var list = $("entry-list");
    var rows = state.data.points.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).slice(0, 30);
    if (rows.length === 0) { list.innerHTML = '<p class="empty">暂无登记记录</p>'; return; }
    list.innerHTML = rows.map(function (p) {
      return '<div class="entry-item">' +
        '<span class="who">' + escapeHtml(p.memberName || "") + "</span>" +
        '<span class="pts">' + (p.points > 0 ? "+" : "") + p.points + "</span>" +
        '<span class="grow meta">' + escapeHtml(p.eventName || "") + (p.reason ? " · " + escapeHtml(p.reason) : "") + "</span>" +
        '<span class="meta">' + fmtTime(p.ts) + "</span>" +
        '<button class="btn btn-small btn-danger" data-del="' + p.id + '">删</button>' +
        "</div>";
    }).join("");
    list.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("确定删除这条积分记录？")) return;
        var id = btn.getAttribute("data-del");
        state.data.points = state.data.points.filter(function (p) { return p.id !== id; });
        renderEntryList();
        renderMemberRows();
        setDirty(true);
      });
    });
  }

  /* ---------- 成员 ---------- */
  function renderMemberDatalist() {
    $("member-list").innerHTML = state.data.members.map(function (m) {
      return '<option value="' + escapeHtml(m.name) + '"></option>';
    }).join("");
  }

  function memberTotal(id) {
    return state.data.points.filter(function (p) { return p.memberId === id; })
      .reduce(function (s, p) { return s + (Number(p.points) || 0); }, 0);
  }

  function renderMemberRows() {
    var tbody = $("member-rows");
    if (state.data.members.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="empty">暂无成员</td></tr>'; return; }
    var members = state.data.members.slice().sort(function (a, b) {
      return memberTotal(b.id) - memberTotal(a.id);
    });
    tbody.innerHTML = members.map(function (m) {
      return "<tr><td>" + escapeHtml(m.name) + (m.nickname ? ' <span class="hint">' + escapeHtml(m.nickname) + "</span>" : "") +
        "</td><td>" + memberTotal(m.id) + "</td>" +
        '<td class="actions"><button class="btn btn-small" data-edit="' + m.id + '">编辑</button> ' +
        '<button class="btn btn-small btn-danger" data-del="' + m.id + '">删除</button></td></tr>';
    }).join("");
    tbody.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var m = state.data.members.find(function (x) { return x.id === btn.getAttribute("data-edit"); });
        var name = prompt("成员名字", m.name || "");
        if (name === null) return;
        var nick = prompt("备注名（可空）", m.nickname || "");
        if (nick === null) return;
        var av = prompt("头像图片链接（可空）", m.avatar || "");
        if (av === null) return;
        m.name = name.trim();
        m.nickname = nick.trim();
        m.avatar = av.trim();
        renderMemberRows();
        renderMemberDatalist();
        setDirty(true);
      });
    });
    tbody.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-del");
        var m = state.data.members.find(function (x) { return x.id === id; });
        if (!confirm("删除成员「" + (m ? m.name : "") + "」及其所有积分记录？")) return;
        state.data.members = state.data.members.filter(function (x) { return x.id !== id; });
        state.data.points = state.data.points.filter(function (p) { return p.memberId !== id; });
        renderMemberRows();
        renderMemberDatalist();
        renderEntryList();
        setDirty(true);
      });
    });
  }

  $("btn-add-member").addEventListener("click", function () {
    var name = $("m-name").value.trim();
    if (!name) { alert("请填写成员名字"); return; }
    if (findMember(name)) { alert("已存在同名成员"); return; }
    state.data.members.push({
      id: uid(), name: name,
      nickname: $("m-nick").value.trim(),
      avatar: $("m-avatar").value.trim(),
      active: true, ts: Date.now()
    });
    $("m-name").value = ""; $("m-nick").value = ""; $("m-avatar").value = "";
    renderMemberRows();
    renderMemberDatalist();
    setDirty(true);
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

  $("btn-save-teacher").addEventListener("click", function () {
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
      var t = state.data.teachers.find(function (x) { return x.id === state.editingTeacherId; });
      Object.assign(t, data);
    } else {
      data.id = uid();
      data.ts = Date.now();
      state.data.teachers.push(data);
    }
    resetTeacherForm();
    renderTeacherRows();
    setDirty(true);
  });

  function renderTeacherRows() {
    var tbody = $("teacher-rows");
    if (state.data.teachers.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="empty">暂无老师</td></tr>'; return; }
    tbody.innerHTML = state.data.teachers.map(function (t) {
      return "<tr><td>" + escapeHtml(t.name) + (t.pro ? ' <span class="hint">' + escapeHtml(t.pro) + "签约</span>" : "") +
        "</td><td>" + (t.points || 0) + "</td>" +
        '<td class="actions"><button class="btn btn-small" data-edit="' + t.id + '">编辑</button> ' +
        '<button class="btn btn-small btn-danger" data-del="' + t.id + '">删除</button></td></tr>';
    }).join("");
    tbody.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var t = state.data.teachers.find(function (x) { return x.id === btn.getAttribute("data-edit"); });
        state.editingTeacherId = t.id;
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
      btn.addEventListener("click", function () {
        if (!confirm("确定删除这位老师？")) return;
        var id = btn.getAttribute("data-del");
        state.data.teachers = state.data.teachers.filter(function (t) { return t.id !== id; });
        renderTeacherRows();
        setDirty(true);
      });
    });
  }

  /* ---------- 兑换 ---------- */
  function renderRedeemList() {
    var list = $("redeem-list");
    var rows = state.data.redemptions.filter(function (r) { return r.status === "pending"; });
    if (rows.length === 0) { list.innerHTML = '<p class="empty">暂无待处理的兑换申请</p>'; return; }
    list.innerHTML = rows.map(function (r) {
      return '<div class="entry-item">' +
        '<span class="who">' + escapeHtml(r.memberName || "") + "</span>" +
        '<span class="grow meta">兑换「' + escapeHtml(r.teacherName || "") + "」 · " + (r.points || 0) + " 积分 · " + fmtTime(r.ts) + "</span>" +
        '<button class="btn btn-small btn-primary" data-ok="' + r.id + '">通过</button>' +
        '<button class="btn btn-small" data-no="' + r.id + '">拒绝</button>' +
        "</div>";
    }).join("");
    list.querySelectorAll("[data-ok]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var r = state.data.redemptions.find(function (x) { return x.id === btn.getAttribute("data-ok"); });
        if (!confirm("确认通过并扣除 " + (r.points || 0) + " 积分？")) return;
        state.data.points.push({
          id: uid(),
          memberId: r.memberId,
          memberName: r.memberName,
          eventId: "",
          eventName: "积分兑换",
          points: -(Number(r.points) || 0),
          reason: "兑换教学：" + (r.teacherName || ""),
          ts: Date.now()
        });
        r.status = "approved";
        r.processedAt = new Date().toISOString();
        renderRedeemList();
        renderEntryList();
        renderMemberRows();
        setDirty(true);
      });
    });
    list.querySelectorAll("[data-no]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var r = state.data.redemptions.find(function (x) { return x.id === btn.getAttribute("data-no"); });
        r.status = "rejected";
        r.processedAt = new Date().toISOString();
        renderRedeemList();
        setDirty(true);
      });
    });
  }

  /* ---------- 导出 ---------- */
  $("btn-export").addEventListener("click", function () {
    var data = Object.assign({ exportedAt: new Date().toISOString() }, state.data);
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
