/**
 * AgentLens — Main Frontend Application
 */

// ─── Global App State ────────────────────────────────────────────────────────
const AppState = {
  currentPage: 'dashboard',
  traces: [],
  currentReport: null,
  currentEvalResult: null,
  graphVisualizer: null,
  activeFilters: { type: '', severity: '', agent: '', source: '' },
  systemMode: 'offline',
};

// ─── Utilities ───────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3800) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function showLoading(msg = 'Analyzing trace…') {
  const ov = document.getElementById('loading-overlay');
  if (ov) {
    ov.querySelector('.loading-msg').textContent = msg;
    ov.classList.add('open');
  }
}
function hideLoading() {
  const ov = document.getElementById('loading-overlay');
  if (ov) ov.classList.remove('open');
}

function navigateTo(page, data = null) {
  AppState.currentPage = page;

  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  const titles = {
    dashboard: '📊 Dashboard',
    upload: '📤 Upload / Paste',
    analysis: '🔬 Analysis View',
    evaluation: '📏 Evaluation',
    about: '📖 About',
  };
  const titleEl = document.getElementById('topbar-page-title');
  if (titleEl) titleEl.textContent = titles[page] || page;

  if (page === 'dashboard') loadDashboard();
  if (page === 'analysis' && data) loadAnalysisView(data);
  if (page === 'evaluation') loadEvaluationPage();
}

function severityBadge(severity) {
  return `<span class="badge badge-${severity}">${severity.toUpperCase()}</span>`;
}
function sourceBadge(src) {
  return `<span class="badge badge-${src}">${src}</span>`;
}
function gradePill(score, grade) {
  return `<span class="score-pill grade-${grade}">${score}/100 <strong>${grade}</strong></span>`;
}
function healthBarColor(score) {
  if (score >= 90) return '#10b981';
  if (score >= 75) return '#0ea5e9';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}
