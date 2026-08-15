// app.js — 路由与视图渲染（题目列表 / 题目详情 / 统计）
(function () {
  'use strict';
  var app = document.getElementById('app');
  var indexData = null;
  var problemCache = {};
  var state = { search: '', diff: '全部', tag: '全部', onlyUnsolved: false };

  // ---------- 数据加载 ----------
  function fetchIndex() {
    if (indexData) return Promise.resolve(indexData);
    return fetch('data/index.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('无法加载题目列表 data/index.json');
      return r.json();
    }).then(function (d) { indexData = d; return d; });
  }

  function fetchProblem(id) {
    if (problemCache[id]) return Promise.resolve(problemCache[id]);
    return fetch('data/problems/' + id + '.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('题目 ' + id + ' 数据缺失（data/problems/' + id + '.json）');
      return r.json();
    }).then(function (p) { problemCache[id] = p; return p; });
  }

  // ---------- 工具 ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function diffClass(d) {
    return d === '简单' ? 'easy' : d === '中等' ? 'medium' : d === '困难' ? 'hard' : '';
  }
  function $(id) { return document.getElementById(id); }

  // ---------- 解法解锁状态（持久化到 localStorage） ----------
  var UNLOCK_KEY = 'lc_unlocked_v1';
  function getUnlocked(pid) {
    try { return new Set((JSON.parse(localStorage.getItem(UNLOCK_KEY) || '{}')[pid]) || []); }
    catch (e) { return new Set(); }
  }
  function setUnlocked(pid, idx) {
    var all = {};
    try { all = JSON.parse(localStorage.getItem(UNLOCK_KEY) || '{}'); } catch (e) {}
    if (!all[pid]) all[pid] = [];
    if (all[pid].indexOf(idx) < 0) all[pid].push(idx);
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(all));
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function maybeRenderIosHint() {
    if (!isIOS() || isStandalone()) return '';
    if (localStorage.getItem('ios-hint-dismissed') === '1') return '';
    return '<div class="ios-hint" id="iosHint"><div class="ios-hint-body">' +
      '<span class="ios-hint-icon">📲</span>' +
      '<span>在 Safari 中点击 <b>分享</b> 按钮 → 选择 <b>添加到主屏幕</b>，即可像 App 一样离线使用</span>' +
      '<button class="ios-hint-close" id="iosHintClose" aria-label="关闭">✕</button>' +
      '</div></div>';
  }

  // ---------- 路由 ----------
  function router() {
    var hash = location.hash.replace(/^#/, '') || '/';
    var parts = hash.split('/').filter(Boolean);
    if (parts.length === 0 || parts[0] === 'list') return renderList();
    if (parts[0] === 'problem' && parts[1]) return renderProblem(parts[1]);
    if (parts[0] === 'stats') return renderStats();
    return renderList();
  }

  function setNav(active) {
    var links = document.querySelectorAll('.nav a');
    links.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-nav') === active);
    });
  }

  function scrollTop() { window.scrollTo(0, 0); }

  // ---------- 题目列表 ----------
  function renderList() {
    setNav('list');
    app.innerHTML =
      '<div class="page">' +
      maybeRenderIosHint() +
      '<h2>题目列表</h2>' +
      '<div class="toolbar">' +
      '<input id="search" class="search" placeholder="搜索题号 / 标题" value="' + esc(state.search) + '" />' +
      '<div class="chips" id="diffChips"></div>' +
      '<div class="chips" id="tagChips"></div>' +
      '<label class="switch"><input type="checkbox" id="onlyUnsolved" ' + (state.onlyUnsolved ? 'checked' : '') + ' /> 仅未做</label>' +
      '</div>' +
      '<div id="listBody" class="list">加载中…</div>' +
      '</div>';

    // 难度筛选
    var diffBox = $('diffChips');
    ['全部', '简单', '中等', '困难'].forEach(function (d) {
      diffBox.innerHTML += '<button class="chip ' + (state.diff === d ? 'on' : '') + '" data-diff="' + d + '">' + d + '</button>';
    });
    diffBox.addEventListener('click', function (e) {
      var t = e.target.getAttribute('data-diff');
      if (!t) return;
      state.diff = t;
      renderList();
    });

    // 标签筛选
    fetchIndex().then(function (d) {
      var tagSet = {};
      d.problems.forEach(function (p) { (p.tags || []).forEach(function (t) { tagSet[t] = 1; }); });
      var tags = ['全部'].concat(Object.keys(tagSet).sort());
      var tagBox = $('tagChips');
      tagBox.innerHTML = '';
      tags.forEach(function (t) {
        tagBox.innerHTML += '<button class="chip ' + (state.tag === t ? 'on' : '') + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
      });
      tagBox.addEventListener('click', function (e) {
        var t = e.target.getAttribute('data-tag');
        if (!t) return;
        state.tag = t;
        renderList();
      });
      drawList();
    }).catch(function (err) {
      $('listBody').innerHTML = '<div class="err">' + esc(err.message) + '</div>';
    });

    // 搜索 & 仅未做
    $('search').addEventListener('input', function (e) {
      state.search = e.target.value;
      drawList();
    });
    $('onlyUnsolved').addEventListener('change', function (e) {
      state.onlyUnsolved = e.target.checked;
      drawList();
    });

    // iOS 安装提示关闭
    var closeBtn = $('iosHintClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        try { localStorage.setItem('ios-hint-dismissed', '1'); } catch (e) {}
        var el = $('iosHint');
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }
  }

  function drawList() {
    var body = $('listBody');
    if (!body || !indexData) return;
    var q = state.search.trim().toLowerCase();
    var list = indexData.problems.filter(function (p) {
      if (state.diff !== '全部' && p.difficulty !== state.diff) return false;
      if (state.tag !== '全部' && !(p.tags || []).includes(state.tag)) return false;
      if (state.onlyUnsolved && Store.isSolved(p.id)) return false;
      if (q) {
        var hay = (p.id + ' ' + p.title + ' ' + (p.titleEn || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var solved = Store.countSolved();
    var total = indexData.problems.length;
    var head = '<div class="list-meta">共 ' + list.length + ' 题 · 已做 ' + solved + '/' + total +
      ' · 进度 ' + (total ? Math.round(solved / total * 100) : 0) + '%</div>';

    if (list.length === 0) {
      body.innerHTML = head + '<div class="empty">没有匹配的题目</div>';
      return;
    }
    var html = head + list.map(function (p) {
      var done = Store.isSolved(p.id);
      var tags = (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
      return '<a class="card ' + diffClass(p.difficulty) + (done ? ' done' : '') + '" href="#/problem/' + p.id + '">' +
        '<div class="card-top">' +
        '<span class="num">#' + p.id + '</span>' +
        '<span class="diff ' + diffClass(p.difficulty) + '">' + esc(p.difficulty) + '</span>' +
        (done ? '<span class="check">✓</span>' : '') +
        '</div>' +
        '<div class="card-title">' + esc(p.title) + '</div>' +
        '<div class="card-en">' + esc(p.titleEn || '') + '</div>' +
        '<div class="card-tags">' + tags + '</div>' +
        '</a>';
    }).join('');
    body.innerHTML = html;
  }

  // ---------- 题目详情 ----------
  function renderProblem(id) {
    setNav('');
    app.innerHTML = '<div class="page"><a href="#/list" class="back">← 返回列表</a><div id="pBody">加载中…</div></div>';
    fetchProblem(id).then(function (p) {
      renderProblemDetail(p);
    }).catch(function (err) {
      $('pBody').innerHTML = '<div class="err">' + esc(err.message) + '</div>';
    });
  }

  function renderProblemDetail(p) {
    var solved = Store.isSolved(p.id);
    var sInfo = Store.getSolved(p.id) || {};
    var needReview = Store.isReviewScheduled(p.id);

    var examples = (p.examples || []).map(function (ex, i) {
      return '<div class="ex">' +
        '<div class="ex-label">示例 ' + (i + 1) + '</div>' +
        '<div class="ex-line"><b>输入：</b>' + esc(ex.input) + '</div>' +
        '<div class="ex-line"><b>输出：</b>' + esc(ex.output) + '</div>' +
        (ex.explanation ? '<div class="ex-line"><b>解释：</b>' + esc(ex.explanation) + '</div>' : '') +
        '</div>';
    }).join('');

    var constraints = (p.constraints || []).map(function (c) {
      return '<li>' + esc(c) + '</li>';
    }).join('');

    var sols = p.solutions || [];
    var unlockedSet = getUnlocked(p.id);
    var solCards = sols.map(function (s, i) {
      var locked = unlockedSet.has(i) ? '' : ' locked';
      return '<div class="sol-card' + locked + '" data-sol="' + i + '">' +
        '<div class="sol-card-head">' +
          '<span class="sol-lvl ' + diffClass(s.level) + '">' + esc(s.level) + '</span>' +
          '<span class="sol-idx">第 ' + (i + 1) + ' 层 / 共 ' + sols.length + ' 层</span>' +
        '</div>' +
        '<div class="sol-body">' +
          '<div class="idea"><b>核心思想 · </b>' + esc(s.idea) + '</div>' +
          '<div class="code-block">' +
            '<div class="code-wrap">' +
              '<button class="copy" data-code="' + i + '">复制</button>' +
              '<pre class="code"><code>' + esc(s.code) + '</code></pre>' +
            '</div>' +
            '<div class="lock-veil"><button class="unlock-btn" data-sol="' + i + '">查看解答</button></div>' +
          '</div>' +
        '</div>' +
        '</div>';
    }).join('');

    $('pBody').innerHTML =
      '<div class="prob">' +
      '<div class="prob-head">' +
      '<div class="prob-title">' + esc(p.title) + '</div>' +
      '<div class="prob-sub"><span class="num">#' + p.id + '</span> · <span class="diff ' + diffClass(p.difficulty) + '">' + esc(p.difficulty) + '</span> · ' + esc(p.titleEn || '') + '</div>' +
      '<div class="prob-tags">' + (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '</div>' +
      '<div class="desc">' + esc(p.description) + '</div>' +
      (p.ioFormat ? '<div class="iofmt"><b>输入输出格式：</b>' + esc(p.ioFormat) + '</div>' : '') +
      (examples ? '<div class="ex-list">' + examples + '</div>' : '') +
      (constraints ? '<div class="cons"><b>约束：</b><ul>' + constraints + '</ul></div>' : '') +
      '<div class="sol">' +
      '<div class="sol-title">三种解法 <span class="sol-hint">逐层解锁 · 先暴力，后最优</span></div>' +
      solCards +
      '</div>' +
      '<div class="action">' +
      (solved
        ? '<button id="checkinBtn" class="btn btn-done">✓ 已打卡（' + esc(sInfo.level || '完成') + ' · ' + esc(sInfo.date || '') + '）</button>' +
          '<button id="reviewToggle" class="btn ' + (needReview ? 'btn-done' : 'btn-warn') + '">' + (needReview ? '✓ 已设复习计划' : '看题解才懂') + '</button>'
        : '<button id="checkinBtn" class="btn">打卡（我做出来的）</button>' +
          '<button id="reviewMark" class="btn btn-warn">看题解才懂</button>') +
      '<a class="btn btn-ghost" href="#/stats">查看统计</a>' +
      '</div>' +
      '</div>';

    // 解法解锁（毛玻璃遮罩平滑消散）
    var pBody = $('pBody');
    pBody.querySelectorAll('.unlock-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = +btn.getAttribute('data-sol');
        var card = pBody.querySelector('.sol-card[data-sol="' + idx + '"]');
        if (!card) return;
        card.classList.remove('locked');
        card.classList.add('unlocked');
        unlockedSet.add(idx);
        setUnlocked(p.id, idx);
      });
    });

    // 复制代码
    pBody.querySelectorAll('.copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = btn.getAttribute('data-code');
        var code = sols[idx].code;
        var done = function () { btn.textContent = '已复制'; setTimeout(function () { btn.textContent = '复制'; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(done, function () { fallbackCopy(code); done(); });
        } else { fallbackCopy(code); done(); }
      });
    });

    // 打卡（我做出来的）：仅标记已做，不触发复习
    var btn = $('checkinBtn');
    btn.addEventListener('click', function () {
      var level = '';
      for (var li = sols.length - 1; li >= 0; li--) { if (unlockedSet.has(li)) { level = sols[li].level; break; } }
      var wasSolved = Store.isSolved(p.id);
      Store.toggleSolved(p.id, level);
      // 取消已做时，连带移除其复习计划
      if (wasSolved && !Store.isSolved(p.id) && Store.isReviewScheduled(p.id)) {
        Store.cancelReview(p.id);
      }
      renderProblemDetail(p); // 刷新状态
    });

    // 看题解才懂：标记已做 + 启动艾宾浩斯复习计划（+1/+3/+7 天）
    var rm = $('reviewMark');
    if (rm) rm.addEventListener('click', function () {
      var level = '';
      for (var li = sols.length - 1; li >= 0; li--) { if (unlockedSet.has(li)) { level = sols[li].level; break; } }
      Store.toggleSolved(p.id, level);
      Store.markNeedsReview(p.id, { title: p.title, difficulty: p.difficulty });
      renderProblemDetail(p);
    });

    // 已做状态下：切换/取消复习计划
    var rt = $('reviewToggle');
    if (rt) rt.addEventListener('click', function () {
      if (Store.isReviewScheduled(p.id)) {
        if (confirm('取消该题的复习计划？已完成的复习进度将清除。')) {
          Store.cancelReview(p.id);
          renderProblemDetail(p);
        }
      } else {
        Store.markNeedsReview(p.id, { title: p.title, difficulty: p.difficulty });
        renderProblemDetail(p);
      }
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ---------- 今日待复习（艾宾浩斯） ----------
  function reviewModuleHTML() {
    var due = Store.getDueReviews(Store.todayStr());
    var body;
    if (due.length === 0) {
      body = '<div class="review-empty">🎉 今天没有待复习的题目，继续保持！</div>';
    } else {
      body = '<div class="review-list">' + due.map(function (r) {
        return '<div class="review-item">' +
          '<div class="review-meta">' +
            '<span class="r-num">#' + esc(r.pid) + '</span>' +
            '<span class="r-title">' + esc(r.title) + '</span>' +
            '<span class="diff ' + diffClass(r.difficulty) + '">' + esc(r.difficulty) + '</span>' +
          '</div>' +
          '<div class="review-acts">' +
            '<a class="btn btn-ghost r-redo" href="#/problem/' + esc(r.pid) + '">去重刷</a>' +
            '<button class="btn btn-done r-done" data-pid="' + esc(r.pid) + '" data-idx="' + r.pointIndex + '">完成复习</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }
    return '<div class="review-card">' +
      '<div class="review-head">' +
        '<span class="review-title">今日待复习 <span class="review-en">Review Today</span></span>' +
        '<span class="review-count' + (due.length ? ' on' : '') + '">' + due.length + '</span>' +
      '</div>' +
      body +
    '</div>';
  }

  // ---------- 统计 ----------
  function renderStats() {
    setNav('stats');
    app.innerHTML =
      '<div class="page">' +
      '<h2 class="stats-title">打卡统计' +
      '<button class="add-btn" id="backupBtn" aria-label="数据备份">＋</button>' +
      '</h2>' +
      reviewModuleHTML() +
      '<div id="kpiRow" class="kpi-row"></div>' +
      '<div class="grid2">' +
      '<div class="chart-card"><div class="chart-title">难度分布（已做）</div><canvas id="cDiff"></canvas></div>' +
      '<div class="chart-card"><div class="chart-title">标签分布（已做）</div><canvas id="cTag"></canvas></div>' +
      '</div>' +
      '<div class="chart-card"><div class="chart-title">近 30 天打卡数</div><canvas id="c30"></canvas></div>' +
      '<div class="chart-card"><div class="chart-title">近一年打卡热力图</div><div id="heat"></div></div>' +
      '<div class="action-sheet-backdrop" id="backupSheet" hidden>' +
      '<div class="action-sheet">' +
      '<div class="action-sheet-handle"></div>' +
      '<div class="action-sheet-title">数据备份</div>' +
      '<button class="action-sheet-item" data-act="export">⬇︎ 导出全部记录 (JSON)</button>' +
      '<label class="action-sheet-item" data-act="import">⬆︎ 导入 JSON 备份<input type="file" id="fileImport" accept="application/json" hidden /></label>' +
      '<button class="action-sheet-item danger" data-act="clear">🗑 清空全部记录</button>' +
      '<button class="action-sheet-item cancel" data-act="cancel">取消</button>' +
      '</div>' +
      '</div>' +
      '</div>';

    Charts.render();
    // 完成复习：标记当前节点完成并刷新
    app.querySelectorAll('.r-done').forEach(function (b) {
      b.addEventListener('click', function () {
        Store.completeReview(b.getAttribute('data-pid'), parseInt(b.getAttribute('data-idx'), 10));
        renderStats();
      });
    });
    // 统计导航红点
    var badge = $('reviewBadge');
    if (badge) {
      var n = Store.countPendingReviews(Store.todayStr());
      if (n > 0) { badge.textContent = n > 99 ? '99+' : n; badge.hidden = false; }
      else { badge.hidden = true; }
    }
    wireBackup();
  }

  function wireBackup() {
    var btn = $('backupBtn');
    var sheet = $('backupSheet');

    function closeSheet() {
      if (!sheet) return;
      sheet.classList.remove('open');
      setTimeout(function () { sheet.hidden = true; }, 260);
    }
    function openSheet() {
      if (!sheet) return;
      sheet.hidden = false;
      requestAnimationFrame(function () { sheet.classList.add('open'); });
    }

    if (btn) btn.addEventListener('click', openSheet);

    if (sheet) {
      // 点击遮罩空白处关闭
      sheet.addEventListener('click', function (e) {
        if (e.target === sheet) closeSheet();
      });

      var cancel = sheet.querySelector('[data-act="cancel"]');
      if (cancel) cancel.addEventListener('click', closeSheet);

      var exp = sheet.querySelector('[data-act="export"]');
      if (exp) exp.addEventListener('click', function () {
        closeSheet();
        var blob = new Blob([Store.exportData()], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'leetcode-pwa-backup-' + Store.todayStr() + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
      });

      var cle = sheet.querySelector('[data-act="clear"]');
      if (cle) cle.addEventListener('click', function () {
        closeSheet();
        if (confirm('确定清空所有打卡与已做记录吗？此操作不可恢复。')) {
          Store.clearAll();
          renderStats();
        }
      });

      var imp = $('fileImport');
      if (imp) imp.addEventListener('change', function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            Store.importData(r.result);
            alert('导入成功');
            closeSheet();
            renderStats();
          } catch (err) { alert('导入失败：' + err.message); }
        };
        r.readAsText(f);
      });
    }
  }

  // ---------- Service Worker ----------
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.warn('[sw] register failed', e);
      });
    }
  }

  // ---------- 顶部下载按钮：导出备份 ----------
  function exportBackup() {
    try {
      var blob = new Blob([Store.exportData()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'leetcode-pwa-backup-' + Store.todayStr() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    } catch (err) {
      alert('导出失败：' + err.message);
    }
  }
  function setupDownload() {
    var btn = $('installBtn');
    if (!btn) return;
    btn.title = '导出备份';
    btn.addEventListener('click', exportBackup);
  }

  // ---------- 启动 ----------
  window.addEventListener('hashchange', function () { router(); scrollTop(); });
  document.addEventListener('DOMContentLoaded', function () {
    fetchIndex().then(function () { router(); }).catch(function () { router(); });
    registerSW();
    setupDownload();
  });
})();
