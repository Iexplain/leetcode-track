// github.js — 通过 GitHub Contents API 把编辑后的题目写回仓库
// 仅依赖浏览器 fetch + localStorage，不引入任何第三方库。
(function (global) {
  'use strict';
  var CFG_KEY = 'lc_gh_v1';

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) { return null; }
  }
  function setConfig(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }
  function isConfigured() {
    var c = getConfig();
    return !!(c && c.token && c.owner && c.repo);
  }

  // UTF-8 安全的 base64 编码（题目 JSON 含中文，btoa 不能直接处理）
  function b64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function apiBase(cfg) {
    return 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/';
  }

  // 写回 data/problems/{id}.json：先 GET 拿 SHA，再 PUT。409（SHA 过期）自动重试一次。
  function uploadProblem(id, obj) {
    var cfg = getConfig();
    if (!isConfigured()) return Promise.reject(new Error('GitHub 未配置（缺少 token / owner / repo）'));
    var path = 'data/problems/' + id + '.json';
    var branch = cfg.branch || 'main';
    var url = apiBase(cfg) + path;
    var headers = { 'Authorization': 'Bearer ' + cfg.token, 'Accept': 'application/vnd.github+json' };

    function getSha() {
      return fetch(url + '?ref=' + branch, { headers: headers }).then(function (r) {
        if (r.status === 404) return null; // 文件不存在（理论上不会发生，仅作容错）
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.message || ('获取文件失败 HTTP ' + r.status)); });
        return r.json().then(function (m) { return m.sha || null; });
      });
    }

    function put(sha, attempt) {
      var content = b64(JSON.stringify(obj, null, 2) + '\n');
      var body = { message: '更新 #' + id + ' 解法（来自刷题 PWA 编辑）', content: content, branch: branch };
      if (sha) body.sha = sha;
      return fetch(url, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(body)
      }).then(function (r) {
        if (r.status === 409 && attempt < 1) {
          // SHA 过期（并发改动），重新取 SHA 后重试一次
          return getSha().then(function (newSha) { return put(newSha, attempt + 1); });
        }
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.message || ('上传失败 HTTP ' + r.status)); });
        return r.json();
      });
    }

    return getSha().then(function (sha) { return put(sha, 0); });
  }

  global.GitHub = {
    getConfig: getConfig,
    setConfig: setConfig,
    isConfigured: isConfigured,
    uploadProblem: uploadProblem
  };
})(window);
