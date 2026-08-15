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

  // GitHub 暗色 5 级配色（0 = 空，1-4 = 活跃度递增）
  var GH_GREEN = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
  var MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  function levelOf(n) {
    if (n <= 0) return 0;
    if (n === 1) return 1;
    if (n <= 3) return 2;
    if (n <= 6) return 3;
    return 4;
  }

  function renderHeatmap(checkins) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var year = today.getFullYear();

    // 自然年：[1月1日, 12月31日]
    var jan1 = new Date(year, 0, 1);
    var dec31 = new Date(year, 11, 31);
    // 以 1月1日 所在周的「周日」为第 1 列起点，保证 1月 从最左开始
    var startSunday = new Date(jan1); startSunday.setDate(startSunday.getDate() - jan1.getDay());
    // 列数：从起点到年末的整周数（ceil，留白到年末那周结束）
    var totalDays = Math.round((dec31 - startSunday) / 86400000) + 1;
    var weeks = Math.ceil(totalDays / 7);

    // 月份标签：每周首日的月份变化时记录一列（仅本年内可见）
    var monthAt = [];
    var lastMonth = -1;
    for (var w = 0; w < weeks; w++) {
      var md = new Date(startSunday); md.setDate(md.getDate() + w * 7);
      var m = md.getMonth();
      var inY = md >= jan1 && md <= dec31;
      monthAt.push(inY && m !== lastMonth ? MONTHS[m] : '');
      lastMonth = m;
    }
    var monthsHtml = monthAt.map(function (t) { return '<span class="gh-month">' + t + '</span>'; }).join('');

    // 单元格：weeks 列 × 7 行（周日在上）
    var cells = '';
    for (var col = 0; col < weeks; col++) {
      for (var row = 0; row < 7; row++) {
        var d = new Date(startSunday); d.setDate(d.getDate() + col * 7 + row);
        var key = fmt(d);
        var inYear = d >= jan1 && d <= dec31;       // 是否在本自然年内
        if (!inYear) {
          // 仅年初前的补白 / 年末后的补白：透明空占位
          cells += '<div class="gh-cell out"></div>';
        } else {
          // 本年内：无论过去还是未来，都按打卡数据取 level（未来 = level 0 空格）
          var cnt = (checkins[key] || []).length;
          var lvl = levelOf(cnt);
          cells += '<div class="gh-cell" style="background:' + GH_GREEN[lvl] + '" title="' + key + '：' + cnt + ' 题"></div>';
        }
      }
    }

    // 星期标签：仅一/三/五（GitHub 习惯）
    var dayLabels = ['', '一', '', '三', '', '五', ''];
    var daysHtml = dayLabels.map(function (t) { return '<span class="gh-day">' + t + '</span>'; }).join('');

    var legendCells = GH_GREEN.map(function (c) {
      return '<span class="gh-cell" style="background:' + c + '"></span>';
    }).join('');

    var html =
      '<div class="gh-scroll"><div class="gh-cal" style="--gh-cols:' + weeks + '">' +
        '<div class="gh-top"><div class="gh-spacer"></div><div class="gh-months">' + monthsHtml + '</div></div>' +
        '<div class="gh-main"><div class="gh-days">' + daysHtml + '</div><div class="gh-grid">' + cells + '</div></div>' +
      '</div></div>' +
      '<div class="heat-foot">' +
        '<span></span>' +
        '<span class="heat-legend">少' + legendCells + '多</span>' +
      '</div>';

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
      renderHeatmap(checkins);
    }).catch(function (err) {
      document.getElementById('kpiRow').innerHTML = '<div class="err">统计加载失败：' + err.message + '</div>';
    });
  }

  global.Charts = { render: render };
})(window);
