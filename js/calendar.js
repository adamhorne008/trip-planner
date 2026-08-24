// ============================================================
// calendar.js — The Ridings (scrollable list view)
// ============================================================

let currentUser = 'Adam';
let selectedDate = null;
let editingId = null;
let allEntries = [];

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
  return allEntries
    .filter(e => e.date === dateStr)
    .sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
}

function buildDateRange() {
  const today = todayISO();
  const start = addDays(today, -(MONTHS_BACK * 31));
  const end   = addDays(today,  (MONTHS_FORWARD * 31));
  const dates = [];
  let cur = start;
  while (cur <= end) { dates.push(cur); cur = addDays(cur, 1); }
  return dates;
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return (hr % 12 || 12) + ':' + m + (hr < 12 ? 'am' : 'pm');
}

function renderList() {
  const container = document.getElementById('calList');
  const today = todayISO();
  const dates = buildDateRange();

  const months = {};
  for (const d of dates) {
    const key = d.slice(0, 7);
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
      const dayName  = dt.toLocaleDateString('en-GB', { weekday: 'short' });
      const dayNum   = dt.getDate();
      const isToday   = d === today;
      const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;

      const entriesHtml = entries.map(e => {
        const who = (e.created_by || 'adam').toLowerCase();
        const timeStr = e.time ? `<span class="cal-inline-time">${formatTime(e.time)}</span>` : '';
        return `<div class="cal-inline-entry cal-inline-entry--${who}" data-id="${e.id}">
          ${timeStr}<span class="cal-inline-title">${e.title}</span>
        </div>`;
      }).join('');

      html += `
        <div class="cal-date-row${isToday ? ' cal-date-row--today' : ''}${isWeekend ? ' cal-date-row--weekend' : ''}" data-date="${d}">
          <div class="cal-date-row__left">
            <span class="cal-date-row__num${isToday ? ' cal-date-row__num--today' : ''}">${dayNum}</span>
            <span class="cal-date-row__day">${dayName}</span>
          </div>
          <div class="cal-date-row__entries">
            ${entriesHtml}
          </div>
          <button class="cal-add-btn" data-date="${d}" title="Add entry">+</button>
        </div>`;
    }
  }

  container.innerHTML = html;

  // Tap inline entry → open detail
  container.querySelectorAll('.cal-inline-entry[data-id]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      openDetail(el.dataset.id);
    });
  });

  // Tap date row (not entry/button) → open day sheet
  container.querySelectorAll('.cal-date-row').forEach(row => {
    row.addEventListener('click', () => openDaySheet(row.dataset.date));
  });

  // Tap + button → open add sheet for that date
  container.querySelectorAll('.cal-add-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      selectedDate = btn.dataset.date;
      openAddSheet();
    });
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
    <div class="cal-card cal-card--${(e.created_by||'adam').toLowerCase()}" data-id="${e.id}" style="cursor:pointer;">
      <div class="cal-card__header">
        <div>
          ${e.time ? `<div style="font-size:11px;color:var(--muted);margin-bottom:2px;">${formatTime(e.time)}</div>` : ''}
          <div class="cal-card__title">${e.title}</div>
        </div>
        <span class="author-tag author-tag--${(e.created_by||'adam').toLowerCase()}">${e.created_by || ''}</span>
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
    <div style="margin-bottom:10px;display:flex;align-items:center;gap:8px;">
      <span class="author-tag author-tag--${(e.created_by||'adam').toLowerCase()}">${e.created_by || ''}</span>
      ${e.time ? `<span style="font-size:13px;color:var(--muted);">${formatTime(e.time)}</span>` : ''}
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
  document.getElementById('entryDate').value = selectedDate;
  document.getElementById('entryPerson').value = currentUser;
  openSheet('entrySheet');
}

