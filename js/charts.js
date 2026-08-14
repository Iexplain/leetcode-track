// charts.js — 统计可视化（KPI + Chart.js 图表 + 热力图）
(function (global) {
  'use strict';
  var instances = [];
  var idxCache = null;

  function fetchIndex() {
    if (idxCache) return Promise.resolve(idxCache);
    return fetch('data/index.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) { idxCache = d; return d; });
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function diffColor(d) {
    return d === '简单' ? '#16a34a' : d === '中等' ? '#d97706' : d === '困难' ? '#dc2626' : '#6b7280';
  }

  function destroyAll() {
    instances.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    instances = [];
  }

  function buildKPI(total, solved, streak, todayCount) {
    var pct = total ? Math.round(solved / total * 100) : 0;
    var cards = [
      { label: '题库总数', value: total, color: '#3b82f6' },
      { label: '已做', value: solved, color: '#16a34a' },
      { label: '进度', value: pct + '%', color: '#8b5cf6' },
      { label: '连续打卡', value: streak + ' 天', color: '#f59e0b' },
      { label: '今日已做', value: todayCount, color: '#ec4899' }
    ];
    document.getElementById('kpiRow').innerHTML = cards.map(function (c) {
      return '<div class="kpi" style="border-top:3px solid ' + c.color + '">' +
        '<div class="kpi-val" style="color:' + c.color + '">' + c.value + '</div>' +
        '<div class="kpi-label">' + c.label + '</div></div>';
    }).join('');
  }

  function renderDifficulty(solvedMap, idx) {
    var map = { '简单': 0, '中等': 0, '困难': 0 };
    Object.keys(solvedMap).forEach(function (id) {
      var p = idx.problems.find(function (x) { return String(x.id) === String(id); });
      if (p && map[p.difficulty] != null) map[p.difficulty]++;
    });
    var labels = ['简单', '中等', '困难'];
    var data = labels.map(function (l) { return map[l]; });
    var ctx = document.getElementById('cDiff');
    instances.push(new Chart(ctx, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#16a34a', '#d97706', '#dc2626'], borderWidth: 2, borderColor: '#fff' }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } } }
    }));
  }

  function renderTag(solvedMap, idx) {
    var map = {};
    Object.keys(solvedMap).forEach(function (id) {
      var p = idx.problems.find(function (x) { return String(x.id) === String(id); });
      if (!p) return;
      (p.tags || []).forEach(function (t) { map[t] = (map[t] || 0) + 1; });
    });
    var entries = Object.keys(map).map(function (k) { return [k, map[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    if (entries.length === 0) {
      document.getElementById('cTag').parentElement.innerHTML += '<div class="empty">暂无数据，去做一题吧</div>';
      return;
    }
    var ctx = document.getElementById('cTag');
    instances.push(new Chart(ctx, {
      type: 'bar',
      data: { labels: entries.map(function (e) { return e[0]; }), datasets: [{ label: '已做题数', data: entries.map(function (e) { return e[1]; }), backgroundColor: '#3b82f6', borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { precision: 0, font: { size: 11 } }, grid: { color: '#eef2f7' } }, y: { ticks: { font: { size: 11 } }, grid: { display: false } } } }
    }));
  }

  function renderLast30(checkins) {
    var days = [];
    var labels = [];
    var today = new Date();
    for (var i = 29; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      var key = fmt(d);
      days.push((checkins[key] || []).length);
      labels.push(pad(d.getMonth() + 1) + '-' + pad(d.getDate()));
    }
    var ctx = document.getElementById('c30');
    instances.push(new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: '打卡题数', data: days, backgroundColor: '#10b981', borderRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9 }, maxRotation: 90, minRotation: 45 }, grid: { display: false } }, y: { ticks: { precision: 0, font: { size: 11 } }, grid: { color: '#eef2f7' }, beginAtZero: true } } }
    }));
  }

  function heatColor(n) {
    if (n <= 0) return '#ebedf0';
    if (n === 1) return '#9be9a8';
    if (n <= 3) return '#40c463';
    if (n <= 5) return '#30a14e';
    return '#216e39';
  }

  function renderHeatmap(checkins) {
    var weeks = 12;
    var cells = weeks * 7;
    var today = new Date();
    // 对齐到周末：从 (today - (cells-1)) 开始
    var start = new Date(today);
    start.setDate(start.getDate() - (cells - 1));
    // 调整 start 到本周周日（让列对齐周）
    var dow = start.getDay();
    start.setDate(start.getDate() - dow);

    var html = '<div class="heat-wrap"><div class="heat-grid">';
    var cur = new Date(start);
    var nowStr = fmt(today);
    var cellsCount = weeks * 7;
    for (var i = 0; i < cellsCount; i++) {
      var key = fmt(cur);
      var cnt = (checkins[key] || []).length;
      var future = key > nowStr;
      var cls = future ? 'heat-cell future' : 'heat-cell';
      var title = key + '：' + cnt + ' 题';
      html += '<div class="' + cls + '" style="background:' + (future ? 'transparent' : heatColor(cnt)) + '" title="' + title + '"></div>';
      cur.setDate(cur.getDate() + 1);
    }
    html += '</div>';
    html += '<div class="heat-legend">少<span class="heat-cell" style="background:#ebedf0"></span>' +
      '<span class="heat-cell" style="background:#9be9a8"></span>' +
      '<span class="heat-cell" style="background:#40c463"></span>' +
      '<span class="heat-cell" style="background:#30a14e"></span>' +
      '<span class="heat-cell" style="background:#216e39"></span>多</div>';
    html += '</div>';
    document.getElementById('heat').innerHTML = html;
  }

  function render() {
    destroyAll();
    fetchIndex().then(function (idx) {
      var solvedMap = Store.getAllSolved();
      var checkins = Store.getCheckins();
      var total = idx.problems.length;
      var solved = Store.countSolved();
      var streak = Store.getStreak();
      var todayCount = (checkins[Store.todayStr()] || []).length;

      buildKPI(total, solved, streak, todayCount);
      renderDifficulty(solvedMap, idx);
      renderTag(solvedMap, idx);
      renderLast30(checkins);
      renderHeatmap(checkins);
    }).catch(function (err) {
      document.getElementById('kpiRow').innerHTML = '<div class="err">统计加载失败：' + err.message + '</div>';
    });
  }

  global.Charts = { render: render };
})(window);
