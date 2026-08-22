// ============================================================
// calendar.js — The Ridings
// ============================================================

let currentDate = '';
let currentUser = 'Adam';
let editingId = null;

(async () => {
  await requireAuth();
  const user = await getCurrentUser();
  currentUser = user.name;

  const avatar = document.getElementById('userAvatar');
  avatar.textContent = currentUser[0];
  avatar.className = 'user-avatar user-avatar--' + currentUser.toLowerCase();
  document.getElementById('userSheetName').textContent = 'Signed in as ' + currentUser;
  document.getElementById('navCal').classList.add('active');

  const params = new URLSearchParams(window.location.search);
  currentDate = params.get('date') || todayISO();

  renderHeader();
  await loadDay();
  bindEvents();
})();

function renderHeader() {
  const d = new Date(currentDate + 'T12:00:00');
  const isToday = currentDate === todayISO();
  document.getElementById('dayTitle').textContent = d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  document.getElementById('daySubtitle').textContent = isToday
    ? 'Today · ' + d.getFullYear()
    : d.getFullYear().toString();
  history.replaceState({}, '', '/calendar?date=' + currentDate);
}

async function loadDay(direction) {
  const content = document.getElementById('dayContent');
  content.innerHTML = '<div class="spinner"></div>';
  const { data: entries } = await db
    .from('calendar_entries')
    .select('*')
    .eq('date', currentDate)
    .order('created_at', { ascending: true });
  renderEntries(entries || [], direction);
}

function renderEntries(entries, direction) {
  const content = document.getElementById('dayContent');
  if (!entries.length) {
    content.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p>Nothing here yet.<br>Tap + to add an entry.</p>
      </div>`;
  } else {
    content.innerHTML = entries.map(buildEntryCard).join('');
    content.querySelectorAll('.cal-card[data-id]').forEach(card => {
      card.addEventListener('click', () => openDetail(card.dataset.id));
    });
  }
  if (direction) {
    content.classList.add('slide-in-' + direction);
    setTimeout(() => content.classList.remove('slide-in-' + direction), 300);
  }
}

function buildEntryCard(e) {
  return `<div class="cal-card cal-card--${e.created_by.toLowerCase()}" data-id="${e.id}">
    <div class="cal-card__header">
      <div class="cal-card__title">${e.title}</div>
      <span class="author-tag author-tag--${e.created_by.toLowerCase()}">${e.created_by}</span>
    </div>
    ${e.notes ? `<div class="cal-card__notes">${e.notes}</div>` : ''}
  </div>`;
}

async function openDetail(id) {
  const { data: e } = await db.from('calendar_entries').select('*').eq('id', id).single();
  if (!e) return;
  document.getElementById('detailTitle').textContent = e.title;
  document.getElementById('detailBody').innerHTML = `
    <div style="margin-bottom:10px;">
      <span class="author-tag author-tag--${e.created_by.toLowerCase()}">${e.created_by}</span>
    </div>
    ${e.notes ? `<p style="font-size:14px;color:var(--text);line-height:1.6;">${e.notes}</p>` : ''}`;
  document.getElementById('detailDeleteBtn').dataset.id = id;
  document.getElementById('detailEditBtn').dataset.id   = id;
  openSheet('detailSheet');
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;
  await db.from('calendar_entries').delete().eq('id', id);
  closeSheet('detailSheet');
  loadDay();
}

function openAddSheet() {
  editingId = null;
  document.getElementById('sheetTitle').textContent = 'Add entry';
  document.getElementById('entryForm').reset();
  openSheet('entrySheet');
}

async function openEditSheet(id) {
  const { data: e } = await db.from('calendar_entries').select('*').eq('id', id).single();
  if (!e) return;
  editingId = id;
  document.getElementById('sheetTitle').textContent = 'Edit entry';
  document.getElementById('entryTitle').value = e.title;
  document.getElementById('entryNotes').value = e.notes || '';
  openSheet('entrySheet');
}

async function saveEntry(ev) {
  ev.preventDefault();
  const btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  const payload = {
    date: currentDate,
    title: document.getElementById('entryTitle').value.trim(),
    notes: document.getElementById('entryNotes').value.trim() || null,
    created_by: currentUser,
  };
  let error;
  if (editingId) {
    ({ error } = await db.from('calendar_entries').update(payload).eq('id', editingId));
  } else {
    ({ error } = await db.from('calendar_entries').insert(payload));
  }
  btn.disabled = false; btn.textContent = 'Save';
  if (error) { alert(error.message); return; }
  closeSheet('entrySheet');
  loadDay();
}

function goToDate(date) {
  const dir = date > currentDate ? 'right' : 'left';
  currentDate = date;
  renderHeader();
  loadDay(dir);
}

function openSheet(id) {
  document.getElementById('overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closeSheet(id) {
  document.getElementById(id).classList.remove('open');
  if (!document.querySelector('.sheet.open')) document.getElementById('overlay').classList.remove('open');
  if (id === 'entrySheet') { editingId = null; document.getElementById('entryForm').reset(); }
}

function bindEvents() {
  document.getElementById('prevBtn').addEventListener('click', () => goToDate(addDays(currentDate, -1)));
  document.getElementById('nextBtn').addEventListener('click', () => goToDate(addDays(currentDate,  1)));

  document.getElementById('dateBtn').addEventListener('click', () => {
    const dp = document.getElementById('datePicker');
    dp.value = currentDate;
    try { dp.showPicker(); } catch(e) {}
    dp.focus();
  });
  document.getElementById('datePicker').addEventListener('change', function() {
    if (this.value) goToDate(this.value);
  });

  document.getElementById('fabBtn').addEventListener('click', openAddSheet);
  document.getElementById('cancelBtn').addEventListener('click', () => closeSheet('entrySheet'));
  document.getElementById('entryForm').addEventListener('submit', saveEntry);

  document.getElementById('detailDeleteBtn').addEventListener('click', function() { deleteEntry(this.dataset.id); });
  document.getElementById('detailEditBtn').addEventListener('click', function() {
    const id = this.dataset.id; closeSheet('detailSheet'); openEditSheet(id);
  });
  document.getElementById('detailCloseBtn').addEventListener('click', () => closeSheet('detailSheet'));

  document.getElementById('userAvatar').addEventListener('click', () => openSheet('userSheet'));
  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await db.auth.signOut(); window.location.href = '/login';
  });

  document.getElementById('overlay').addEventListener('click', () => {
    document.querySelectorAll('.sheet.open').forEach(s => closeSheet(s.id));
  });

  // Swipe
  let sx = 0, sy = 0;
  const c = document.getElementById('dayContent');
  c.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  c.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) goToDate(addDays(currentDate, dx < 0 ? 1 : -1));
  }, { passive: true });
}