async function openEditSheet(id) {
  const e = allEntries.find(x => x.id === id);
  if (!e) return;
  editingId = id;
  document.getElementById('sheetTitle').textContent = 'Edit entry';
  document.getElementById('entryDate').value   = e.date;
  document.getElementById('entryTitle').value  = e.title;
  document.getElementById('entryPerson').value = e.created_by || currentUser;
  document.getElementById('entryTime').value   = e.time || '';
  document.getElementById('entryNotes').value  = e.notes || '';
  openSheet('entrySheet');
}

async function saveEntry(ev) {
  ev.preventDefault();
  const btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  const date = document.getElementById('entryDate').value || selectedDate;
  if (!date) { alert('No date selected — please close and try again.'); btn.disabled = false; btn.textContent = 'Save'; return; }
  const payload = {
    date,
    title:      document.getElementById('entryTitle').value.trim(),
    created_by: document.getElementById('entryPerson').value,
    time:       document.getElementById('entryTime').value || null,
    notes:      document.getElementById('entryNotes').value.trim() || null,
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
  if (selectedDate) renderDaySheetEntries(selectedDate);
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

// ── Month grid view ──

let gridVisible = false;
let gridYear  = new Date().getFullYear();
let gridMonth = new Date().getMonth(); // 0-based

function toggleGrid() {
  gridVisible = !gridVisible;
  const panel = document.getElementById('calGridPanel');
  const btn   = document.getElementById('calGridToggle');
  if (gridVisible) {
    const today = new Date();
    gridYear  = today.getFullYear();
    gridMonth = today.getMonth();
    panel.style.display = '';
    btn.classList.add('active');
    renderGrid();
  } else {
    panel.style.display = 'none';
    btn.classList.remove('active');
    scrollToToday();
  }
}

function renderGrid() {
  const label = document.getElementById('gridMonthLabel');
  const grid  = document.getElementById('calGridDays');
  const today = todayISO();

  const monthDate = new Date(gridYear, gridMonth, 1);
  label.textContent = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // Mon=0 … Sun=6
  const startDow = (monthDate.getDay() + 6) % 7;
  const daysInMonth = new Date(gridYear, gridMonth + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < startDow; i++) {
    html += '<div class="cal-grid-cell cal-grid-cell--empty"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = gridYear + '-' +
      String(gridMonth + 1).padStart(2, '0') + '-' +
      String(d).padStart(2, '0');
    const entries = entriesForDate(dateStr);
    const isToday = dateStr === today;
    const people  = [...new Set(entries.map(e => (e.created_by || 'adam').toLowerCase()))].slice(0, 3);
    const dots    = people.map(w => `<span class="cal-dot cal-dot--${w}"></span>`).join('');
    html += `<div class="cal-grid-cell${isToday ? ' cal-grid-cell--today' : ''}" data-date="${dateStr}">
      <span class="cal-grid-cell__num">${d}</span>
      <div class="cal-grid-cell__dots">${dots}</div>
    </div>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.cal-grid-cell[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      const dateStr = el.dataset.date;
      toggleGrid();
      const row = document.querySelector(`.cal-date-row[data-date="${dateStr}"]`);
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => openDaySheet(dateStr), 300);
      } else {
        openDaySheet(dateStr);
      }
    });
  });
}

// ── Bind events ──

function bindEvents() {
  document.getElementById('fabBtn').addEventListener('click', () => {
    selectedDate = todayISO();
    openAddSheet();
  });

  document.getElementById('calGridToggle').addEventListener('click', toggleGrid);

  document.getElementById('gridPrevBtn').addEventListener('click', () => {
    gridMonth--;
    if (gridMonth < 0) { gridMonth = 11; gridYear--; }
    renderGrid();
  });
  document.getElementById('gridNextBtn').addEventListener('click', () => {
    gridMonth++;
    if (gridMonth > 11) { gridMonth = 0; gridYear++; }
    renderGrid();
  });

  document.getElementById('addEntryBtn').addEventListener('click', () => {
    const date = selectedDate;
    closeSheet('daySheet');
    selectedDate = date; // preserve after closeSheet
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
