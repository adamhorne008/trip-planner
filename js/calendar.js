// ============================================================
// calendar.js — The Ridings (scrollable list view)
// ============================================================

let currentUser = 'Adam';
let selectedDate = null;
let editingId = null;
let allEntries = [];

// How many months back/forward to show
const MONTHS_BACK    = 3;
const MONTHS_FORWARD = 12;

(async () => {
  await requireAuth();
  const user = await getCurrentUser();
  currentUser = user.name;

  const avatar = document.getElementById('userAvatar');
  avatar.textContent = currentUser[0];
  avatar.className = 'user-avatar user-avatar--' + currentUser.toLowerCase();
  document.getElementById('userSheetName').textContent = 'Signed in as ' + currentUser;
  document.getElementById('navCal').classList.add('active');

  await loadAllEntries();
  renderList();
  bindEvents();
  scrollToToday();
})();

async function loadAllEntries() {
  const start = addDays(todayISO(), -(MONTHS_BACK * 31));
  const end   = addDays(todayISO(),  (MONTHS_FORWARD * 31));
  const { data } = await db
    .from('calendar_entries')
    .select('*')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  allEntries = data || [];
}

function entriesForDate(dateStr) {
  return allEntries.filter(e => e.date === dateStr);
}

function buildDateRange() {
  const today = todayISO();
  const start = addDays(today, -(MONTHS_BACK * 31));
  const end   = addDays(today,  (MONTHS_FORWARD * 31));
  const dates = [];
  let cur = start;
  while (cur <= end) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

function renderList() {
  const container = document.getElementById('calList');
  const today = todayISO();
  const dates = buildDateRange();

  // Group by month
  const months = {};
  for (const d of dates) {
    const key = d.slice(0, 7); // YYYY-MM
    if (!months[key]) months[key] = [];
    months[key].push(d);
  }

  let html = '';
  for (const [monthKey, monthDates] of Object.entries(months)) {
    const label = new Date(monthKey + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    html += `<div class="cal-month-header" data-month="${monthKey}">${label}</div>`;
    for (const d of monthDates) {
      const entries = entriesForDate(d);
      const dt = new Date(d + 'T12:00:00');
      const dayName = dt.toLocaleDateString('en-GB', { weekday: 'short' });
      const dayNum  = dt.getDate();
      const isToday = d === today;
      const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;

      const dots = entries.map(e => {
        const who = e.created_by ? e.created_by.toLowerCase() : 'both';
        return `<span class="cal-dot cal-dot--${who}" title="${e.title}"></span>`;
      }).join('');

      html += `
        <div class="cal-date-row${isToday ? ' cal-date-row--today' : ''}${isWeekend ? ' cal-date-row--weekend' : ''}" data-date="${d}">
          <div class="cal-date-row__left">
            <span class="cal-date-row__num${isToday ? ' cal-date-row__num--today' : ''}">${dayNum}</span>
            <span class="cal-date-row__day">${dayName}</span>
          </div>
          <div class="cal-date-row__dots">${dots}</div>
        </div>`;
    }
  }

  container.innerHTML = html;

  container.querySelectorAll('.cal-date-row').forEach(row => {
    row.addEventListener('click', () => openDaySheet(row.dataset.date));
  });
}

function scrollToToday() {
  const today = todayISO();
  const el = document.querySelector(`.cal-date-row[data-date="${today}"]`);
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ── Day sheet ──

function openDaySheet(dateStr) {
  selectedDate = dateStr;
  const dt = new Date(dateStr + 'T12:00:00');
  document.getElementById('daySheetTitle').textContent =
    dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  renderDaySheetEntries(dateStr);
  openSheet('daySheet');
}

function renderDaySheetEntries(dateStr) {
  const entries = entriesForDate(dateStr);
  const container = document.getElementById('daySheetEntries');
  if (!entries.length) {
    container.innerHTML = '<p style="color:var(--muted);font-size:14px;text-align:center;padding:8px 0;">No entries yet.</p>';
    return;
  }
  container.innerHTML = entries.map(e => `
    <div class="cal-card cal-card--${(e.created_by||'both').toLowerCase()}" data-id="${e.id}" style="cursor:pointer;">
      <div class="cal-card__header">
        <div class="cal-card__title">${e.title}</div>
        <span class="author-tag author-tag--${(e.created_by||'both').toLowerCase()}">${e.created_by || ''}</span>
      </div>
      ${e.notes ? `<div class="cal-card__notes">${e.notes}</div>` : ''}
    </div>`).join('');

  container.querySelectorAll('.cal-card[data-id]').forEach(card => {
    card.addEventListener('click', () => openDetail(card.dataset.id));
  });
}

// ── Detail ──

async function openDetail(id) {
  const e = allEntries.find(x => x.id === id);
  if (!e) return;
  document.getElementById('detailTitle').textContent = e.title;
  document.getElementById('detailBody').innerHTML = `
    <div style="margin-bottom:10px;">
      <span class="author-tag author-tag--${(e.created_by||'both').toLowerCase()}">${e.created_by || ''}</span>
    </div>
    ${e.notes ? `<p style="font-size:14px;color:var(--text);line-height:1.6;">${e.notes}</p>` : ''}`;
  document.getElementById('detailDeleteBtn').dataset.id = id;
  document.getElementById('detailEditBtn').dataset.id   = id;
  openSheet('detailSheet');
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;
  await db.from('calendar_entries').delete().eq('id', id);
  allEntries = allEntries.filter(e => e.id !== id);
  closeSheet('detailSheet');
  closeSheet('daySheet');
  renderList();
  if (selectedDate) openDaySheet(selectedDate);
}

// ── Add / Edit ──

function openAddSheet() {
  editingId = null;
  document.getElementById('sheetTitle').textContent = 'Add entry';
  document.getElementById('entryForm').reset();
  openSheet('entrySheet');
}

async function openEditSheet(id) {
  const e = allEntries.find(x => x.id === id);
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
    date: selectedDate,
    title: document.getElementById('entryTitle').value.trim(),
    notes: document.getElementById('entryNotes').value.trim() || null,
    created_by: currentUser,
  };
  let error, data;
  if (editingId) {
    ({ error, data } = await db.from('calendar_entries').update(payload).eq('id', editingId).select().single());
    if (!error && data) {
      const idx = allEntries.findIndex(e => e.id === editingId);
      if (idx !== -1) allEntries[idx] = data;
    }
  } else {
    ({ error, data } = await db.from('calendar_entries').insert(payload).select().single());
    if (!error && data) allEntries.push(data);
  }
  btn.disabled = false; btn.textContent = 'Save';
  if (error) { alert(error.message); return; }
  closeSheet('entrySheet');
  renderList();
  if (selectedDate) {
    renderDaySheetEntries(selectedDate);
  }
}

// ── Sheet helpers ──

function openSheet(id) {
  document.getElementById('overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}

function closeSheet(id) {
  document.getElementById(id).classList.remove('open');
  if (!document.querySelector('.sheet.open')) document.getElementById('overlay').classList.remove('open');
  if (id === 'entrySheet') { editingId = null; document.getElementById('entryForm').reset(); }
}

// ── Bind events ──

function bindEvents() {
  document.getElementById('fabBtn').addEventListener('click', () => {
    selectedDate = todayISO();
    openAddSheet();
  });

  document.getElementById('jumpDate').addEventListener('change', function() {
    if (!this.value) return;
    const dateStr = this.value;
    this.value = ''; // reset so it can be picked again
    const el = document.querySelector(`.cal-date-row[data-date="${dateStr}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => openDaySheet(dateStr), 350);
    } else {
      openDaySheet(dateStr);
    }
  });

  document.getElementById('addEntryBtn').addEventListener('click', () => {
    closeSheet('daySheet');
    openAddSheet();
  });

  document.getElementById('closeDaySheetBtn').addEventListener('click', () => closeSheet('daySheet'));
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
}