function timeSince(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Theme Toggle ─────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('al-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn(saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('al-theme', next);
  updateThemeBtn(next);
  // Re-render charts if on dashboard
  if (AppState.currentPage === 'dashboard') loadDashboard();
}
function updateThemeBtn(theme) {
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.innerHTML = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
}

// ─── System Health Banner ─────────────────────────────────────────────────────
async function initSystemStatus() {
  try {
    const health = await API.getHealth();
    AppState.systemMode = health.mock_mode ? 'offline' : 'live';
    const el = document.getElementById('system-mode-label');
    if (el) el.textContent = health.mock_mode ? 'MOCK MODE' : `LIVE: ${health.llm_model}`;
    const dot = document.getElementById('status-dot');
    if (dot) dot.style.background = '#10b981';
  } catch {
    const el = document.getElementById('system-mode-label');
    if (el) el.textContent = 'OFFLINE';
  }
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
async function loadDashboard() {
  showLoading('Loading dashboard…');
  try {
    const traces = await API.listTraces();
    AppState.traces = traces;
    renderDashboardStats(traces);
    renderTracesTable(traces);
    renderDashboardCharts(traces);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderDashboardStats(traces) {
  const total = traces.length;
  const totalDefects = traces.reduce((s, t) => s + (t.defect_count || 0), 0);
  const critTraces = traces.filter(t => (t.health_score || 100) < 50).length;
  const avgHealth = total > 0
    ? Math.round(traces.reduce((s, t) => s + (t.health_score || 100), 0) / total)
    : 100;

  document.getElementById('stat-total-traces').textContent = total;
  document.getElementById('stat-total-defects').textContent = totalDefects;
  document.getElementById('stat-critical-traces').textContent = critTraces;
  document.getElementById('stat-avg-health').textContent = avgHealth + '/100';
}

function renderDashboardCharts(traces) {
  // Aggregate counts across all traces
  const typeCounts = {};
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const agentCounts = {};

  traces.forEach(t => {
    // We need detailed data; for dashboard we use available summary
    // These will be loaded per trace if needed; for now just totals from health
  });

  // Empty state for charts if no traces
  if (traces.length === 0) {
    ['chart-types', 'chart-severity', 'chart-agents'].forEach(id => {
      ChartManager.destroy(id);
    });
    return;
  }

  // Default placeholder data based on count  
  const placeholder = { REDUNDANT_LOOP: 0, IGNORED_REQUEST: 0, CONTRADICTION: 0, AMBIGUOUS_INSTRUCTION: 0, PROTOCOL_VIOLATION: 0 };
  ChartManager.renderDefectsByType('chart-types', placeholder);
  ChartManager.renderDefectsBySeverity('chart-severity', severityCounts);
  ChartManager.renderDefectsByAgent('chart-agents', agentCounts);

  // Load detailed data from first trace to populate charts
  if (traces.length > 0) {
    API.getTraceReport(traces[0].id).then(report => {
      ChartManager.renderDefectsByType('chart-types', report.defect_counts_by_type);
      ChartManager.renderDefectsBySeverity('chart-severity', report.defect_counts_by_severity);
      ChartManager.renderDefectsByAgent('chart-agents', report.defect_counts_by_agent);
    }).catch(() => {});
  }
}

function renderTracesTable(traces) {
  const tbody = document.getElementById('traces-tbody');
  if (!tbody) return;

  if (traces.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-icon">🤖</div>
          <div class="empty-text">No traces yet</div>
          <div class="empty-sub">Upload a trace file or generate a demo to get started.</div>
          <div style="margin-top:16px">
            <button class="btn btn-primary" onclick="navigateTo('upload')">📤 Upload Trace</button>
            &nbsp;
            <button class="btn btn-secondary" onclick="handleGenerateDemo()">🎭 Generate Demo</button>
          </div>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = traces.map(t => {
    const score = t.health_score !== null ? t.health_score : '—';
    const grade = t.grade || '—';
    const gradeHtml = (t.health_score !== null)
      ? gradePill(score, grade)
      : `<span class="badge" style="background:var(--bg-surface);color:var(--text-muted)">Not analyzed</span>`;

    return `
    <tr>
      <td><span class="badge" style="background:rgba(99,102,241,0.1);color:#818cf8;border:1px solid rgba(99,102,241,0.3)">#${t.id}</span></td>
      <td>
        <div style="font-weight:600">${escHtml(t.trace_name)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escHtml(t.task.slice(0,60))}…</div>
      </td>
      <td><span style="font-size:13px">${t.agent_count}</span></td>
      <td><span style="font-size:13px">${t.message_count}</span></td>
      <td>
        <span style="font-weight:700;color:${t.defect_count > 0 ? '#f97316' : '#10b981'}">${t.defect_count}</span>
        ${t.has_ground_truth ? '<span class="badge badge-rule" style="margin-left:4px">GT</span>' : ''}
      </td>
      <td>${gradeHtml}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="openTrace(${t.id})">🔬 Analyze</button>
          ${t.has_ground_truth ? `<button class="btn btn-secondary btn-sm" onclick="openEvalForTrace(${t.id})">📏 Eval</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="handleDeleteTrace(${t.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ─── Upload / Paste Page ──────────────────────────────────────────────────────
function initUploadPage() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', async e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) await handleFileUpload(file);
  });

  fileInput.addEventListener('change', async () => {
    if (fileInput.files[0]) await handleFileUpload(fileInput.files[0]);
  });
}

async function handleFileUpload(file) {
  const maxMB = 10;
  if (file.size > maxMB * 1024 * 1024) {
    showToast(`File too large (max ${maxMB} MB).`, 'error'); return;
  }
  showLoading(`Uploading & analyzing "${file.name}"…`);
  try {
    const report = await API.uploadTraceFile(file);
    AppState.currentReport = report;
    showToast(`Trace "${report.trace_name}" analyzed successfully!`, 'success');
    navigateTo('analysis', report);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoading();
  }
}

async function handlePasteSubmit() {
  const text = document.getElementById('paste-textarea').value.trim();
  const name = document.getElementById('paste-name').value.trim() || null;
  const task = document.getElementById('paste-task').value.trim() || null;
  if (!text) { showToast('Please paste a trace before submitting.', 'error'); return; }

  showLoading('Parsing & analyzing pasted trace…');
  try {
    const report = await API.pasteTrace(text, name, task);
    AppState.currentReport = report;
    showToast('Trace analyzed successfully!', 'success');
    navigateTo('analysis', report);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoading();
  }
}

async function handleGenerateDemo(clean = false) {
  showLoading(clean ? 'Generating clean demo trace…' : 'Generating defect-injected demo trace…');
  try {
    const report = await API.generateDemoTrace({ clean });
    AppState.currentReport = report;
    showToast(`Demo trace "${report.trace_name}" generated!`, 'success');
    navigateTo('analysis', report);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ─── Analysis View Page ────────────────────────────────────────────────────────
async function openTrace(traceId) {
  showLoading('Loading trace report…');
  try {
    const report = await API.getTraceReport(traceId);
    AppState.currentReport = report;
    navigateTo('analysis', report);
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoading();
  }
}

function loadAnalysisView(report) {
  // Populate header
  document.getElementById('analysis-trace-name').textContent = report.trace_name;
  document.getElementById('analysis-task').textContent = report.task;
  document.getElementById('analysis-trace-id').textContent = `#${report.trace_id}`;
  document.getElementById('analysis-msg-count').textContent = report.messages.length;
  document.getElementById('analysis-agent-count').textContent = report.agents.length;
  document.getElementById('analysis-defect-count').textContent = report.defects.length;

  // Health score gauge
  const score = report.health.health_score;
  const grade = report.health.grade;
  const gaugeEl = document.getElementById('health-gauge');
  if (gaugeEl) {
    gaugeEl.style.background = healthBarColor(score);
    gaugeEl.textContent = score;
  }
  const gradeEl = document.getElementById('health-grade-label');
  if (gradeEl) gradeEl.textContent = `Grade ${grade} — ${report.health.formula_summary}`;

  // Render network graph
  renderGraph(report);

  // Populate filter dropdowns
  populateFilterOptions(report);

  // Render message timeline
  renderTimeline(report, AppState.activeFilters);

  // Export button
  document.getElementById('btn-export-json').onclick = () => window.open(API.getExportUrl(report.trace_id, 'json'));
  document.getElementById('btn-export-csv').onclick = () => window.open(API.getExportUrl(report.trace_id, 'csv'));
  document.getElementById('btn-export-html').onclick = () => window.open(API.getExportUrl(report.trace_id, 'pdf-ready-html'));

  // Re-analyze button
  document.getElementById('btn-reanalyze').onclick = () => reanalyzeTrace(report.trace_id);

  // Show eval button if ground truth
  const evalBtn = document.getElementById('btn-run-eval');
  if (evalBtn) {
    evalBtn.style.display = report.has_ground_truth ? 'inline-flex' : 'none';
    evalBtn.onclick = () => openEvalForTrace(report.trace_id);
  }
}

function renderGraph(report) {
  if (!AppState.graphVisualizer) {
    AppState.graphVisualizer = new AgentGraphVisualizer('graph-container');
    AppState.graphVisualizer.setCallbacks(
      node => showNodeDetail(node, report),
      edge => showEdgeDetail(edge, report)
    );
  }
  AppState.graphVisualizer.render(report.graph);

  // Graph toolbar bindings
  document.getElementById('btn-fit-graph').onclick = () => AppState.graphVisualizer.fit();
  document.getElementById('btn-zoom-in').onclick = () => AppState.graphVisualizer.zoomIn();
  document.getElementById('btn-zoom-out').onclick = () => AppState.graphVisualizer.zoomOut();
  document.getElementById('btn-toggle-physics').onclick = () => AppState.graphVisualizer.togglePhysics();
}

function showNodeDetail(node, report) {
  if (!node) return;
  const defects = report.defects.filter(d => d.agents.includes(node.id));
  const content = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Role</div>
        <div style="font-size:14px;font-weight:500">${escHtml(node.role)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div style="text-align:center;background:var(--bg-surface);padding:10px;border-radius:8px">
          <div style="font-size:20px;font-weight:800">${node.sent_count}</div>
          <div style="font-size:11px;color:var(--text-muted)">Sent</div>
        </div>
        <div style="text-align:center;background:var(--bg-surface);padding:10px;border-radius:8px">
          <div style="font-size:20px;font-weight:800">${node.received_count}</div>
          <div style="font-size:11px;color:var(--text-muted)">Received</div>
        </div>
        <div style="text-align:center;background:var(--bg-surface);padding:10px;border-radius:8px">
          <div style="font-size:20px;font-weight:800;color:${node.defect_count > 0 ? '#ef4444' : '#10b981'}">${node.defect_count}</div>
          <div style="font-size:11px;color:var(--text-muted)">Defects</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--text-muted)">Betweenness: <strong>${node.betweenness}</strong></span>
        <span style="font-size:12px;color:var(--text-muted)">Degree: <strong>${node.degree_centrality}</strong></span>
        ${node.is_bottleneck ? '<span class="badge badge-high">Bottleneck</span>' : ''}
        ${node.is_isolated ? '<span class="badge badge-medium">Isolated</span>' : ''}
      </div>
      ${defects.length > 0 ? `
      <div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">ASSOCIATED DEFECTS</div>
        ${defects.slice(0,3).map(d => `
          <div style="background:var(--bg-surface);border-radius:6px;padding:10px;margin-bottom:6px;cursor:pointer;border:1px solid var(--border-color)"
               onclick="openDefectDrawer(${JSON.stringify(d).replace(/"/g, '&quot;')})">
            ${severityBadge(d.severity)} ${sourceBadge(d.detected_by)}
            <div style="font-size:12px;margin-top:6px;font-weight:600">${d.type.replace(/_/g,' ')}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">${escHtml(d.explanation.slice(0,90))}…</div>
          </div>
        `).join('')}
      </div>` : ''}
    </div>`;
  showDrawerGeneric(`Agent: ${node.label.split('\n')[0]}`, content);
}

function showEdgeDetail(edge, report) {
  if (!edge) return;
  const msgs = report.messages.filter(m => edge.message_ids.includes(m.id));
  const content = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600">
        <span style="color:var(--accent-primary)">${escHtml(edge.from_node)}</span>
        <span>→</span>
        <span style="color:var(--accent-secondary)">${escHtml(edge.to_node)}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="background:var(--bg-surface);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:20px;font-weight:800">${edge.count}</div>
          <div style="font-size:11px;color:var(--text-muted)">Messages</div>
        </div>
        <div style="background:var(--bg-surface);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:${edge.defect_count > 0 ? '#ef4444' : '#10b981'}">${edge.defect_count}</div>
          <div style="font-size:11px;color:var(--text-muted)">Defects</div>
        </div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">MESSAGES ON THIS EDGE</div>
        ${msgs.slice(0, 5).map(m => `
          <div style="background:var(--bg-surface);padding:10px;border-radius:6px;margin-bottom:6px;border:1px solid var(--border-color)">
            <div style="font-size:11px;color:var(--text-muted)">Msg #${m.id} · ${escHtml(m.timestamp||'')}</div>
            <div style="font-size:12px;margin-top:4px">${escHtml(m.content.slice(0,100))}…</div>
          </div>
        `).join('')}
      </div>
    </div>`;
  showDrawerGeneric(`Edge: ${edge.from_node} → ${edge.to_node}`, content);
}

function showDrawerGeneric(title, contentHtml) {
  document.getElementById('drawer-title').textContent = title;
  document.getElementById('drawer-body').innerHTML = contentHtml;
  document.getElementById('defect-drawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('defect-drawer').classList.remove('open');
}

function openDefectDrawer(defect) {
  const sev = defect.severity || '';
  const content = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
      ${severityBadge(sev)} ${sourceBadge(defect.detected_by)} 
      <span class="badge" style="background:var(--bg-surface);color:var(--text-secondary);border:1px solid var(--border-color)">
        Confidence: ${Math.round((defect.confidence||0)*100)}%
      </span>
    </div>
    <div>
      <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">📋 Explanation</div>
      <p style="font-size:13px;line-height:1.6">${escHtml(defect.explanation)}</p>
    </div>
    ${defect.evidence_quote ? `
    <div>
      <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">🔍 Evidence</div>
      <div class="quote-box">"${escHtml(defect.evidence_quote)}"</div>
    </div>` : ''}
    <div>
      <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">🔧 Suggested Fix</div>
      <div class="fix-box"><strong>Recommendation:</strong>${escHtml(defect.suggested_fix)}</div>
    </div>
    ${defect.message_ids && defect.message_ids.length ? `
    <div style="font-size:12px;color:var(--text-muted)">
      Affected messages: ${defect.message_ids.map(id => `<strong>#${id}</strong>`).join(', ')}
    </div>` : ''}
    ${defect.agents && defect.agents.length ? `
    <div style="font-size:12px;color:var(--text-muted)">
      Agents involved: ${defect.agents.map(a => `<span class="msg-agent">${escHtml(a)}</span>`).join(' ')}
    </div>` : ''}`;

  showDrawerGeneric(`⚠️ ${(defect.type||'').replace(/_/g, ' ')}`, content);
}

// ─── Timeline Renderer ────────────────────────────────────────────────────────
function populateFilterOptions(report) {
  const typeSelect = document.getElementById('filter-type');
  const agentSelect = document.getElementById('filter-agent');

  if (typeSelect) {
    const types = [...new Set(report.defects.map(d => d.type))];
    typeSelect.innerHTML = `<option value="">All Types</option>` +
      types.map(t => `<option value="${t}">${t.replace(/_/g,' ')}</option>`).join('');
  }
  if (agentSelect) {
    agentSelect.innerHTML = `<option value="">All Agents</option>` +
      report.agents.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
  }
}

function renderTimeline(report, filters = {}) {
  const wrapper = document.getElementById('timeline-wrapper');
  if (!wrapper) return;

  // Build defect map per message
  const defectMap = {};
  report.defects.forEach(d => {
    d.message_ids.forEach(mid => {
      if (!defectMap[mid]) defectMap[mid] = [];
      defectMap[mid].push(d);
    });
  });

  let msgs = report.messages;

  // Apply filters
  if (filters.agent) {
    msgs = msgs.filter(m => m.sender === filters.agent || m.receiver === filters.agent);
  }
  if (filters.type || filters.severity || filters.source) {
    const defectMsgIds = new Set();
    report.defects
      .filter(d => {
        let ok = true;
        if (filters.type && d.type !== filters.type) ok = false;
        if (filters.severity && d.severity !== filters.severity) ok = false;
        if (filters.source && d.detected_by !== filters.source) ok = false;
        return ok;
      })
      .forEach(d => d.message_ids.forEach(id => defectMsgIds.add(id)));
    msgs = msgs.filter(m => defectMsgIds.has(m.id));
  }

  if (msgs.length === 0) {
    wrapper.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">No messages match filters</div></div>`;
    return;
  }

  wrapper.innerHTML = msgs.map(msg => {
    const msgDefects = defectMap[msg.id] || [];
    const hasDefect = msgDefects.length > 0;
    const maxSev = msgDefects.reduce((s, d) => {
      const order = { critical: 4, high: 3, medium: 2, low: 1 };
      return (order[d.severity] || 0) > (order[s] || 0) ? d.severity : s;
    }, '');

    const defectBadges = msgDefects.slice(0, 4).map(d => `
      <span class="badge badge-${d.severity} clickable-defect-badge"
        onclick='openDefectDrawer(${JSON.stringify(d).replace(/'/g,"&#39;")})'
        title="${escHtml(d.explanation.slice(0,80))}">
        ${d.type.replace(/_/g,' ')}
      </span>
    `).join('');

    return `
    <div class="timeline-message ${hasDefect ? 'has-defect' + (maxSev === 'critical' ? ' critical' : '') : ''}">
      <div class="msg-meta">
        <div class="msg-sender-receiver">
          <span class="badge" style="font-size:10px;color:var(--text-muted);background:var(--bg-surface);border:1px solid var(--border-color)">#${msg.id}</span>
          <span class="msg-agent">${escHtml(msg.sender)}</span>
          <span style="color:var(--text-muted)">→</span>
          <span class="msg-agent" style="background:rgba(6,182,212,0.1);color:#06b6d4">${escHtml(msg.receiver)}</span>
        </div>
        <span class="msg-time">${escHtml(msg.timestamp || '')}</span>
      </div>
      <div class="msg-content">${escHtml(msg.content)}</div>
      ${hasDefect ? `<div class="msg-defect-badges">${defectBadges}</div>` : ''}
    </div>`;
  }).join('');
}

function applyFilters() {
  if (!AppState.currentReport) return;
  AppState.activeFilters = {
    type: document.getElementById('filter-type')?.value || '',
    severity: document.getElementById('filter-severity')?.value || '',
    agent: document.getElementById('filter-agent')?.value || '',
    source: document.getElementById('filter-source')?.value || '',
  };
  renderTimeline(AppState.currentReport, AppState.activeFilters);
}

function clearFilters() {
  ['filter-type','filter-severity','filter-agent','filter-source'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  AppState.activeFilters = { type: '', severity: '', agent: '', source: '' };
  if (AppState.currentReport) renderTimeline(AppState.currentReport, {});
}

async function reanalyzeTrace(traceId) {
  showLoading('Re-running detection pipeline…');
  try {
    const report = await API.reanalyzeTrace(traceId);
    AppState.currentReport = report;
    loadAnalysisView(report);
    showToast('Re-analysis complete!', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ─── Evaluation Page ──────────────────────────────────────────────────────────
async function loadEvaluationPage() {
  const traces = AppState.traces.length > 0 ? AppState.traces : await API.listTraces();
  AppState.traces = traces;

  const gtTraces = traces.filter(t => t.has_ground_truth);
  const select = document.getElementById('eval-trace-select');
  if (select) {
    select.innerHTML = `<option value="">— Select a trace with ground truth —</option>` +
      gtTraces.map(t => `<option value="${t.id}">#${t.id} — ${escHtml(t.trace_name)}</option>`).join('');
  }

  // Pre-select if we came from a specific trace
  if (AppState.currentReport && AppState.currentReport.has_ground_truth) {
    if (select) select.value = AppState.currentReport.trace_id;
  }
}

async function openEvalForTrace(traceId) {
  navigateTo('evaluation');
  await loadEvaluationPage();
  const select = document.getElementById('eval-trace-select');
  if (select) select.value = traceId;
  await runEvaluation();
}

async function runEvaluation() {
  const traceId = parseInt(document.getElementById('eval-trace-select')?.value);
  if (!traceId) { showToast('Please select a trace with ground truth first.', 'error'); return; }

  showLoading('Evaluating detection accuracy…');
  try {
    const result = await API.evaluateTrace(traceId);
    AppState.currentEvalResult = result;
    renderEvaluationResults(result);
  } catch (e) {
    showToast(e.message, 'error');
    document.getElementById('eval-results-section').style.display = 'none';
  } finally {
    hideLoading();
  }
}

function renderEvaluationResults(result) {
  document.getElementById('eval-results-section').style.display = 'block';

  // Overall metrics
  document.getElementById('eval-precision').textContent = (result.overall_precision * 100).toFixed(1) + '%';
  document.getElementById('eval-recall').textContent = (result.overall_recall * 100).toFixed(1) + '%';
  document.getElementById('eval-f1').textContent = (result.overall_f1 * 100).toFixed(1) + '%';
  document.getElementById('eval-tp').textContent = result.total_true_positives;
  document.getElementById('eval-fp').textContent = result.total_false_positives;
  document.getElementById('eval-fn').textContent = result.total_false_negatives;

  // Per-type table
  const tbody = document.getElementById('eval-per-type-tbody');
  if (tbody) {
    tbody.innerHTML = result.per_type_metrics
      .filter(m => m.ground_truth_count > 0 || m.detected_count > 0)
      .map(m => `
      <tr>
        <td><span class="badge badge-medium" style="font-size:10px">${m.defect_type.replace(/_/g,' ')}</span></td>
        <td style="text-align:center">${m.ground_truth_count}</td>
        <td style="text-align:center">${m.detected_count}</td>
        <td style="text-align:center"><strong style="color:#10b981">${m.true_positives}</strong></td>
        <td style="text-align:center"><strong style="color:#ef4444">${m.false_positives}</strong></td>
        <td style="text-align:center"><strong style="color:#f97316">${m.false_negatives}</strong></td>
        <td style="text-align:center">${(m.precision*100).toFixed(0)}%</td>
        <td style="text-align:center">${(m.recall*100).toFixed(0)}%</td>
        <td style="text-align:center;font-weight:700;color:${m.f1_score >= 0.7 ? '#10b981' : m.f1_score >= 0.4 ? '#eab308' : '#ef4444'}">${(m.f1_score*100).toFixed(0)}%</td>
      </tr>`).join('');
  }

  // Chart
  ChartManager.renderEvaluationChart('chart-eval', result.per_type_metrics);

  // False Positives list
  const fpList = document.getElementById('eval-fp-list');
  if (fpList) {
    fpList.innerHTML = result.false_positives.length === 0
      ? '<div style="color:var(--text-muted);font-size:13px">✅ No false positives</div>'
      : result.false_positives.map(d => `
          <div style="background:var(--bg-surface);border:1px solid var(--sev-high-border);padding:10px;border-radius:6px;margin-bottom:6px">
            ${severityBadge(d.severity)} <strong>${(d.type||'').replace(/_/g,' ')}</strong>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${escHtml(d.explanation.slice(0,100))}…</div>
          </div>`).join('');
  }

  // False Negatives list
  const fnList = document.getElementById('eval-fn-list');
  if (fnList) {
    fnList.innerHTML = result.false_negatives.length === 0
      ? '<div style="color:var(--text-muted);font-size:13px">✅ No false negatives</div>'
      : result.false_negatives.map(d => `
          <div style="background:var(--bg-surface);border:1px solid var(--sev-critical-border);padding:10px;border-radius:6px;margin-bottom:6px">
            ${severityBadge(d.severity)} <strong>${(d.type||'').replace(/_/g,' ')}</strong>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${escHtml(d.explanation.slice(0,100))}…</div>
          </div>`).join('');
  }
}

// ─── Delete Trace ─────────────────────────────────────────────────────────────
async function handleDeleteTrace(traceId) {
  if (!confirm(`Delete trace #${traceId}? This action cannot be undone.`)) return;
  showLoading('Deleting trace…');
  try {
    await API.deleteTrace(traceId);
    showToast(`Trace #${traceId} deleted.`, 'success');
    if (AppState.currentPage === 'dashboard') loadDashboard();
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ─── Load Sample Trace ────────────────────────────────────────────────────────
async function loadSampleTrace(filename) {
  showLoading(`Loading sample: ${filename}…`);
  try {
    const res = await fetch(`/samples/${filename}`);
    if (!res.ok) throw new Error('Sample file not found.');
    const text = await res.text();
    document.getElementById('paste-textarea').value = text;
    document.getElementById('paste-name').value = filename.replace('.json','').replace(/_/g,' ');
    navigateTo('upload');
    showToast('Sample loaded into paste box — click Analyze to run.', 'info');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ─── Escape HTML ──────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ─── Initialize App ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await initSystemStatus();
  initUploadPage();

  // Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      if (page) navigateTo(page);
    });
  });

  // Paste example format toggle
  const exBtn = document.getElementById('btn-show-example');
  if (exBtn) {
    exBtn.addEventListener('click', () => {
      const exEl = document.getElementById('example-format');
      if (exEl) exEl.style.display = exEl.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Start on dashboard
  navigateTo('dashboard');
});
