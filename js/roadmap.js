// ============================================================
// roadmap.js — The Ridings
// ============================================================

const DAY_PX    = 10;  // pixels per day
const LEFT_W    = 160; // sticky task info column width

let allTasks = [];
let currentUser = 'Adam';
let editingTaskId = null;
let currentDetailId = null;
let timelineStart = '';
let timelineEnd   = '';

(async () => {
  await requireAuth();
  const user = await getCurrentUser();
  currentUser = user.name;

  const avatar = document.getElementById('userAvatar');
  avatar.textContent = currentUser[0];
  avatar.className = 'user-avatar user-avatar--' + currentUser.toLowerCase();
  document.getElementById('userSheetName').textContent = 'Signed in as ' + currentUser;
  document.getElementById('navRoadmap').classList.add('active');

  await loadTasks();
  bindEvents();
})();

async function loadTasks() {
  const { data } = await db
    .from('roadmap_tasks')
    .select('*')
    .order('start_date', { ascending: true })
    .order('sort_order',  { ascending: true });
  allTasks = data || [];
  buildGantt();
}

function buildGantt() {
  const inner = document.getElementById('ganttInner');

  if (!allTasks.length) {
    inner.innerHTML = '<div class="gantt-empty">No tasks yet.<br>Tap + to add the first one.</div>';
    return;
  }

  const today = todayISO();
  const minStart = allTasks.reduce((m, t) => t.start_date < m ? t.start_date : m, allTasks[0].start_date);
  const maxEnd   = allTasks.reduce((m, t) => t.end_date   > m ? t.end_date   : m, allTasks[0].end_date);

  timelineStart = addDays(minStart, -14);
  timelineEnd   = addDays(maxEnd,    14);
  if (daysBetween(timelineStart, timelineEnd) < 180) timelineEnd = addDays(timelineStart, 180);

  const totalDays  = daysBetween(timelineStart, timelineEnd);
  const tlWidth    = totalDays * DAY_PX;
  const totalWidth = LEFT_W + tlWidth;

  let html = '';

  // Header row
  html += `<div class="gantt-row gantt-row--header">
    <div class="gantt-cell-info" style="width:${LEFT_W}px;min-width:${LEFT_W}px;">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);">Task</span>
    </div>
    <div class="gantt-cell-timeline" style="width:${tlWidth}px;">
      ${buildTimelineHeader(totalDays, tlWidth)}
    </div>
  </div>`;

  // Task rows
  allTasks.forEach(task => {
    const barLeft  = daysBetween(timelineStart, task.start_date) * DAY_PX;
    const barWidth = Math.max(daysBetween(task.start_date, task.end_date) * DAY_PX, DAY_PX * 2);
    html += `<div class="gantt-row" data-id="${task.id}">
      <div class="gantt-cell-info" style="width:${LEFT_W}px;min-width:${LEFT_W}px;" data-info-id="${task.id}">
        <div class="gantt-task-name">${task.title}</div>
        <div class="gantt-task-meta">
          <span class="author-tag author-tag--${task.owner.toLowerCase()}" style="font-size:10px;">${task.owner}</span>
          <span class="status-pill status-pill--${task.status}" style="font-size:10px;">${statusLabel(task.status)}</span>
        </div>
      </div>
      <div class="gantt-cell-timeline" style="width:${tlWidth}px;">
        ${todayLine()}
        <div class="gantt-bar gantt-bar--${task.status}" style="left:${barLeft}px;width:${barWidth}px;" data-bar-id="${task.id}">
          ${barWidth > 60 ? task.title : ''}
        </div>
      </div>
    </div>`;
  });

  inner.innerHTML = html;
  inner.style.minWidth = totalWidth + 'px';

  // Scroll to today
  requestAnimationFrame(() => {
    const sc = document.getElementById('ganttScroll');
    const todayOffset = daysBetween(timelineStart, today) * DAY_PX;
    sc.scrollLeft = Math.max(0, todayOffset - 80);
  });

  // Bind taps — info cell OR bar opens detail
  inner.querySelectorAll('[data-info-id]').forEach(el => {
    el.addEventListener('click', () => openDetail(el.dataset.infoId));
  });
  inner.querySelectorAll('[data-bar-id]').forEach(el => {
    el.addEventListener('click', () => openDetail(el.dataset.barId));
  });
}

