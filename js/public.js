/* =========================================================
   公开端：积分榜 + 积分教学
   ========================================================= */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.APP_CONFIG;

  var state = {
    members: [],
    events: [],
    points: [],
    teachers: [],
    period: "total",
    keyword: ""
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function avatarHtml(url, name, cls) {
    if (url) return '<div class="' + cls + '"><img src="' + escapeHtml(url) + '" alt=""></div>';
    return '<div class="' + cls + '">' + escapeHtml(String(name || "?").slice(0, 1)) + "</div>";
  }

  function periodStart(period) {
    var d = new Date();
    if (period === "week") {
      var day = d.getDay();            // 0=周日
      var diff = day === 0 ? 6 : day - 1; // 周一为一周开始
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    if (period === "month") {
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    }
    return 0;
  }

  function formatDate(ts) {
    if (!ts) return "日期未知";
    var d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function eventMap() {
    var map = {};
    state.events.forEach(function (event) { map[event.id] = event; });
    return map;
  }

  function scoreGroups(memberId) {
    var events = eventMap();
    var groups = {};
    state.points.forEach(function (point) {
      if (point.memberId !== memberId) return;
      var key = point.eventId || ("name:" + (point.eventName || "unknown"));
      var event = events[point.eventId];
      if (!groups[key]) {
        groups[key] = {
          name: event ? event.name : (point.eventName || "未命名赛事"),
          type: event ? event.type : (point.eventName === "积分兑换" ? "积分扣除" : "其他"),
          date: event && event.date ? event.date : formatDate(point.ts),
          points: 0,
          count: 0,
          reasons: [],
          sortTs: 0
        };
      }
      var group = groups[key];
      group.points += Number(point.points) || 0;
      group.count++;
      group.sortTs = Math.max(group.sortTs, Number(point.ts) || 0, Number(event && event.ts) || 0);
      if (point.reason && group.reasons.indexOf(point.reason) === -1) group.reasons.push(point.reason);
    });
    return Object.keys(groups).map(function (key) { return groups[key]; }).sort(function (a, b) {
      return b.sortTs - a.sortTs;
    });
  }

  function openMemberScores(member) {
    var groups = scoreGroups(member.id);
    var total = groups.reduce(function (sum, group) { return sum + group.points; }, 0);
    var avatar = $("score-avatar");
    avatar.innerHTML = member.avatar
      ? '<img src="' + escapeHtml(member.avatar) + '" alt="">'
      : escapeHtml(String(member.name || "?").slice(0, 1));
    $("score-title").textContent = member.name || "未命名成员";
    $("score-total").textContent = "总积分 " + total + " · 共 " + groups.length + " 场赛事";
    $("score-list").innerHTML = groups.map(function (group) {
      var meta = group.date + " · " + group.type;
      if (group.count > 1) meta += " · " + group.count + " 笔记录";
      if (group.reasons.length) meta += " · " + group.reasons.join("、");
      var pointsClass = group.points < 0 ? "score-event-points negative" : "score-event-points";
      return '<div class="score-event">' +
        '<div class="score-event-main">' +
          '<div class="score-event-name">' + escapeHtml(group.name) + "</div>" +
          '<div class="score-event-meta">' + escapeHtml(meta) + "</div>" +
        "</div>" +
        '<div class="' + pointsClass + '">' + (group.points > 0 ? "+" : "") + group.points + "</div>" +
      "</div>";
    }).join("") || '<p class="empty">暂无积分记录</p>';
    $("score-modal").hidden = false;
  }

  function renderLeaderboard() {
    var list = $("rank-list");
    var start = periodStart(state.period);
    var kw = state.keyword.trim().toLowerCase();

    var map = {};
    state.members.forEach(function (m) {
      map[m.id] = { id: m.id, name: m.name || m.nickname || "未命名", nickname: m.nickname || "", avatar: m.avatar || "", total: 0, period: 0 };
    });

    state.points.forEach(function (p) {
      var row = map[p.memberId];
      if (!row) return;
      var pts = Number(p.points) || 0;
      row.total += pts;
      if ((p.ts || 0) >= start) row.period += pts;
    });

    var rows = Object.keys(map).map(function (k) { return map[k]; }).filter(function (r) {
      if (!kw) return true;
      return (r.name + " " + r.nickname).toLowerCase().indexOf(kw) !== -1;
    });
    rows.sort(function (a, b) { return b.period - a.period || b.total - a.total; });

    if (rows.length === 0) {
      list.innerHTML = '<p class="empty">暂无成员数据</p>';
      return;
    }

    list.innerHTML = rows.map(function (r, i) {
      var rank = i + 1;
      var cls = "rank-row" + (rank === 1 ? " top1" : rank === 2 ? " top2" : rank === 3 ? " top3" : "");
      var sub = r.nickname && r.nickname !== r.name ? escapeHtml(r.nickname) : "";
      return '<div class="' + cls + '" data-member-id="' + escapeHtml(r.id) +
        '" role="button" tabindex="0" aria-label="查看' + escapeHtml(r.name) + '的积分构成">' +
        '<div class="rank-no">' + rank + "</div>" +
        avatarHtml(r.avatar, r.name, "rank-avatar") +
        '<div class="rank-main"><div class="rank-name">' + escapeHtml(r.name) + "</div>" +
        (sub ? '<div class="rank-sub">' + sub + "</div>" : "") + "</div>" +
        '<div class="rank-points"><div class="p">' + r.period + "</div>" +
        '<div class="t">总积分 ' + r.total + "</div></div></div>";
    }).join("");

    list.querySelectorAll(".rank-row").forEach(function (row) {
      var member = map[row.getAttribute("data-member-id")];
      if (!member) return;
      row.addEventListener("click", function () { openMemberScores(member); });
      row.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openMemberScores(member);
      });
    });
  }

  function groupChars(chars) {
    var groups = [];
    var map = {};
    (chars || []).forEach(function (c) {
      var key = c.rank || "";
      if (!map[key]) { map[key] = { rank: key, names: [] }; groups.push(map[key]); }
      map[key].names.push(c.name);
    });
    return groups;
  }

  function renderTeachers() {
    var grid = $("teacher-grid");
    var teachers = state.teachers.filter(function (t) { return t.active !== false; });
    if (teachers.length === 0) {
      grid.innerHTML = '<p class="empty">暂无老师资料</p>';
      return;
    }
    grid.innerHTML = teachers.map(function (t, idx) {
      var groups = groupChars(t.characters);
      var chips = groups.slice(0, 3).map(function (g) {
        var label = g.names.length === 1 ? g.names[0] + " " + g.rank : "多角色" + g.rank;
        return '<span class="chip">' + escapeHtml(label) + "</span>";
      }).join("");
      var extra = groups.length - 3;
      if (extra > 0) chips += '<span class="chip">+' + extra + "</span>";
      var mode = (t.mode || "经典").split("/").map(function (m) {
        m = m.trim();
        return m === "现代" ? '<span class="modern">现代</span>' : escapeHtml(m);
      }).join(" / ");
      return '<div class="teacher-card" data-idx="' + idx + '">' +
        avatarHtml(t.avatar, t.name, "t-avatar") +
        '<div class="t-name">' + escapeHtml(t.name) + "</div>" +
        '<div class="t-mode">' + mode + "</div>" +
        (t.pro ? '<div class="pro-badge">职业选手</div>' : "") +
        '<div class="t-chips">' + chips + "</div>" +
        '<div class="t-price">' + (t.points != null ? t.points + " 积分/小时" : "积分待定") + "</div>" +
        (t.bio ? '<div class="t-bio">' + escapeHtml(t.bio) + "</div>" : "") +
        "</div>";
    }).join("");

    Array.prototype.forEach.call(grid.querySelectorAll(".teacher-card"), function (card) {
      card.addEventListener("click", function () {
        openTeacher(teachers[Number(card.getAttribute("data-idx"))]);
      });
    });
  }

  function openTeacher(t) {
    var box = $("td-avatar");
    box.innerHTML = t.avatar ? '<img src="' + escapeHtml(t.avatar) + '" alt="">' : escapeHtml(String(t.name || "?").slice(0, 1));
    $("td-name").textContent = t.name || "";
    $("td-mode").textContent = "操作模式：" + (t.mode || "经典");
    $("td-pro").innerHTML = t.pro ? '<span class="pro-badge">' + escapeHtml(t.pro) + "签约职业选手</span>" : "";
    $("td-levels").innerHTML = groupChars(t.characters).map(function (g) {
      return '<div class="td-row"><span class="td-rank">' + escapeHtml(g.rank) + '</span><span class="td-names">' + escapeHtml(g.names.join("、")) + "</span></div>";
    }).join("") || '<p class="hint">角色待补充</p>';
    $("td-chars").textContent = (t.teachingChars || []).join("、") || "待补充";
    $("td-price").textContent = t.points != null ? t.points + " 积分 / 小时" : "积分待定";
    $("td-bio").textContent = t.bio || "";
    $("teacher-modal").hidden = false;
  }

  async function load() {
    try {
      var data = await Store.loadPublic();
      state.members = data.members || [];
      state.events = data.events || [];
      state.points = data.points || [];
      state.teachers = data.teachers || [];
      renderLeaderboard();
      renderTeachers();
    } catch (e) {
      console.error(e);
      $("rank-list").innerHTML = '<p class="empty">数据加载失败：' + escapeHtml(e.message || e) + "</p>";
      $("teacher-grid").innerHTML = '<p class="empty">数据加载失败</p>';
    }
  }

  function wire() {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });
        document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab); });
      });
    });

    document.querySelectorAll(".chip-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.period = btn.dataset.period;
        document.querySelectorAll(".chip-tab").forEach(function (b) { b.classList.toggle("active", b === btn); });
        renderLeaderboard();
      });
    });

    $("rank-search").addEventListener("input", function () {
      state.keyword = this.value;
      renderLeaderboard();
    });

    $("score-close").addEventListener("click", function () { $("score-modal").hidden = true; });
    $("score-modal").addEventListener("click", function (e) {
      if (e.target === $("score-modal")) $("score-modal").hidden = true;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        $("score-modal").hidden = true;
        $("teacher-modal").hidden = true;
      }
    });

    $("td-close").addEventListener("click", function () { $("teacher-modal").hidden = true; });
    $("teacher-modal").addEventListener("click", function (e) {
      if (e.target === $("teacher-modal")) $("teacher-modal").hidden = true;
    });
  }

  wire();
  load();
})();
