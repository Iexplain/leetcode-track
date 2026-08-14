// store.js — localStorage 数据层（打卡 / 已做记录 / 连续天数 / 导入导出）
(function (global) {
  'use strict';
  var KEY = 'lc-pwa-data-v1';
  var DEFAULT = { checkins: {}, solved: {} };
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
    exportData: exportData, importData: importData, clearAll: clearAll
  };
})(window);