function buildTimelineHeader(totalDays, tlWidth) {
  let html = '';
  let cursor = timelineStart;
  while (cursor < timelineEnd) {
    const d = new Date(cursor + 'T12:00:00');
    const nextMonthDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const nextMonth = nextMonthDate.getFullYear() + '-' +
      String(nextMonthDate.getMonth() + 1).padStart(2, '0') + '-01';
    const monthEnd  = nextMonth < timelineEnd ? nextMonth : timelineEnd;
    const monthLeft  = daysBetween(timelineStart, cursor) * DAY_PX;
    const monthWidth = daysBetween(cursor, monthEnd) * DAY_PX;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    html += `<div class="gantt-month-label" style="left:${monthLeft}px;width:${monthWidth}px;">${label}</div>`;
    // Week ticks within this month
    let wk = cursor;
    while (wk < monthEnd) {
      const wkLeft = daysBetween(timelineStart, wk) * DAY_PX;
      html += `<div class="gantt-week-tick" style="left:${wkLeft}px;"></div>`;
      wk = addDays(wk, 7);
    }
    cursor = monthEnd;
  }
  return html;
}

function todayLine() {
  const today = todayISO();
  if (today < timelineStart || today > timelineEnd) return '';
  const left = daysBetween(timelineStart, today) * DAY_PX;
  return `<div class="gantt-today-line" style="left:${left}px;"></div>`;
}

