// ============================================================
// checklist.js — Pre-trip checklist logic
// ============================================================

(async () => {
  await requireAuth();
  await loadChecklist();
  bindEvents();
})();

async function loadChecklist() {
  const body = document.getElementById('checklistBody');
  body.innerHTML = '<div class="spinner"></div>';

  const { data: items, error } = await db
    .from('checklist_items')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    body.innerHTML = `<p style="color:var(--muted);padding:20px">${error.message}</p>`;
    return;
  }

  if (!items.length) {
    body.innerHTML = `<div class="empty-checklist"><p>No items yet.<br/>Tap + to add something to sort before you go.</p></div>`;
    return;
  }

  const todo = items.filter(i => !i.done);
  const done = items.filter(i => i.done);
  const pct  = items.length ? Math.round((done.length / items.length) * 100) : 0;

  let html = `
    <div class="checklist-progress">
      <div class="checklist-progress__label">
        <span>Progress</span>
        <span>${done.length} / ${items.length} done</span>
      </div>
      <div class="checklist-progress__bar">
        <div class="checklist-progress__fill" style="width:${pct}%"></div>
      </div>
    </div>`;

  if (todo.length) {
    html += `<div class="checklist-section-title">To do</div>`;
    todo.forEach(item => { html += buildChecklistItem(item); });
  }

  if (done.length) {
    html += `<div class="checklist-section-title">Done</div>`;
    done.forEach(item => { html += buildChecklistItem(item); });
  }

  body.innerHTML = html;

  // Bind check toggles
  body.querySelectorAll('.checklist-item__check').forEach(btn => {
    btn.addEventListener('click', () => toggleItem(btn.dataset.id, btn.dataset.done === 'true'));
  });
  // Bind deletes
  body.querySelectorAll('.checklist-item__del').forEach(btn => {
    btn.addEventListener('click', () => deleteItem(btn.dataset.id));
  });
}

function buildChecklistItem(item) {
  return `
    <div class="checklist-item ${item.done ? 'done' : ''}">
      <button class="checklist-item__check ${item.done ? 'checked' : ''}"
              data-id="${item.id}" data-done="${item.done}">
        ${item.done ? '✓' : ''}
      </button>
      <span class="checklist-item__text">${item.text}</span>
      <button class="checklist-item__del" data-id="${item.id}">✕</button>
    </div>`;
}

async function toggleItem(id, currentlyDone) {
  await db.from('checklist_items').update({ done: !currentlyDone }).eq('id', id);
  await loadChecklist();
}

async function deleteItem(id) {
  await db.from('checklist_items').delete().eq('id', id);
  await loadChecklist();
}

async function addItem(e) {
  e.preventDefault();
  const btn  = document.getElementById('saveBtn');
  const text = document.getElementById('taskText').value.trim();
  btn.disabled = true; btn.textContent = 'Adding…';

  const { error } = await db.from('checklist_items').insert({ text, done: false });

  btn.disabled = false; btn.textContent = 'Add';
  if (error) { alert(error.message); return; }

  closeSheet();
  await loadChecklist();
}

function openSheet() {
  document.getElementById('overlay').classList.add('open');
  document.getElementById('addSheet').classList.add('open');
  document.getElementById('taskText').focus();
}

function closeSheet() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('addSheet').classList.remove('open');
  document.getElementById('addForm').reset();
}

function bindEvents() {
  document.getElementById('fabBtn').addEventListener('click', openSheet);
  document.getElementById('cancelBtn').addEventListener('click', closeSheet);
  document.getElementById('overlay').addEventListener('click', closeSheet);
  document.getElementById('addForm').addEventListener('submit', addItem);
}
