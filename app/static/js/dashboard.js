/* ─── State ──────────────────────────────────────────────────────────── */
let tasks = [];
let currentFilter = { status: '', priority: '' };
let searchTimer = null;
let socket = null;
let activityChart = null;

/* ─── Init ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSocket();
  loadTasks();
  initFilters();
  initDrawer();
  document.getElementById('taskForm').addEventListener('submit', handleTaskFormSubmit);
});

/* ─── Drawer ─────────────────────────────────────────────────────────── */
function initDrawer() {
  document.getElementById('drawerToggle').addEventListener('click', () => {
    openDrawer();
  });
}
function openDrawer() {
  document.getElementById('sidebar').classList.add('drawer-open');
  document.getElementById('drawerOverlay').classList.add('active');
  document.getElementById('drawerToggle').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  document.getElementById('sidebar').classList.remove('drawer-open');
  document.getElementById('drawerOverlay').classList.remove('active');
  document.getElementById('drawerToggle').classList.remove('open');
  document.body.style.overflow = '';
}

/* ─── WebSocket ──────────────────────────────────────────────────────── */
function initSocket() {
  socket = io({ transports: ['websocket', 'polling'] });
  socket.on('connect', () => document.getElementById('liveBadge').classList.add('active'));
  socket.on('disconnect', () => document.getElementById('liveBadge').classList.remove('active'));
  socket.on('task_created', (task) => { tasks.unshift(task); renderTasks(); showToast('New task created!', 'success'); });
  socket.on('task_updated', (updated) => {
    const idx = tasks.findIndex(t => t.id === updated.id);
    if (idx !== -1) tasks[idx] = updated;
    renderTasks();
    showToast('Task updated.', 'info');
  });
  socket.on('task_deleted', ({ id }) => { tasks = tasks.filter(t => t.id !== id); renderTasks(); showToast('Task deleted.', 'info'); });
}

/* ─── Tasks API ──────────────────────────────────────────────────────── */
async function loadTasks() {
  document.getElementById('taskList').innerHTML = '<div class="loading-state">Loading tasks…</div>';
  const params = new URLSearchParams();
  if (currentFilter.status) params.set('status', currentFilter.status);
  if (currentFilter.priority) params.set('priority', currentFilter.priority);
  const search = document.getElementById('searchInput')?.value?.trim();
  if (search) params.set('search', search);
  try {
    const res = await fetch('/api/tasks?' + params);
    const data = await res.json();
    if (data.success) { tasks = data.tasks; renderTasks(); }
  } catch (e) { showToast('Failed to load tasks.', 'error'); }
}