function statusLabel(s) {
  return { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed', blocked: 'Blocked' }[s] || s;
}

async function openDetail(id) {
  const task = allTasks.find(t => t.id === id);
  if (!task) return;
  currentDetailId = id;

  document.getElementById('detailTitle').textContent = task.title;
  document.getElementById('detailMeta').innerHTML = `
    <span class="author-tag author-tag--${task.owner.toLowerCase()}">${task.owner}</span>
    <span class="status-pill status-pill--${task.status}">${statusLabel(task.status)}</span>`;
  document.getElementById('detailDates').textContent =
    formatDateMed(task.start_date) + '  \u2192  ' + formatDateMed(task.end_date);
  document.getElementById('detailNotes').textContent = task.notes || '';
  document.getElementById('detailEditBtn').dataset.id = id;
  document.getElementById('quickTodoInput').value = '';

  await loadTaskTodos(id);
  openSheet('detailSheet');
}

async function loadTaskTodos(taskId) {
  const { data: todos } = await db
    .from('todos').select('*').eq('task_id', taskId).order('created_at');
  const list = document.getElementById('taskTodosList');
  if (!todos || !todos.length) {
    list.innerHTML = '<p style="font-size:13px;color:var(--muted);padding:6px 0;">No todos yet.</p>';
    return;
  }
  const chk = (t) => t.completed
    ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>'
    : '';
  list.innerHTML = todos.map(t => `
    <div class="task-todo-item">
      <button class="todo-check${t.completed ? ' checked' : ''}" data-id="${t.id}" data-completed="${t.completed}"
        style="width:20px;height:20px;flex-shrink:0;">${chk(t)}</button>
      <span class="task-todo-item__title${t.completed ? ' done' : ''}">${t.title}</span>
      <span class="author-tag author-tag--${t.assigned_to.toLowerCase()}" style="font-size:10px;">${t.assigned_to}</span>
    </div>`).join('');

  list.querySelectorAll('.todo-check').forEach(btn => {
    btn.addEventListener('click', async () => {
      await db.from('todos').update({ completed: btn.dataset.completed !== 'true' }).eq('id', btn.dataset.id);
      loadTaskTodos(taskId);
    });
  });
}

async function addQuickTodo() {
  const input = document.getElementById('quickTodoInput');
  const title = input.value.trim();
  if (!title || !currentDetailId) return;
  const { error } = await db.from('todos').insert({
    title, assigned_to: 'Both', task_id: currentDetailId
  });
  if (error) { alert(error.message); return; }
  input.value = '';
  loadTaskTodos(currentDetailId);
}

function openAddTaskSheet() {
  editingTaskId = null;
  document.getElementById('taskSheetTitle').textContent = 'Add task';
  document.getElementById('taskForm').reset();
  document.getElementById('taskStart').value = todayISO();
  document.getElementById('taskEnd').value   = addDays(todayISO(), 30);
  document.getElementById('deleteTaskWrap').style.display = 'none';
  openSheet('taskSheet');
}

async function openEditTaskSheet(id) {
  const task = allTasks.find(t => t.id === id);
  if (!task) return;
  editingTaskId = id;
  document.getElementById('taskSheetTitle').textContent = 'Edit task';
  document.getElementById('taskTitle').value  = task.title;
  document.getElementById('taskOwner').value  = task.owner;
  document.getElementById('taskStatus').value = task.status;
  document.getElementById('taskStart').value  = task.start_date;
  document.getElementById('taskEnd').value    = task.end_date;
  document.getElementById('taskNotes').value  = task.notes || '';
  document.getElementById('deleteTaskWrap').style.display = 'block';
  document.getElementById('deleteTaskBtn').dataset.id = id;
  openSheet('taskSheet');
}

async function saveTask(ev) {
  ev.preventDefault();
  const btn = document.getElementById('saveTaskBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  const payload = {
    title:      document.getElementById('taskTitle').value.trim(),
    owner:      document.getElementById('taskOwner').value,
    status:     document.getElementById('taskStatus').value,
    start_date: document.getElementById('taskStart').value,
    end_date:   document.getElementById('taskEnd').value,
    notes:      document.getElementById('taskNotes').value.trim() || null,
  };
  let error;
  if (editingTaskId) {
    ({ error } = await db.from('roadmap_tasks').update(payload).eq('id', editingTaskId));
  } else {
    const maxOrder = allTasks.length ? Math.max(...allTasks.map(t => t.sort_order || 0)) + 1 : 0;
    ({ error } = await db.from('roadmap_tasks').insert({ ...payload, sort_order: maxOrder }));
  }
  btn.disabled = false; btn.textContent = 'Save';
  if (error) { alert(error.message); return; }
  closeSheet('taskSheet');
  loadTasks();
}

async function deleteTask(id) {
  if (!confirm('Delete this task? Linked todos will be unlinked.')) return;
  await db.from('roadmap_tasks').delete().eq('id', id);
  closeSheet('taskSheet');
  loadTasks();
}

function openSheet(id) {
  document.getElementById('overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closeSheet(id) {
  document.getElementById(id).classList.remove('open');
  if (!document.querySelector('.sheet.open')) document.getElementById('overlay').classList.remove('open');
  if (id === 'taskSheet')   editingTaskId  = null;
  if (id === 'detailSheet') currentDetailId = null;
}

function bindEvents() {
  document.getElementById('fabBtn').addEventListener('click', openAddTaskSheet);
  document.getElementById('cancelTaskBtn').addEventListener('click', () => closeSheet('taskSheet'));
  document.getElementById('taskForm').addEventListener('submit', saveTask);
  document.getElementById('deleteTaskBtn').addEventListener('click', function() { deleteTask(this.dataset.id); });

  document.getElementById('detailEditBtn').addEventListener('click', function() {
    const id = this.dataset.id;
    closeSheet('detailSheet');
    openEditTaskSheet(id);
  });
  document.getElementById('detailCloseBtn').addEventListener('click', () => closeSheet('detailSheet'));

  document.getElementById('quickTodoBtn').addEventListener('click', addQuickTodo);
  document.getElementById('quickTodoInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addQuickTodo(); }
  });

  document.getElementById('userAvatar').addEventListener('click', () => openSheet('userSheet'));
  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await db.auth.signOut(); window.location.href = '/login';
  });

  document.getElementById('overlay').addEventListener('click', () => {
    document.querySelectorAll('.sheet.open').forEach(s => closeSheet(s.id));
  });
}
