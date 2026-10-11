'use strict';

/* ============================================================
 * 沸点创意 Boiling Point — 渲染进程工作台逻辑（原生 JS，无框架）
 * 所有数据来自 http://localhost:8787 后端 API（已开启 CORS）
 * 原生能力通过 window.bpApi（preload 桥接）调用主进程
 * ============================================================ */

(function () {
  const API = 'http://localhost:8787';
  const bp = window.bpApi || null;

  const state = {
    today: null,
    currentDate: null,
    selectedRank: null,
    reports: [],
    tags: null,
    explodeRank: null,
  };

  /* --------------------------- 工具函数 --------------------------- */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function apiGet(p) {
    return fetch(API + p).then((r) => r.json());
  }
  function apiPost(p, body) {
    return fetch(API + p, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then((r) => r.json());
  }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return escHtml(s).replace(/"/g, '&quot;');
  }
  function fmt(n) {
    if (n == null || isNaN(n)) return '-';
    n = Number(n);
    if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(1) + '万';
    return String(n);
  }
  function gradeColor(level) {
    return { A: '#21c06b', B: '#2f6bff', C: '#ffb020', D: '#e8362b' }[level] || '#8a919f';
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), 2300);
  }
  function setConn(name, text) {
    $('#connLight').className = 'conn-light ' + name;
    $('#connText').textContent = text;
  }

  /* --------------------------- 视图切换 --------------------------- */
  async function showView(v) {
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    $$('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
    if (v === 'trends') loadTrends();
    else if (v === 'tags') loadTags();
    else if (v === 'system') loadSystem();
    else if (v === 'explode') {
      if (!state.today) await loadToday(state.currentDate);
      populateExplode();
    }
  }

  /* --------------------------- 今日看板 --------------------------- */
  function renderAudience(a) {
    $('#audienceSummary').textContent = (a && a.summaryText) || '暂无受众洞察';
    const items = [
      ['样本量', a ? a.sampleSize : '-', ''],
      ['总播放', a ? fmt(a.totalPlay) : '-', 'brand'],
      ['偏好时长', (a && a.preferredDuration) || '-', ''],
      ['偏好形式', (a && a.preferredForm) || '-', ''],
      ['情绪倾向', (a && a.emotionBias) || '-', ''],
      ['平均爆款指数', a && a.avgBoilingScore != null ? a.avgBoilingScore : '-', 'brand'],
    ];
    $('#audienceMetrics').innerHTML = items
      .map(
        ([l, v, c]) =>
          `<div class="metric"><div class="m-label">${l}</div><div class="m-value ${c}">${
            v == null ? '-' : v
          }</div></div>`
      )
      .join('');
  }

  function renderTopicBars(dist) {
    const rows = (dist && dist.topic) || [];
    const box = $('#topicBars');
    if (!rows.length) {
      box.innerHTML = '<div class="muted">暂无数据</div>';
      return;
    }
    const max = Math.max.apply(null, rows.map((r) => r.count || 0).concat([1]));
    box.innerHTML = rows
      .map((r) => {
        const pct = Math.round(((r.count || 0) / max) * 100);
        const share = r.share != null ? Math.round(r.share * 100) : 0;
        return `<div class="bar-row"><div class="bar-name">${escHtml(r.name)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <div class="bar-meta">${r.count} 条 · ${share}% · 均指 ${r.avgScore || '-'}</div></div>`;
      })
      .join('');
  }

  function renderTop(d) {
    const tbody = $('#topBody');
    tbody.innerHTML = '';
    (d.top10 || []).forEach((v) => {
      const tr = document.createElement('tr');
      tr.dataset.rank = v.rank;
      const topic = (v.dimensions && v.dimensions.topic && v.dimensions.topic.primary && v.dimensions.topic.primary.name) || '-';
      const form = (v.dimensions && v.dimensions.craft && v.dimensions.craft.form) || '-';
      const grade = v.grade || {};
      tr.innerHTML = `
        <td class="c-rank"><span class="rank-badge ${v.rank <= 3 ? 'top' : ''}">${v.rank}</span></td>
        <td><div class="title-cell" title="${escAttr(v.title)}">${escHtml(v.title)}</div></td>
        <td>${escHtml(topic)}</td>
        <td>${escHtml(form)}</td>
        <td class="num">${(v.duration || 0)}s</td>
        <td class="num">${fmt(v.stats ? v.stats.play : null)}</td>
        <td class="num"><span class="score-pill">${v.boilingScore != null ? v.boilingScore : '-'}
          <span class="grade-tag" style="background:${gradeColor(grade.level)}">${escHtml(grade.label || '')}</span></span></td>`;
      tr.addEventListener('click', () => selectRank(v.rank));
      tbody.appendChild(tr);
    });
  }

  function dimMetrics(key, dim) {
    const m = (dim && dim.metrics) || {};
    const parts = [];
    if (key === 'copy') {
      if (m.length != null) parts.push(['文案长度', m.length + '字']);
      if (m.lengthBand) parts.push(['篇幅', m.lengthBand]);
      if (m.hook && m.hook.name) parts.push(['钩子', m.hook.name]);
      if (m.emotion && m.emotion.polarity) parts.push(['情绪', m.emotion.polarity]);
      if (m.cta && m.cta.length) parts.push(['CTA', Array.isArray(m.cta) ? m.cta.join('/') : m.cta]);
      if (m.keywords && m.keywords.length)
        parts.push(['关键词', m.keywords.slice(0, 3).map((k) => k.word).join('、')]);
    } else if (key === 'rhythm') {
      if (m.duration != null) parts.push(['时长', m.duration + 's']);
      if (m.durationBand) parts.push(['时长带', m.durationBand]);
      if (m.speed != null) parts.push(['语速', m.speed + '字/秒']);
      if (m.density != null) parts.push(['密度', m.density]);
      parts.push(['结构完整', m.structureComplete ? '是' : '否']);
    } else if (key === 'craft') {
      if (m.form) parts.push(['形式', m.form]);
      if (m.techniques && m.techniques.length) parts.push(['技法', m.techniques.join('、')]);
      if (m.interactions && m.interactions.length) parts.push(['互动', m.interactions.join('、')]);
    } else if (key === 'topic') {
      if (dim.primary && dim.primary.name) parts.push(['主题材', dim.primary.name]);
      if (dim.primary && dim.primary.desc) parts.push(['说明', dim.primary.desc]);
    }
    if (!parts.length) return '';
    return (
      '<div class="kv-mini">' +
      parts
        .map(([k, v]) => `<span><b>${escHtml(k)}</b> ${escHtml(String(v))}</span>`)
        .join('') +
      '</div>'
    );
  }

  const DIM_DEFS = [
    ['topic', '题材', 'topic', '题'],
    ['copy', '文案', 'copy', '案'],
    ['rhythm', '节奏', 'rhythm', '奏'],
    ['craft', '表现手法', 'craft', '法'],
  ];

  function renderBreakdown() {
    const box = $('#breakdown');
    const d = state.today;
    if (!d) return box.classList.add('hidden');
    const v = (d.top10 || []).find((x) => String(x.rank) === String(state.selectedRank));
    if (!v) return box.classList.add('hidden');
    box.classList.remove('hidden');
    box.innerHTML =
      `<div class="dim-grid">` +
      DIM_DEFS.map(([key, name, cls, ico]) => {
        const dim = (v.dimensions && v.dimensions[key]) || {};
        const tags = dim.tags || [];
        const summary = dim.summary || '';
        const chips = tags.length
          ? tags
              .map(
                (t) =>
                  `<span class="chip">${escHtml(t.name)} <span class="conf">${Math.round(
                    (t.confidence || 0) * 100
                  )}%</span></span>`
              )
              .join('')
          : '<span class="muted">—</span>';
        return `<div class="dim dim-${cls}"><div class="dim-head"><span class="dim-ico">${ico}</span><span class="dim-name">${name}</span></div>
          <div class="chips">${chips}</div>
          <div class="dim-summary">${escHtml(summary) || '—'}</div>
          ${dimMetrics(key, dim)}</div>`;
      }).join('') +
      `</div>`;
  }

  function selectRank(rank) {
    $$('#topBody tr').forEach((tr) =>
      tr.classList.toggle('selected', String(tr.dataset.rank) === String(rank))
    );
    state.selectedRank = rank;
    renderBreakdown();
  }

  function renderToday(d) {
    renderAudience(d.audienceInsight || {});
    renderTopicBars(d.distribution);
    renderTop(d);
    state.selectedRank = null;
    $('#breakdown').classList.add('hidden');
  }

  async function loadToday(dateKey) {
    const key = dateKey || state.currentDate;
    setConn('busy', '连接中…');
    try {
      const res = await apiGet('/api/today' + (key ? '?date=' + key : ''));
      if (!res.ok) throw new Error((res.error && res.error.message) || '请求失败');
      setConn('on', '后端已连接');
      $('#todayOffline').classList.add('hidden');
      state.today = res.data;
      state.currentDate = res.data.date || key;
      $('#datePicker').value = state.currentDate || '';
      renderToday(res.data);
    } catch (e) {
      setConn('off', '后端未连接');
      $('#todayOffline').classList.remove('hidden');
      toast('连接后端失败：' + e.message);
    }
  }

  async function doRun() {
    setConn('busy', '抓取中…');
    toast('正在抓取今日数据…');
    try {
      const res = await apiPost('/api/run', { date: state.currentDate || undefined });
      if (!res.ok) throw new Error((res.error && res.error.message) || '抓取失败');
      toast('抓取完成：' + ((res.data && res.data.count) || 0) + ' 条');
      await loadToday((res.data && res.data.date) || state.currentDate);
      if ($('#view-explode').classList.contains('active')) {
        state.today = state.today;
        populateExplode();
      }
    } catch (e) {
      setConn('off', '后端未连接');
      toast('抓取失败：' + e.message);
    }
  }

  async function doExport() {
    if (!state.today || !state.today.markdown) {
      toast('暂无报告可导出，请先抓取');
      return;
    }
    if (!bp) {
      toast('桥接不可用，无法导出');
      return;
    }
    const filename = `沸点创意趋势报告_${(state.today.date || '').replace(/-/g, '')}.md`;
    const r = await bp.invoke('export-report', {
      content: state.today.markdown,
      filename,
    });
    if (r && r.ok) toast('已导出：' + r.path);
    else if (r && r.canceled) toast('已取消导出');
    else toast('导出失败：' + ((r && r.message) || ''));
  }

  /* --------------------------- 爆款拆解 --------------------------- */
  function populateExplode() {
    const sel = $('#explodeSelect');
    const list = (state.today && state.today.top10) || [];
    sel.innerHTML = list
      .map((v) => `<option value="${v.rank}">#${v.rank} ${escHtml(v.title.slice(0, 28))}</option>`)
      .join('');
    if (list.length) {
      const init = state.explodeRank || list[0].rank;
      sel.value = init;
      renderExplodeCard(init);
    } else {
      $('#explodeCard').innerHTML = '<div class="muted">暂无数据，请先到「今日看板」抓取</div>';
    }
  }

  function renderExplodeCard(rank) {
    state.explodeRank = Number(rank);
    const d = state.today;
    if (!d) return;
    const v = (d.top10 || []).find((x) => String(x.rank) === String(rank));
    const box = $('#explodeCard');
    if (!v) {
      box.innerHTML = '<div class="muted">未找到该视频</div>';
      return;
    }
    const st = v.stats || {};
    const grade = v.grade || {};
    const hero = `<div class="explode-hero">
      <div class="explode-rank">${v.rank}</div>
      <div style="flex:1">
        <h2 class="explode-title">${escHtml(v.title)}</h2>
        <div class="explode-sub">${escHtml(v.author || '')} · 粉丝 ${fmt(v.fans)} · 时长 ${v.duration || 0}s · ${escHtml(v.music || '')}</div>
        <div class="explode-stats">
          <div class="es">播放<b>${fmt(st.play)}</b></div>
          <div class="es">点赞<b>${fmt(st.digg)}</b></div>
          <div class="es">评论<b>${fmt(st.comment)}</b></div>
          <div class="es">分享<b>${fmt(st.share)}</b></div>
          <div class="es">收藏<b>${fmt(st.collect)}</b></div>
          <div class="es">爆款指数<b>${v.boilingScore != null ? v.boilingScore : '-'} · ${escHtml(grade.label || '')}</b></div>
        </div>
        ${v.headline ? `<div class="explode-sub" style="margin-top:8px;color:#c23a1f">💡 ${escHtml(v.headline)}</div>` : ''}
      </div>
    </div>`;
    const dims = DIM_DEFS.map(([key, name, cls, ico]) => {
      const dim = (v.dimensions && v.dimensions[key]) || {};
      const tags = dim.tags || [];
      const chips = tags.length
        ? tags
            .map(
              (t) =>
                `<span class="chip">${escHtml(t.name)} <span class="conf">${Math.round(
                  (t.confidence || 0) * 100
                )}%</span></span>`
            )
            .join('')
        : '<span class="muted">—</span>';
      return `<div class="dim dim-${cls}"><div class="dim-head"><span class="dim-ico">${ico}</span><span class="dim-name">${name}</span></div>
        <div class="chips">${chips}</div>
        <div class="dim-summary">${escHtml(dim.summary) || '—'}</div>
        ${dimMetrics(key, dim)}</div>`;
    }).join('');
    const openBtn = v.url
      ? `<button class="btn ghost" id="btnOpenVideo">打开原视频</button>`
      : '';
    box.innerHTML =
      hero +
      `<div class="dim-grid">${dims}</div>` +
      `<div style="margin-top:14px;display:flex;gap:10px">${openBtn}</div>`;
    if (v.url) {
      $('#btnOpenVideo').addEventListener('click', () => {
        if (bp) bp.invoke('open-external', v.url);
        else window.open(v.url, '_blank');
      });
    }
  }

  async function copyBreak() {
    const d = state.today;
    if (!d) return toast('暂无拆解可复制');
    const v = (d.top10 || []).find((x) => String(x.rank) === String(state.explodeRank));
    if (!v) return toast('请先选择一条视频');
    const topic = (v.dimensions && v.dimensions.topic && v.dimensions.topic.primary && v.dimensions.topic.primary.name) || '';
    const text =
      `【爆款拆解 #${v.rank}】${v.title}\n` +
      `题材：${topic}\n` +
      (v.headline ? `亮点：${v.headline}\n` : '') +
      `\n· 题材：${((v.dimensions.topic || {}).summary || '')}\n` +
      `· 文案：${((v.dimensions.copy || {}).summary || '')}\n` +
      `· 节奏：${((v.dimensions.rhythm || {}).summary || '')}\n` +
      `· 表现手法：${((v.dimensions.craft || {}).summary || '')}\n` +
      `\n爆款指数：${v.boilingScore}（${((v.grade || {}).label || '')}）`;
    if (bp) {
      const r = await bp.invoke('copy-text', text);
      toast(r && r.ok ? '已复制拆解结论' : '复制失败');
    } else {
      try {
        navigator.clipboard.writeText(text);
        toast('已复制拆解结论');
      } catch (e) {
        toast('复制失败');
      }
    }
  }

  /* --------------------------- 趋势报告 --------------------------- */
  async function loadTrends() {
    try {
      const res = await apiGet('/api/reports?limit=60');
      state.reports = res.data || [];
    } catch (e) {
      state.reports = [];
    }
    const box = $('#trendsDates');
    if (!state.reports.length) {
      box.innerHTML = '<div class="muted">暂无历史报告</div>';
      $('#trendsMd').innerHTML = '<div class="muted">选择左侧日期查看报告</div>';
      return;
    }
    box.innerHTML = state.reports
      .map(
        (r) =>
          `<div class="date-item" data-date="${r.date}"><div class="d">${r.date}</div>
           <div class="m">均指 ${r.avgBoilingScore != null ? r.avgBoilingScore : '-'} · ${escHtml(
            r.topTopic || ''
          )} · ${r.sampleSize || 0}条</div></div>`
      )
      .join('');
    $$('#trendsDates .date-item').forEach((el) =>
      el.addEventListener('click', () => selectTrendDate(el.dataset.date))
    );
    if (state.reports[0]) selectTrendDate(state.reports[0].date);
  }

  async function selectTrendDate(date) {
    $$('#trendsDates .date-item').forEach((el) =>
      el.classList.toggle('active', el.dataset.date === date)
    );
    try {
      const res = await apiGet('/api/report?date=' + date);
      const md = res.data && res.data.markdown ? res.data.markdown : '';
      $('#trendsMd').innerHTML = md ? renderMarkdown(md) : '<div class="muted">该日期暂无报告内容</div>';
    } catch (e) {
      $('#trendsMd').innerHTML = '<div class="muted">加载失败：' + escHtml(e.message) + '</div>';
    }
  }

  /* --------------------------- 手写 Markdown 渲染 --------------------------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function inlineMd(s) {
    let out = escapeHtml(s);
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return out;
  }
  function splitRow(line) {
    let s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return s.split('|').map((c) => c.trim());
  }
  function renderMarkdown(md) {
    const lines = (md || '').replace(/\r/g, '').split('\n');
    let html = '';
    let i = 0;
    let para = [];
    const flushPara = () => {
      if (para.length) {
        html += '<p>' + para.map(inlineMd).join('<br>') + '</p>';
        para = [];
      }
    };
    while (i < lines.length) {
      const line = lines[i];
      if (/^###\s+/.test(line)) {
        flushPara();
        html += '<h3>' + inlineMd(line.replace(/^###\s+/, '')) + '</h3>';
        i++;
        continue;
      }
      if (/^##\s+/.test(line)) {
        flushPara();
        html += '<h2>' + inlineMd(line.replace(/^##\s+/, '')) + '</h2>';
        i++;
        continue;
      }
      if (/^#\s+/.test(line)) {
        flushPara();
        html += '<h1>' + inlineMd(line.replace(/^#\s+/, '')) + '</h1>';
        i++;
        continue;
      }
      if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
        flushPara();
        html += '<hr>';
        i++;
        continue;
      }
      if (/^>\s?/.test(line)) {
        flushPara();
        const q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          q.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        html += '<blockquote>' + q.map(inlineMd).join('<br>') + '</blockquote>';
        continue;
      }
      if (
        line.includes('|') &&
        i + 1 < lines.length &&
        /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) &&
        lines[i + 1].includes('-')
      ) {
        flushPara();
        const head = splitRow(line);
        i += 2;
        let rows = '';
        while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
          const cells = splitRow(lines[i]);
          rows += '<tr>' + cells.map((c) => '<td>' + inlineMd(c) + '</td>').join('') + '</tr>';
          i++;
        }
        html +=
          '<table><thead><tr>' +
          head.map((c) => '<th>' + inlineMd(c) + '</th>').join('') +
          '</tr></thead><tbody>' +
          rows +
          '</tbody></table>';
        continue;
      }
      if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        flushPara();
        const items = [];
        const ordered = /^\s*\d+\.\s+/.test(line);
        while (
          i < lines.length &&
          (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))
        ) {
          items.push(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ''));
          i++;
        }
        const tag = ordered ? 'ol' : 'ul';
        html += '<' + tag + '>' + items.map((it) => '<li>' + inlineMd(it) + '</li>').join('') + '</' + tag + '>';
        continue;
      }
      if (line.trim() === '') {
        flushPara();
        i++;
        continue;
      }
      para.push(line);
      i++;
    }
    flushPara();
    return html;
  }

  /* --------------------------- 标签体系 --------------------------- */
  const DIM_META = [
    { key: 'topic', name: '题材', color: '#ff5a1f' },
    { key: 'copy', name: '文案', color: '#2f6bff' },
    { key: 'rhythm', name: '节奏', color: '#ffb020' },
    { key: 'craft', name: '表现手法', color: '#e8362b' },
  ];

  async function loadTags() {
    try {
      const res = await apiGet('/api/tags');
      state.tags = res.data || { groups: [] };
    } catch (e) {
      state.tags = { groups: [] };
    }
    renderTags('');
  }

  function renderTags(query) {
    const data = state.tags || { groups: [] };
    const q = (query || '').trim().toLowerCase();
    const box = $('#tagsWrap');
    box.innerHTML = DIM_META.map((dm) => {
      const g = (data.groups || []).find((x) => x.id === dm.key) || {
        id: dm.key,
        name: dm.name,
        tags: [],
      };
      const tags = (g.tags || []).filter((t) => {
        if (!q) return true;
        const hay = (
          t.name +
          ' ' +
          (t.desc || '') +
          ' ' +
          ((t.keywords || []).join(' '))
        ).toLowerCase();
        return hay.includes(q);
      });
      const cards = tags.length
        ? tags
            .map(
              (t) =>
                `<div class="tag-card"><div class="t-name">${escHtml(t.name)}</div>
                 <div class="t-desc">${escHtml(t.desc || '')}</div>
                 <div class="kw-chips">${((t.keywords || []).slice(0, 8))
                   .map((k) => `<span class="kw">${escHtml(k)}</span>`)
                   .join('')}</div></div>`
            )
            .join('')
        : '<div class="muted">无匹配标签</div>';
      return `<div class="tag-group"><div class="tag-group-head"><span class="dot" style="background:${dm.color}"></span>${escHtml(
        g.name || dm.name
      )}（${tags.length}）</div>${cards}</div>`;
    }).join('');
  }

  /* --------------------------- 系统状态 --------------------------- */
  function renderHealth(h) {
    if (!h) {
      $('#healthBox').innerHTML = '<div class="muted">无法连接后端</div>';
      return;
    }
    const rows = [
      ['服务', h.service, ''],
      ['版本', h.version || '-', ''],
      ['服务器时间', (h.time || '').replace('T', ' ').slice(0, 19), ''],
      ['今日日期', h.today || '-', ''],
      ['数据模式', h.dataMode, h.dataMode === 'live' ? 'ok' : 'warn'],
      ['排序指标', h.metric || '-', ''],
      ['TOP N', h.topN != null ? h.topN : '-', ''],
      ['定时(时)', h.cronHour != null ? h.cronHour + ':00' : '-', ''],
      ['真实Key', h.hasLiveKey ? '已配置' : '未配置', h.hasLiveKey ? 'ok' : 'warn'],
      ['最近运行', h.lastRunAt ? (h.lastRunAt || '').replace('T', ' ').slice(0, 19) : '尚未运行', ''],
    ];
    $('#healthBox').innerHTML = rows
      .map(
        ([k, v, c]) =>
          `<div class="kv-row"><span class="k">${k}</span><span class="v ${c}">${escHtml(v)}</span></div>`
      )
      .join('');
  }

  function renderStats(s) {
    if (!s) {
      $('#statsBox').innerHTML = '<div class="muted">无统计</div>';
      return;
    }
    const last = s.lastRun || {};
    const rows = [
      ['已分析天数', s.days != null ? s.days : '-', 'ok'],
      ['累计视频', s.videos != null ? s.videos : '-', ''],
      ['报告数', s.reports != null ? s.reports : '-', ''],
      ['运行次数', s.runs != null ? s.runs : '-', ''],
      ['最近运行日期', last.date_key || '-', ''],
      ['最近状态', last.status || '-', last.status === 'ok' ? 'ok' : 'warn'],
    ];
    $('#statsBox').innerHTML = rows
      .map(
        ([k, v, c]) =>
          `<div class="kv-row"><span class="k">${k}</span><span class="v ${c}">${escHtml(v)}</span></div>`
      )
      .join('');
  }

  async function loadSystem() {
    try {
      const h = await apiGet('/api/health');
      renderHealth(h.data);
    } catch (e) {
      renderHealth(null);
    }
    try {
      const s = await apiGet('/api/stats');
      renderStats(s.data);
    } catch (e) {
      renderStats(null);
    }
    if (bp) {
      const running = await bp.invoke('backend-running');
      updateBackendButtons(Boolean(running));
    }
  }

  function updateBackendButtons(running) {
    $('#btnStartBackend').disabled = running;
    $('#btnStopBackend').disabled = !running;
    $('#btnStartBackend').textContent = running ? '后端运行中' : '启动后端';
  }

  function appendLog(txt, isErr) {
    const pre = $('#backendLog');
    if (!pre) return;
    if (pre.textContent && pre.textContent.indexOf('（未启动）') >= 0) pre.textContent = '';
    pre.textContent += txt;
    pre.scrollTop = pre.scrollHeight;
    if (isErr) pre.style.color = '#ff9b8a';
  }

  /* --------------------------- 事件绑定 --------------------------- */
  function bindEvents() {
    $$('.nav-item').forEach((b) =>
      b.addEventListener('click', () => showView(b.dataset.view))
    );

    $('#datePicker').addEventListener('change', (e) => {
      state.currentDate = e.target.value;
      loadToday(e.target.value);
    });
    $('#btnRun').addEventListener('click', doRun);
    $('#btnExport').addEventListener('click', doExport);
    $('#btnNotify').addEventListener('click', () => {
      if (bp)
        bp.invoke('show-notification', {
          title: '沸点创意',
          body: '今日趋势报告已更新',
        }).then((r) => toast(r && r.ok ? '已发送桌面通知' : '通知失败'));
      else toast('桥接不可用');
    });

    $('#explodeSelect').addEventListener('change', (e) => renderExplodeCard(e.target.value));
    $('#btnCopyBreak').addEventListener('click', copyBreak);

    $('#tagSearch').addEventListener('input', (e) => renderTags(e.target.value));

    $('#btnStartBackend').addEventListener('click', async () => {
      if (!bp) return toast('桥接不可用');
      const r = await bp.invoke('start-backend');
      toast(r && r.ok ? '后端启动中…' : '启动失败：' + ((r && r.message) || ''));
      if (r && r.ok) setTimeout(() => loadSystem(), 1200);
    });
    $('#btnStopBackend').addEventListener('click', async () => {
      if (!bp) return toast('桥接不可用');
      const r = await bp.invoke('stop-backend');
      updateBackendButtons(false);
      toast(r && r.ok ? '已停止后端' : '停止失败');
    });
    $('#btnRefreshSystem').addEventListener('click', loadSystem);

    if (bp) {
      bp.on('backend-status', (running) => updateBackendButtons(Boolean(running)));
      bp.on('backend-log', (txt) => appendLog(txt, false));
      bp.on('backend-error', (txt) => appendLog(txt, true));
      bp.on('action', (a, arg) => {
        if (a === 'export-report') doExport();
        else if (a === 'run-now') doRun();
        else if (a === 'nav') showView(arg);
      });
    }
  }

  /* --------------------------- 启动 --------------------------- */
  async function init() {
    $('#datePicker').value = new Date().toISOString().slice(0, 10);
    state.currentDate = $('#datePicker').value;
    bindEvents();
    await loadToday(state.currentDate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
