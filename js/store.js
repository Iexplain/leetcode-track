// store.js — localStorage 数据层（打卡 / 已做记录 / 连续天数 / 导入导出）
(function (global) {
  'use strict';
  var KEY = 'lc-pwa-data-v1';
  var DEFAULT = { checkins: {}, solved: {}, reviews: {} };
  var cache = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    if (cache) return cache;
    try {
      var raw = localStorage.getItem(KEY);
      cache = raw ? JSON.parse(raw) : clone(DEFAULT);
    } catch (e) {
      console.warn('[store] load failed, reset', e);
      cache = clone(DEFAULT);
    }
    if (!cache.checkins || typeof cache.checkins !== 'object') cache.checkins = {};
    if (!cache.solved || typeof cache.solved !== 'object') cache.solved = {};
    if (!cache.reviews || typeof cache.reviews !== 'object') cache.reviews = {};
    return cache;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {
      console.error('[store] save failed', e);
    }
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return fmt(new Date()); }

  function isSolved(id) {
    return Object.prototype.hasOwnProperty.call(load().solved, String(id));
  }

  function getSolved(id) {
    return load().solved[String(id)] || null;
  }

  // 切换某题的已做状态。level 为当前选中的解法难度（仅记录用）
  function toggleSolved(id, level) {
    var data = load();
    id = String(id);
    var today = todayStr();
    if (data.solved[id]) {
      // 取消已做：移除记录，并从今天的打卡里剔除
      delete data.solved[id];
      var arr = data.checkins[today] || [];
      data.checkins[today] = arr.filter(function (x) { return x !== id; });
      if (data.checkins[today].length === 0) delete data.checkins[today];
    } else {
      data.solved[id] = { date: today, level: level || '' };
      if (!data.checkins[today]) data.checkins[today] = [];
      if (data.checkins[today].indexOf(id) === -1) data.checkins[today].push(id);
    }
    save();
    return data.solved[id];
  }

  function getCheckinsByDate(date) { return load().checkins[date] || []; }

  function getAllSolved() { return load().solved; }
  function getCheckins() { return load().checkins; }
  function countSolved() { return Object.keys(load().solved).length; }

  // 连续打卡天数：从今天（或昨天）往前数，有打卡的连续天数
  function getStreak() {
    var data = load();
    var days = Object.keys(data.checkins).filter(function (d) {
      return (data.checkins[d] || []).length > 0;
    }).sort();
    if (days.length === 0) return 0;

    // 允许「今天」或「昨天」作为连续的起点
    var today = todayStr();
    var last = days[days.length - 1];
    if (last !== today) {
      var y = new Date();
      y.setDate(y.getDate() - 1);
      if (last !== fmt(y)) return 0;
    }

    var set = {};
    days.forEach(function (d) { set[d] = true; });
    var streak = 0;
    var d = new Date(last + 'T00:00:00');
    while (set[fmt(d)]) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  // ---------- 艾宾浩斯复习计划（看题解才懂 → +1/+3/+7 天） ----------
  var REVIEW_OFFSETS = [1, 3, 7];

  // 标记某题需要按遗忘曲线复习。info: { title, difficulty }
  function markNeedsReview(id, info) {
    var data = load();
    id = String(id);
    if (!data.reviews) data.reviews = {};
    var base = todayStr();
    var due = REVIEW_OFFSETS.map(function (n) {
      var dt = new Date(base + 'T00:00:00');
      dt.setDate(dt.getDate() + n);
      return fmt(dt);
    });
    data.reviews[id] = {
      pid: id,
      title: (info && info.title) || ('#' + id),
      difficulty: (info && info.difficulty) || '',
      created: base,
      due: due,
      done: [false, false, false]
    };
    save();
    return data.reviews[id];
  }

  function getReview(id) {
    var r = load().reviews;
    return (r && r[String(id)]) || null;
  }

  function isReviewScheduled(id) {
    return !!getReview(id);
  }

  function cancelReview(id) {
    var data = load();
    if (data.reviews && data.reviews[String(id)]) {
      delete data.reviews[String(id)];
      save();
    }
  }

  // 标记某一个复习节点已完成
  function completeReview(id, idx) {
    var data = load();
    var rec = data.reviews && data.reviews[String(id)];
    if (!rec) return;
    if (idx >= 0 && idx < rec.done.length) rec.done[idx] = true;
    save();
  }

  // 返回某天（含逾期未做）待复习列表：[{ pid, title, difficulty, pointIndex, dueDate }]
  function getDueReviews(dateStr) {
    var revs = load().reviews || {};
    var out = [];
    Object.keys(revs).forEach(function (id) {
      var rec = revs[id];
      for (var i = 0; i < rec.due.length; i++) {
        if (!rec.done[i] && rec.due[i] <= dateStr) {
          out.push({ pid: id, title: rec.title, difficulty: rec.difficulty, pointIndex: i, dueDate: rec.due[i] });
        }
      }
    });
    out.sort(function (a, b) {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      return a.pid < b.pid ? -1 : 1;
    });
    return out;
  }

  function countPendingReviews(dateStr) {
    return getDueReviews(dateStr).length;
  }

  function exportData() { return JSON.stringify(load(), null, 2); }

  function importData(jsonStr) {
    var obj;
    try { obj = JSON.parse(jsonStr); } catch (e) { throw new Error('JSON 解析失败'); }
    if (!obj || typeof obj !== 'object' || !obj.checkins || !obj.solved) {
      throw new Error('数据格式不正确：需包含 checkins 与 solved 两个字段');
    }
    cache = obj;
    save();
  }

  function clearAll() {
    cache = clone(DEFAULT);
    save();
  }

  global.Store = {
    load: load, save: save,
    isSolved: isSolved, getSolved: getSolved, toggleSolved: toggleSolved,
    getCheckinsByDate: getCheckinsByDate, getAllSolved: getAllSolved,
    getCheckins: getCheckins, countSolved: countSolved, getStreak: getStreak,
    todayStr: todayStr, fmt: fmt,
    markNeedsReview: markNeedsReview, getReview: getReview,
    isReviewScheduled: isReviewScheduled, cancelReview: cancelReview,
    completeReview: completeReview, getDueReviews: getDueReviews,
    countPendingReviews: countPendingReviews,
    exportData: exportData, importData: importData, clearAll: clearAll
  };
})(window);
