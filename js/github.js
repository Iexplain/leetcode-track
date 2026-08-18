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
  function b64decode(b64str) {
    var bin = atob(b64str);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function apiBase(cfg) {
    return 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/';
  }

  // 写回题目 JSON：路径支持 {id} 占位替换（默认 data/problems/{id}.json）
  function uploadProblem(id, obj) {
    var cfg = getConfig();
    if (!isConfigured()) return Promise.reject(new Error('GitHub 未配置（缺少 token / owner / repo）'));
    var path = (cfg.filePath || 'data/problems/{id}.json').replace('{id}', String(id));
    var branch = cfg.branch || 'main';
    var url = apiBase(cfg) + path;
    var headers = { 'Authorization': 'Bearer ' + cfg.token, 'Accept': 'application/vnd.github+json' };

    function getSha() {
      return fetch(url + '?ref=' + branch, { headers: headers }).then(function (r) {
        if (r.status === 404) return null;
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
          return getSha().then(function (newSha) { return put(newSha, attempt + 1); });
        }
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.message || ('上传失败 HTTP ' + r.status)); });
        return r.json();
      });
    }

    return getSha().then(function (sha) { return put(sha, 0); });
  }

  // 从仓库拉取 data/index.json，强制刷新本地缓存与索引
  function pullIndex() {
    var cfg = getConfig();
    if (!isConfigured()) return Promise.reject(new Error('GitHub 未配置'));
    var branch = cfg.branch || 'main';
    var url = apiBase(cfg) + 'data/index.json?ref=' + branch;
    var headers = { 'Authorization': 'Bearer ' + cfg.token, 'Accept': 'application/vnd.github+json' };
    return fetch(url, { headers: headers, cache: 'no-store' }).then(function (r) {
      if (r.status === 404) return 0; // 仓库还没有 index.json
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.message || ('拉取失败 HTTP ' + r.status)); });
      return r.json().then(function (m) {
        if (!m.content) return 0;
        // 把仓库内容写进 localStorage 一个独立 key，下次 fetchIndex 优先用
        var text = b64decode(m.content.replace(/\n/g, ''));
        localStorage.setItem('lc_index_remote_v1', text);
        try {
          var arr = JSON.parse(text);
          return Array.isArray(arr.problems) ? arr.problems.length : 0;
        } catch (e) { return 0; }
      });
    });
  }

  global.GitHub = {
    getConfig: getConfig,
    setConfig: setConfig,
    isConfigured: isConfigured,
    uploadProblem: uploadProblem,
    pullIndex: pullIndex
  };
})(window);