function renderTasks() {
  const list = document.getElementById('taskList');
  if (!tasks.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-state__icon">◈</div>
      <p class="empty-state__text">No tasks found</p>
      <p class="empty-state__sub">Create your first task to get started</p>
    </div>`;
    return;
  }
  list.innerHTML = tasks.map(task => `
    <div class="task-card" data-id="${task.id}" data-priority="${task.priority}">
      <div class="task-card__header">
        <h3 class="task-card__title ${task.status === 'completed' ? 'completed' : ''}">${escHtml(task.title)}</h3>
      </div>
      <div class="task-card__badges">
        <span class="badge badge--priority-${task.priority}">${task.priority}</span>
        <span class="badge badge--status-${task.status}">${task.status.replace('_', ' ')}</span>
      </div>
      ${task.description ? `<p class="task-card__desc">${escHtml(task.description)}</p>` : ''}
      <p class="task-card__meta">Created ${formatDate(task.created_at)}${task.due_date ? ` · Due ${formatDate(task.due_date)}` : ''}</p>
      <div class="task-card__actions">
        <button class="btn btn--secondary btn--sm" onclick="openModal('edit', ${task.id})">Edit</button>
        ${task.status !== 'completed' ? `<button class="btn btn--secondary btn--sm" onclick="quickComplete(${task.id})">✓ Done</button>` : ''}
        <button class="btn btn--danger btn--sm" onclick="deleteTask(${task.id})">Delete</button>
      </div>
    </div>`).join('');
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    const res = await fetch('/api/tasks/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) showToast(data.message, 'error');
  } catch (e) { showToast('Delete failed.', 'error'); }
}

async function quickComplete(id) {
  try {
    await fetch('/api/tasks/' + id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
  } catch (e) { showToast('Update failed.', 'error'); }
}

/* ─── Modal ──────────────────────────────────────────────────────────── */
function openModal(mode, taskId = null) {
  const modal = document.getElementById('taskModal');
  clearModalError();
  const submitSpan = document.getElementById('modalSubmit').querySelector('span');
  if (mode === 'create') {
    document.getElementById('modalTitle').textContent = 'New Task';
    submitSpan.textContent = 'Create Task';
    ['taskId','taskTitle','taskDesc','taskDueDate'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskStatus').value = 'pending';
  } else {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    document.getElementById('modalTitle').textContent = 'Edit Task';
    submitSpan.textContent = 'Save Changes';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDesc').value = task.description || '';
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskStatus').value = task.status;
    document.getElementById('taskDueDate').value = task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '';
  }
  modal.classList.remove('hidden');
}

function closeModal() { document.getElementById('taskModal').classList.add('hidden'); }

async function handleTaskFormSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('modalSubmit');
  const span = btn.querySelector('span');
  btn.disabled = true; span.textContent = 'Saving…';
  clearModalError();
  const id = document.getElementById('taskId').value;
  const payload = {
    title: document.getElementById('taskTitle').value,
    description: document.getElementById('taskDesc').value,
    priority: document.getElementById('taskPriority').value,
    status: document.getElementById('taskStatus').value,
    due_date: document.getElementById('taskDueDate').value || null,
  };
  try {
    const res = await fetch(id ? '/api/tasks/' + id : '/api/tasks', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) { closeModal(); }
    else { showModalError(data.message); }
  } catch (err) { showModalError('Network error. Please try again.'); }
  finally { btn.disabled = false; span.textContent = id ? 'Save Changes' : 'Create Task'; }
}

function showModalError(msg) { const el = document.getElementById('modalError'); el.textContent = msg; el.classList.remove('hidden'); }
function clearModalError() { document.getElementById('modalError').classList.add('hidden'); }

/* ─── Analytics (Report-style) ───────────────────────────────────────── */
async function loadAnalytics() {
  document.getElementById('analyticsContent').innerHTML = '<div class="loading-state">Computing analytics…</div>';
  try {
    const res = await fetch('/api/analytics/summary');
    const data = await res.json();
    if (data.success) renderAnalytics(data.analytics);
  } catch (e) {
    document.getElementById('analyticsContent').innerHTML = '<p style="color:var(--accent-2)">Failed to load analytics.</p>';
  }
}

function renderAnalytics(a) {
  const pColors = { low:'#50c0a0', medium:'#7070f0', high:'#f09040', critical:'#e05050' };
  const sColors = { pending:'#7a7a90', in_progress:'#7070f0', completed:'#50c0a0', cancelled:'#4a4a5a' };
  const icons   = { low:'📗', medium:'📘', high:'🔶', critical:'🔴', pending:'⏳', in_progress:'⚡', completed:'✅', cancelled:'🚫' };
  const total = a.total_tasks || 1;

  // Build priority bar rows
  const priorityRows = Object.entries(a.priority_breakdown).map(([k, v]) => `
    <div class="bar-row">
      <span class="bar-row__label">${k}</span>
      <div class="bar-row__track"><div class="bar-row__fill" style="width:${Math.round(v/total*100)}%;background:${pColors[k]||'#888'}"></div></div>
      <span class="bar-row__count">${v}</span>
    </div>`).join('');

  // Build weakest topics (low completion rate priorities)
  const crEntries = Object.entries(a.completion_rate_by_priority || {}).sort((a,b) => a[1]-b[1]);
  const weakEntries = crEntries.slice(0, 3);
  const strongEntries = [...crEntries].reverse().slice(0, 3);

  function topicRows(entries, barColor) {
    return entries.map(([k, pct]) => {
      const count = a.priority_breakdown[k] || 0;
      return `<div class="topic-row">
        <div class="topic-row__header">
          <div class="topic-icon">${icons[k]||'📌'}</div>
          <span class="topic-row__name">${k.charAt(0).toUpperCase()+k.slice(1)} Priority</span>
          <span class="topic-row__pct">${pct}% done</span>
        </div>
        <div class="topic-bar-track">
          <div class="topic-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Completion ring SVG
  const compPct = a.completion_percentage || 0;
  const r = 44; const circ = 2 * Math.PI * r;
  const dash = Math.round(circ * compPct / 100);
  const ringEl = `
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r="${r}" fill="none" stroke="#2a2a30" stroke-width="10"/>
      <circle cx="55" cy="55" r="${r}" fill="none" stroke="#50c0a0" stroke-width="10"
        stroke-dasharray="${dash} ${circ}" stroke-linecap="round"
        transform="rotate(-90 55 55)" style="transition:stroke-dasharray 0.8s ease"/>
      <text x="55" y="50" text-anchor="middle" fill="#e8e8f0" font-size="16" font-weight="800" font-family="Syne,sans-serif">${compPct}%</text>
      <text x="55" y="66" text-anchor="middle" fill="#7a7a90" font-size="10" font-family="Syne,sans-serif">complete</text>
    </svg>`;

  // Daily activity data for bar chart
  const dailyData = a.daily_creation_last_7_days || {};
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0,10);
    days.push({ label: d.toLocaleDateString('en',{weekday:'short'}), value: dailyData[key] || 0 });
  }

  document.getElementById('analyticsContent').innerHTML = `
    <div class="analytics-top-cards">
      <div class="stat-card stat-card--accent">
        <div class="stat-card__label">Total Tasks</div>
        <div class="stat-card__value">${a.total_tasks}</div>
        <div class="stat-card__sub">All time</div>
      </div>
      <div class="stat-card stat-card--green">
        <div class="stat-card__label">Completed</div>
        <div class="stat-card__value">${a.completed_tasks}</div>
        <div class="stat-card__sub">${compPct}% of total</div>
      </div>
      <div class="stat-card stat-card--blue">
        <div class="stat-card__label">In Progress</div>
        <div class="stat-card__value">${a.in_progress_tasks}</div>
        <div class="stat-card__sub">Active now</div>
      </div>
      <div class="stat-card stat-card--red">
        <div class="stat-card__label">Pending</div>
        <div class="stat-card__value">${a.pending_tasks}</div>
        <div class="stat-card__sub">Needs attention</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Avg / Priority</div>
        <div class="stat-card__value" style="color:var(--text)">${a.avg_tasks_per_priority}</div>
        <div class="stat-card__sub">tasks each</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Cancelled</div>
        <div class="stat-card__value" style="color:var(--text-muted)">${a.cancelled_tasks}</div>
        <div class="stat-card__sub">dropped tasks</div>
      </div>
    </div>

    <div class="analytics-mid">
      <div class="analytics-card">
        <p class="analytics-card__title">Weakest Priorities</p>
        ${weakEntries.length ? topicRows(weakEntries, '#e05050') : '<p style="color:var(--text-dim);font-size:.875rem">No data yet</p>'}
      </div>
      <div class="analytics-card">
        <p class="analytics-card__title">Strongest Priorities</p>
        ${strongEntries.length ? topicRows(strongEntries, '#50c0a0') : '<p style="color:var(--text-dim);font-size:.875rem">No data yet</p>'}
      </div>
    </div>

    <div class="analytics-mid">
      <div class="analytics-card">
        <p class="analytics-card__title">Completion Overview</p>
        <div class="completion-ring-wrap">
          ${ringEl}
          <div class="completion-stats">
            ${Object.entries(a.status_breakdown||{}).map(([k,v]) => `
              <div class="completion-stat">
                <span class="completion-stat__dot" style="background:${sColors[k]||'#888'}"></span>
                <span class="completion-stat__label">${k.replace('_',' ')}</span>
                <span class="completion-stat__value">${v}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="analytics-card">
        <p class="analytics-card__title">Tasks by Priority</p>
        <div class="bar-chart-wrap">
          ${priorityRows || '<p style="color:var(--text-dim);font-size:.875rem">No data yet</p>'}
        </div>
      </div>
    </div>

    <div class="analytics-card analytics-bottom">
      <p class="analytics-card__title">Activity — last 7 days</p>
      <div style="position:relative;height:180px;margin-top:0.5rem">
        <canvas id="activityChart" role="img" aria-label="Bar chart of tasks created in last 7 days">
          Tasks created: ${days.map(d=>d.label+': '+d.value).join(', ')}
        </canvas>
      </div>
    </div>`;

  // Render Chart.js bar chart
  if (activityChart) activityChart.destroy();
  const ctx = document.getElementById('activityChart');
  if (ctx && window.Chart) {
    activityChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days.map(d => d.label),
        datasets: [{
          label: 'Tasks Created',
          data: days.map(d => d.value),
          backgroundColor: days.map((_, i) => i === days.length-1 ? '#f0c060' : 'rgba(112,112,240,0.6)'),
          borderRadius: 4, borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.y + ' tasks' } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7a7a90', font: { family: 'JetBrains Mono', size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7a7a90', font: { family: 'JetBrains Mono', size: 11 }, stepSize: 1 }, beginAtZero: true }
        }
      }
    });
  }
}

/* ─── Filters ────────────────────────────────────────────────────────── */
function initFilters() {
  document.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-status]').forEach(b => b.classList.remove('filter-chip--active'));
      btn.classList.add('filter-chip--active');
      currentFilter.status = btn.dataset.status;
      loadTasks();
    });
  });
  document.querySelectorAll('[data-priority]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-priority]').forEach(b => b.classList.remove('filter-chip--active'));
      btn.classList.add('filter-chip--active');
      currentFilter.priority = btn.dataset.priority;
      loadTasks();
    });
  });
}

/* ─── View Switching ─────────────────────────────────────────────────── */
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('nav-item--active'));
  document.getElementById('view-' + view).classList.add('view--active');
  document.querySelector('[data-view="' + view + '"]').classList.add('nav-item--active');
  if (view === 'analytics') loadAnalytics();
  // Close drawer on mobile after nav
  if (window.innerWidth <= 768) closeDrawer();
}

/* ─── Search ─────────────────────────────────────────────────────────── */
function debounceSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadTasks(), 350); }

/* ─── Toasts ─────────────────────────────────────────────────────────── */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast toast--' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(() => toast.remove(), 400); }, 3000);
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function escHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function formatDate(iso) { if (!iso) return ''; return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
