// ============================================================
// todos.js — The Ridings
// ============================================================

let allTodos = [];
let roadmapTasks = [];
let currentUser = 'Adam';
let activeFilter = 'all';
let editingTodoId = null;

(async () => {
  await requireAuth();
  const user = await getCurrentUser();
  currentUser = user.name;

  const avatar = document.getElementById('userAvatar');
  avatar.textContent = currentUser[0];
  avatar.className = 'user-avatar user-avatar--' + currentUser.toLowerCase();
  document.getElementById('userSheetName').textContent = 'Signed in as ' + currentUser;
  document.getElementById('navTodos').classList.add('active');

  await Promise.all([loadTodos(), loadRoadmapTasks()]);
  bindEvents();
})();

async function loadTodos() {
  const { data } = await db
    .from('todos')
    .select('*, roadmap_tasks(title)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  allTodos = data || [];
  renderTodos();
}

async function loadRoadmapTasks() {
  const { data } = await db.from('roadmap_tasks').select('id, title').order('start_date');
  roadmapTasks = data || [];
  const sel = document.getElementById('todoTaskLink');
  sel.innerHTML = '<option value="">\u2014 none \u2014</option>';
  roadmapTasks.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id; opt.textContent = t.title;
    sel.appendChild(opt);
  });
}

function renderTodos() {
  const today = todayISO();
  let filtered = allTodos;
  // 'mine' filter removed
  if (activeFilter === 'adam')     filtered = allTodos.filter(t => t.assigned_to === 'Adam'     || t.assigned_to === 'Both');
  if (activeFilter === 'kayleigh') filtered = allTodos.filter(t => t.assigned_to === 'Kayleigh' || t.assigned_to === 'Both');

  const overdue  = filtered.filter(t => !t.completed && t.due_date && t.due_date < today);
  const dueToday = filtered.filter(t => !t.completed && t.due_date === today);
  const upcoming = filtered.filter(t => !t.completed && t.due_date && t.due_date > today);
  const noDate   = filtered.filter(t => !t.completed && !t.due_date);
  const done     = filtered.filter(t => t.completed);

  let html = '';
  if (overdue.length)  { html += '<div class="todo-group-label todo-group-label--overdue">Overdue</div>';    overdue.forEach(t  => { html += buildTodoItem(t, true);  }); }
  if (dueToday.length) { html += '<div class="todo-group-label">Today</div>';                                dueToday.forEach(t => { html += buildTodoItem(t);         }); }
  if (upcoming.length) { html += '<div class="todo-group-label">Upcoming</div>';                             upcoming.forEach(t => { html += buildTodoItem(t);         }); }
  if (noDate.length)   { html += '<div class="todo-group-label">No due date</div>';                          noDate.forEach(t   => { html += buildTodoItem(t);         }); }
  if (done.length)     { html += '<div class="todo-group-label" style="opacity:0.6;">Done</div>';            done.forEach(t     => { html += buildTodoItem(t);         }); }
  if (!html) html = '<div class="empty-state"><p>No todos here yet.<br>Tap + to add one.</p></div>';

  const list = document.getElementById('todoList');
  list.innerHTML = html;

  list.querySelectorAll('.todo-check').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleTodo(btn.dataset.id, btn.dataset.completed === 'true');
    });
  });
  list.querySelectorAll('.todo-item[data-id]').forEach(item => {
    item.addEventListener('click', () => openEditTodoSheet(item.dataset.id));
  });
}

function buildTodoItem(t, overdue) {
  const taskName = t.roadmap_tasks && t.roadmap_tasks.title;
  const checkmark = t.completed
    ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>'
    : '';
  return `<div class="todo-item${overdue ? ' todo-item--overdue' : ''}${t.completed ? ' todo-item--done' : ''}" data-id="${t.id}">
    <button class="todo-check${t.completed ? ' checked' : ''}" data-id="${t.id}" data-completed="${t.completed}">${checkmark}</button>
    <div class="todo-item__body">
      <div class="todo-item__title">${t.title}</div>
      <div class="todo-item__meta">
        <span class="author-tag author-tag--${t.assigned_to.toLowerCase()}">${t.assigned_to}</span>
        ${t.due_date ? `<span class="todo-due${overdue ? ' todo-due--overdue' : ''}">${formatDateShort(t.due_date)}</span>` : ''}
        ${taskName ? `<span class="todo-task-link">${taskName}</span>` : ''}
      </div>
    </div>
  </div>`;
}

async function toggleTodo(id, wasCompleted) {
  await db.from('todos').update({ completed: !wasCompleted }).eq('id', id);
  loadTodos();
}

function openAddTodoSheet() {
  editingTodoId = null;
  document.getElementById('todoSheetTitle').textContent = 'Add todo';
  document.getElementById('todoForm').reset();
  document.getElementById('deleteTodoWrap').style.display = 'none';
  openSheet('todoSheet');
}

function openEditTodoSheet(id) {
  const todo = allTodos.find(t => t.id === id);
  if (!todo) return;
  editingTodoId = id;
  document.getElementById('todoSheetTitle').textContent = 'Edit todo';
  document.getElementById('todoTitle').value   = todo.title;
  document.getElementById('todoAssignee').value = todo.assigned_to;
  document.getElementById('todoDueDate').value  = todo.due_date || '';
  document.getElementById('todoTaskLink').value  = todo.task_id || '';
  document.getElementById('deleteTodoWrap').style.display = 'block';
  document.getElementById('deleteTodoBtn').dataset.id = id;
  openSheet('todoSheet');
}

async function saveTodo(ev) {
  ev.preventDefault();
  const btn = document.getElementById('saveTodoBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  const payload = {
    title:       document.getElementById('todoTitle').value.trim(),
    assigned_to: document.getElementById('todoAssignee').value,
    due_date:    document.getElementById('todoDueDate').value || null,
    task_id:     document.getElementById('todoTaskLink').value || null,
  };
  let error;
  if (editingTodoId) {
    ({ error } = await db.from('todos').update(payload).eq('id', editingTodoId));
  } else {
    ({ error } = await db.from('todos').insert(payload));
  }
  btn.disabled = false; btn.textContent = 'Save';
  if (error) { alert(error.message); return; }
  closeSheet('todoSheet');
  loadTodos();
}

async function deleteTodo(id) {
  if (!confirm('Delete this todo?')) return;
  await db.from('todos').delete().eq('id', id);
  closeSheet('todoSheet');
  loadTodos();
}

function openSheet(id) {
  document.getElementById('overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closeSheet(id) {
  document.getElementById(id).classList.remove('open');
  if (!document.querySelector('.sheet.open')) document.getElementById('overlay').classList.remove('open');
  if (id === 'todoSheet') editingTodoId = null;
}

function bindEvents() {
  document.getElementById('fabBtn').addEventListener('click', openAddTodoSheet);
  document.getElementById('cancelTodoBtn').addEventListener('click', () => closeSheet('todoSheet'));
  document.getElementById('todoForm').addEventListener('submit', saveTodo);
  document.getElementById('deleteTodoBtn').addEventListener('click', function() { deleteTodo(this.dataset.id); });

  document.getElementById('filterBar').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTodos();
  });

  document.getElementById('userAvatar').addEventListener('click', () => openSheet('userSheet'));
  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await db.auth.signOut(); window.location.href = '/login';
  });

  document.getElementById('overlay').addEventListener('click', () => {
    document.querySelectorAll('.sheet.open').forEach(s => closeSheet(s.id));
  });
}
