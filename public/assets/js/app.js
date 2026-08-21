/*
 * app.js — 前端交互：收集表单、实时预览 Lua、客户端加密并下载 config.bin
 * v2：新增 渠道计数徽章 / 语音功能块状态 / 分区导航 scrollspy
 */
(function () {
  'use strict';

  const form = document.getElementById('configForm');
  const preview = document.getElementById('preview');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');
  const copyBinBtn = document.getElementById('copyBinBtn');
  const statusEl = document.getElementById('status');
  const channelCountEl = document.getElementById('channelCount');
  const voiceFeature = document.getElementById('voiceFeature');

  // 通知渠道项（不含独立功能块）
  const channelItems = Array.prototype.slice.call(document.querySelectorAll('.notify-item'));
  const CHANNEL_TOTAL = channelItems.length;

  // ---------- 开关状态同步 ----------
  function syncSwitchStates() {
    channelItems.forEach(function (item) {
      const input = item.querySelector('input[type=checkbox]');
      if (input && input.checked) item.classList.add('on');
      else item.classList.remove('on');
    });
    if (voiceFeature) {
      const input = voiceFeature.querySelector('input[type=checkbox]');
      if (input && input.checked) voiceFeature.classList.add('on');
      else voiceFeature.classList.remove('on');
    }
  }

  // ---------- 渠道计数徽章 ----------
  function updateChannelCount() {
    if (!channelCountEl) return;
    const n = channelItems.filter(function (item) {
      const input = item.querySelector('input[type=checkbox]');
      return input && input.checked;
    }).length;
    channelCountEl.textContent = '已启用 ' + n + ' / ' + CHANNEL_TOTAL;
    channelCountEl.classList.toggle('on', n > 0);
  }

  // ---------- 生成本地 Lua 明文并刷新预览 ----------
  function updatePreview() {
    try {
      const data = ConfigBuilder.collectForm(form);
      const lua = ConfigBuilder.buildLuaConfig(data);
      preview.value = lua;
      showStatus('ok', '已生成预览（' + lua.length + ' 字符）');
    } catch (e) {
      showStatus('err', '生成失败：' + e.message);
    }
  }

  function showStatus(type, msg) {
    statusEl.className = 'status show ' + type;
    statusEl.innerHTML = (type === 'ok'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>')
      + '<span></span>';
    statusEl.querySelector('span').textContent = msg;
  }

  // 节流：输入时延迟刷新预览
  let timer = null;
  function schedulePreview() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(updatePreview, 250);
  }

  // ---------- 下载 config.bin（内容为加密后的 Base64 文本，与原 PHP 行为一致） ----------
  function downloadConfig() {
    try {
      const data = ConfigBuilder.collectForm(form);
      const lua = ConfigBuilder.buildLuaConfig(data);
      const base64 = AirCrypto.encryptConfig(lua);
      const blob = new Blob([base64], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'config.bin';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      showStatus('ok', '已生成 config.bin（' + base64.length + ' 字符密文）');
    } catch (e) {
      showStatus('err', '下载失败：' + e.message);
    }
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { showStatus('ok', okMsg); },
        function () { fallbackCopy(text, okMsg); }
      );
    } else {
      fallbackCopy(text, okMsg);
    }
  }
  function fallbackCopy(text, okMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showStatus('ok', okMsg); }
    catch (e) { showStatus('err', '复制失败，请手动选择'); }
    document.body.removeChild(ta);
  }

  // ---------- 事件绑定 ----------
  form.addEventListener('input', function (e) {
    if (e.target.matches('.notify-item input[type=checkbox], .feature input[type=checkbox]')) {
      syncSwitchStates();
      updateChannelCount();
    }
    schedulePreview();
  });
  form.addEventListener('change', function (e) {
    if (e.target.matches('.notify-item input[type=checkbox], .feature input[type=checkbox]')) {
      syncSwitchStates();
      updateChannelCount();
    }
    schedulePreview();
  });

  downloadBtn.addEventListener('click', downloadConfig);
  copyBtn.addEventListener('click', function () {
    copyText(preview.value, '已复制 Lua 明文到剪贴板');
  });
  copyBinBtn.addEventListener('click', function () {
    try {
      const data = ConfigBuilder.collectForm(form);
      const lua = ConfigBuilder.buildLuaConfig(data);
      const base64 = AirCrypto.encryptConfig(lua);
      copyText(base64, '已复制加密密文到剪贴板');
    } catch (e) {
      showStatus('err', '复制失败：' + e.message);
    }
  });

  // ---------- 顶部推广条关闭 ----------
  const promoClose = document.getElementById('promoClose');
  if (promoClose) promoClose.addEventListener('click', function () {
    const bar = document.getElementById('promo');
    if (bar) bar.style.display = 'none';
  });

  // ---------- 帮助弹窗 ----------
  const helpModal = document.getElementById('helpModal');
  const helpBtn = document.getElementById('helpBtn');
  const helpClose = document.getElementById('helpClose');
  if (helpBtn) helpBtn.addEventListener('click', function () { helpModal.classList.add('show'); });
  if (helpClose) helpClose.addEventListener('click', function () { helpModal.classList.remove('show'); });
  if (helpModal) helpModal.addEventListener('click', function (e) {
    if (e.target === helpModal) helpModal.classList.remove('show');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && helpModal.classList.contains('show')) helpModal.classList.remove('show');
  });

  // ---------- 分区导航 scrollspy ----------
  (function initScrollspy() {
    const chips = Array.prototype.slice.call(document.querySelectorAll('.nav-chip'));
    if (!chips.length || !('IntersectionObserver' in window)) return;
    const sections = chips
      .map(function (c) { return document.getElementById(c.getAttribute('data-sec')); })
      .filter(Boolean);
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        chips.forEach(function (c) {
          c.classList.toggle('active', c.getAttribute('data-sec') === entry.target.id);
        });
      });
    }, { rootMargin: '-140px 0px -55% 0px', threshold: 0 });
    sections.forEach(function (s) { io.observe(s); });
  })();

  // ---------- 初始化 ----------
  syncSwitchStates();
  updateChannelCount();
  updatePreview();
})();
