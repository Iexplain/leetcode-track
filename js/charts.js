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
    return d === '简单' ? '#34d399' : d === '中等' ? '#fbbf24' : d === '困难' ? '#f87171' : '#6b7280';
  }

  function axisText() { return '#9a9aab'; }
  function gridless() { return false; }

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
      data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#34d399', '#fbbf24', '#f87171'], borderWidth: 3, borderColor: '#08080c', hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: true, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { color: axisText(), font: { size: 12 }, padding: 14, usePointStyle: true, pointStyle: 'circle' } } }
      }
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
      data: { labels: entries.map(function (e) { return e[0]; }), datasets: [{ label: '已做题数', data: entries.map(function (e) { return e[1]; }), backgroundColor: '#6366f1', borderRadius: 5, barThickness: 'flex', maxBarThickness: 16 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.x + ' 题'; } } } },
        scales: {
          x: { ticks: { precision: 0, color: axisText(), font: { size: 11 } }, grid: { display: gridless() }, border: { display: false } },
          y: { ticks: { color: axisText(), font: { size: 11 } }, grid: { display: gridless() }, border: { display: false } }
        }
      }
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
    var canvas = document.getElementById('c30');
    var ctx = canvas.getContext('2d');
    // 紫 → 蓝 渐变描边；上方半透明 → 下方透明的渐变填充
    function lineGrad(c) {
      var area = c.chart.chartArea;
      if (!area) return '#8b5cf6';
      var g = ctx.createLinearGradient(area.left, 0, area.right, 0);
      g.addColorStop(0, '#a78bfa'); g.addColorStop(1, '#3b82f6');
      return g;
    }
    function fillGrad(c) {
      var area = c.chart.chartArea;
      if (!area) return 'rgba(139,92,246,0.25)';
      var g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, 'rgba(139,92,246,0.38)');
      g.addColorStop(1, 'rgba(59,130,246,0.02)');
      return g;
    }
    instances.push(new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '打卡题数', data: days,
          fill: true, tension: 0.4, borderWidth: 2.5,
          borderColor: lineGrad, backgroundColor: fillGrad,
          pointRadius: 0, pointHoverRadius: 4,
          pointBackgroundColor: '#a78bfa', pointBorderColor: '#fff', pointBorderWidth: 1
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: false }, tooltip: {
          backgroundColor: 'rgba(8,8,12,0.9)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1,
          titleColor: '#ececf1', bodyColor: '#c4b5fd', padding: 10, displayColors: false,
          callbacks: { label: function (c) { return c.parsed.y + ' 题'; } }
        } },
        scales: {
          x: { ticks: { color: axisText(), font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: gridless() }, border: { display: false } },
          y: { ticks: { precision: 0, color: axisText(), font: { size: 11 } }, grid: { display: gridless() }, border: { display: false }, beginAtZero: true }
        }
      }
    }));
  }

  function heatColor(n) {
    if (n <= 0) return 'rgba(255,255,255,0.07)';
    if (n === 1) return '#1f6f43';
    if (n <= 3) return '#2ea043';
    if (n <= 5) return '#3fb950';
    return '#56d364';
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
    html += '<div class="heat-legend">少<span class="heat-cell" style="background:rgba(255,255,255,0.07)"></span>' +
      '<span class="heat-cell" style="background:#1f6f43"></span>' +
      '<span class="heat-cell" style="background:#2ea043"></span>' +
      '<span class="heat-cell" style="background:#3fb950"></span>' +
      '<span class="heat-cell" style="background:#56d364"></span>多</div>';
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
