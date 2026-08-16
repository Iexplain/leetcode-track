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
    // 以 1月1日 所在周的「周一」为第 1 列起点（周一在上，符合中文习惯），保证 1月 从最左开始
    var startMonday = new Date(jan1); startMonday.setDate(startMonday.getDate() - ((jan1.getDay() + 6) % 7));
    // 列数：从起点到年末的整周数（ceil，留白到年末那周结束）
    var totalDays = Math.round((dec31 - startMonday) / 86400000) + 1;
    var weeks = Math.ceil(totalDays / 7);

    // 月份标签：每周首日的月份变化时记录一列（仅本年内可见）
    var monthAt = [];
    var lastMonth = -1;
    for (var w = 0; w < weeks; w++) {
      var md = new Date(startMonday); md.setDate(md.getDate() + w * 7);
      var m = md.getMonth();
      var inY = md >= jan1 && md <= dec31;
      monthAt.push(inY && m !== lastMonth ? MONTHS[m] : '');
      lastMonth = m;
    }
    var monthsHtml = monthAt.map(function (t) { return '<span class="gh-month">' + t + '</span>'; }).join('');

    // 单元格：weeks 列 × 7 行（周一在上）
    var cells = '';
    for (var col = 0; col < weeks; col++) {
      for (var row = 0; row < 7; row++) {
        var d = new Date(startMonday); d.setDate(d.getDate() + col * 7 + row);
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

    // 星期标签：一~日 全部显示（周一在上，符合中文习惯）
    var dayLabels = ['一', '二', '三', '四', '五', '六', '日'];
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
      renderHeatmap(checkins);
    }).catch(function (err) {
      document.getElementById('kpiRow').innerHTML = '<div class="err">统计加载失败：' + err.message + '</div>';
    });
  }

  global.Charts = { render: render };
})(window);
