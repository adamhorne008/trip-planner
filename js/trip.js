// ============================================================
// trip.js — Day view logic
// ============================================================

const DATES = getTripDates(); // from supabase-client.js

let currentDate = '';
let swipeStartX = 0;
let swipeStartY = 0;
let editingId   = null;

// ── Init ──────────────────────────────────────────────────
(async () => {
  await requireAuth();

  const params = new URLSearchParams(window.location.search);
  let date = params.get('date');
  if (!DATES.includes(date)) date = TRIP_START;
  currentDate = date;

  buildDots();
  renderHeader();
  await loadDay();
  bindEvents();
})();

// ── Date navigation ───────────────────────────────────────
function dayIndex() { return DATES.indexOf(currentDate); }

async function goToDate(date, direction) {
  currentDate = date;
  history.replaceState({}, '', '/trip?date=' + date);
  renderHeader();
  await loadDay(direction);
}

function renderHeader() {
  const idx = dayIndex();
  document.getElementById('dayTitle').textContent = formatDateShort(currentDate);
  document.getElementById('daySubtitle').textContent =
    `Day ${idx + 1} of ${DATES.length}`;

  document.getElementById('prevBtn').disabled = (idx === 0);
  document.getElementById('nextBtn').disabled = (idx === DATES.length - 1);

  // Highlight active dot
  document.querySelectorAll('.day-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === idx);
  });
}

function buildDots() {
  const container = document.getElementById('dayDots');
  DATES.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'day-dot';
    dot.dataset.index = i;
    dot.title = formatDateShort(DATES[i]);
    dot.addEventListener('click', () => goToDate(DATES[i], i > dayIndex() ? 'right' : 'left'));
    container.appendChild(dot);
  });
}

// ── Load entries for a day ────────────────────────────────
async function loadDay(direction) {
  const content = document.getElementById('dayContent');
  content.innerHTML = '<div class="spinner"></div>';

  const { data: entries, error } = await db
    .from('calendar_entries')
    .select('*')
    .eq('date', currentDate)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    content.innerHTML = `<p style="color:var(--muted);padding:20px">${error.message}</p>`;
    return;
  }

  renderEntries(entries, direction);
  updateDotStates(entries);
}

function updateDotStates(entries) {
  // Mark dots that have content
  const dateSet = new Set();
  // We only know current date's entries; for dots we do a bulk check once
}

function renderEntries(entries, direction) {
  const content = document.getElementById('dayContent');
  if (!entries.length) {
    content.innerHTML = `
      <div class="empty-day">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8"  y1="2" x2="8"  y2="6"/>
          <line x1="3"  y1="10" x2="21" y2="10"/>
        </svg>
        <p>Nothing planned yet.<br/>Tap + to add something.</p>
      </div>`;
    if (direction) content.classList.add(`slide-in-${direction}`);
    setTimeout(() => content.classList.remove(`slide-in-${direction}`), 300);
    return;
  }

  // Group by type in this order
  const order = ['accommodation', 'travel', 'game', 'activity', 'note'];
  const groups = {};
  order.forEach(t => groups[t] = []);
  entries.forEach(e => { if (groups[e.type]) groups[e.type].push(e); });

  const labels = {
    accommodation: '🏨 Accommodation',
    travel:        '✈️ Travel',
    game:          '⚽ Games',
    activity:      '🎯 Activities',
    note:          '📝 Notes',
  };

  let html = '';
  order.forEach(type => {
    if (!groups[type].length) return;
    html += `<div class="section-header">${labels[type]}</div>`;
    groups[type].forEach(e => { html += buildEntryCard(e); });
  });

  content.innerHTML = html;
  if (direction) {
    content.classList.add(`slide-in-${direction}`);
    setTimeout(() => content.classList.remove(`slide-in-${direction}`), 300);
  }

  // Bind card action buttons
  content.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openEditSheet(btn.dataset.id));
  });
  content.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deleteEntry(btn.dataset.id));
  });
}

function buildEntryCard(e) {
  const d = e.details || {};
  let meta = '';

  switch (e.type) {
    case 'travel':
      meta += d.mode ? `<strong>${d.mode}</strong>` : '';
      if (d.from || d.to) meta += ` · ${d.from || '?'} → ${d.to || '?'}`;
      if (d.departure_time || d.arrival_time)
        meta += `<br/>${d.departure_time || ''} → ${d.arrival_time || ''}`;
      if (d.confirmation) meta += `<br/>Ref: ${d.confirmation}`;
      if (d.link) meta += `<br/><a href="${d.link}" target="_blank" rel="noopener">Booking link</a>`;
      break;
    case 'game':
      if (d.home_team && d.away_team)
        meta += `<strong>${d.home_team} vs ${d.away_team}</strong>`;
      if (d.venue)  meta += `<br/>${d.venue}${d.city ? ', ' + d.city : ''}`;
      if (d.kickoff_time) meta += `<br/>Kick-off: ${d.kickoff_time}`;
      if (d.ticket_ref)   meta += `<br/>Ticket: ${d.ticket_ref}`;
      break;
    case 'activity':
      if (d.location)    meta += d.location;
      if (d.description) meta += (meta ? '<br/>' : '') + d.description;
      if (d.link) meta += `<br/><a href="${d.link}" target="_blank" rel="noopener">More info</a>`;
      break;
    case 'accommodation':
      if (d.location) meta += d.location;
      if (d.check_in || d.check_out)
        meta += `<br/>In: ${d.check_in || '—'} · Out: ${d.check_out || '—'}`;
      if (d.link) meta += `<br/><a href="${d.link}" target="_blank" rel="noopener">Booking link</a>`;
      break;
    case 'note':
      if (d.content) meta += d.content;
      break;
  }

  return `
    <div class="entry-card" data-type="${e.type}">
      <div class="entry-card__type">${e.type}</div>
      <div class="entry-card__title">${e.title}</div>
      ${meta ? `<div class="entry-card__meta">${meta}</div>` : ''}
      <div class="entry-card__actions">
        <button data-action="edit"   data-id="${e.id}">Edit</button>
        <button data-action="delete" data-id="${e.id}" class="danger">Delete</button>
      </div>
    </div>`;
}

// ── Delete ────────────────────────────────────────────────
async function deleteEntry(id) {
  if (!confirm('Delete this item?')) return;
  await db.from('calendar_entries').delete().eq('id', id);
  await loadDay();
}

// ── Sheet open/close ──────────────────────────────────────
function openSheet() {
  document.getElementById('overlay').classList.add('open');
  document.getElementById('entrySheet').classList.add('open');
}

function closeSheet() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('entrySheet').classList.remove('open');
  document.getElementById('entryForm').reset();
  showTypeFields('activity');
  editingId = null;
  document.getElementById('sheetTitle').textContent = 'Add to day';
  document.getElementById('entryId').value = '';
}

function showTypeFields(type) {
  document.querySelectorAll('.type-fields').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`fields-${type}`);
  if (el) el.classList.add('active');
}

// ── Open edit sheet ───────────────────────────────────────
async function openEditSheet(id) {
  const { data: entry } = await db.from('calendar_entries').select('*').eq('id', id).single();
  if (!entry) return;

  editingId = id;
  document.getElementById('sheetTitle').textContent = 'Edit entry';
  document.getElementById('entryId').value = id;
  document.getElementById('entryType').value = entry.type;
  document.getElementById('entryTitle').value = entry.title;
  showTypeFields(entry.type);

  const d = entry.details || {};
  switch (entry.type) {
    case 'travel':
      setVal('travelMode', d.mode);
      setVal('travelFrom', d.from);
      setVal('travelTo',   d.to);
      setVal('travelDep',  d.departure_time);
      setVal('travelArr',  d.arrival_time);
      setVal('travelRef',  d.confirmation);
      setVal('travelLink', d.link);
      break;
    case 'game':
      setVal('gameHome',    d.home_team);
      setVal('gameAway',    d.away_team);
      setVal('gameVenue',   d.venue);
      setVal('gameCity',    d.city);
      setVal('gameKickoff', d.kickoff_time);
      setVal('gameTicket',  d.ticket_ref);
      break;
    case 'activity':
      setVal('actLocation',    d.location);
      setVal('actDescription', d.description);
      setVal('actLink',        d.link);
      break;
    case 'accommodation':
      setVal('accomLocation', d.location);
      setVal('accomCheckin',  d.check_in);
      setVal('accomCheckout', d.check_out);
      setVal('accomLink',     d.link);
      break;
    case 'note':
      setVal('noteContent', d.content);
      break;
  }

  openSheet();
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

// ── Save entry ────────────────────────────────────────────
async function saveEntry(e) {
  e.preventDefault();
  const btn  = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const type  = document.getElementById('entryType').value;
  const title = document.getElementById('entryTitle').value.trim();
  let details = {};

  switch (type) {
    case 'travel':
      details = {
        mode:           document.getElementById('travelMode').value,
        from:           document.getElementById('travelFrom').value,
        to:             document.getElementById('travelTo').value,
        departure_time: document.getElementById('travelDep').value,
        arrival_time:   document.getElementById('travelArr').value,
        confirmation:   document.getElementById('travelRef').value,
        link:           document.getElementById('travelLink').value,
      };
      break;
    case 'game':
      details = {
        home_team:    document.getElementById('gameHome').value,
        away_team:    document.getElementById('gameAway').value,
        venue:        document.getElementById('gameVenue').value,
        city:         document.getElementById('gameCity').value,
        kickoff_time: document.getElementById('gameKickoff').value,
        ticket_ref:   document.getElementById('gameTicket').value,
      };
      break;
    case 'activity':
      details = {
        location:    document.getElementById('actLocation').value,
        description: document.getElementById('actDescription').value,
        link:        document.getElementById('actLink').value,
      };
      break;
    case 'accommodation':
      details = {
        location:  document.getElementById('accomLocation').value,
        check_in:  document.getElementById('accomCheckin').value,
        check_out: document.getElementById('accomCheckout').value,
        link:      document.getElementById('accomLink').value,
      };
      break;
    case 'note':
      details = { content: document.getElementById('noteContent').value };
      break;
  }

  const payload = { type, title, details, date: currentDate };

  let error;
  if (editingId) {
    ({ error } = await db.from('calendar_entries').update(payload).eq('id', editingId));
  } else {
    ({ error } = await db.from('calendar_entries').insert(payload));
  }

  btn.disabled = false;
  btn.textContent = 'Save';

  if (error) { alert(error.message); return; }

  closeSheet();
  await loadDay();
}

// ── Swipe handling ────────────────────────────────────────
function bindSwipe() {
  const container = document.getElementById('swipeContainer');
  container.addEventListener('touchstart', e => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    const idx = dayIndex();
    if (dx < 0 && idx < DATES.length - 1) goToDate(DATES[idx + 1], 'right');
    if (dx > 0 && idx > 0)               goToDate(DATES[idx - 1], 'left');
  }, { passive: true });
}

// ── Bind all events ───────────────────────────────────────
function bindEvents() {
  document.getElementById('prevBtn').addEventListener('click', () => {
    const idx = dayIndex();
    if (idx > 0) goToDate(DATES[idx - 1], 'left');
  });
  document.getElementById('nextBtn').addEventListener('click', () => {
    const idx = dayIndex();
    if (idx < DATES.length - 1) goToDate(DATES[idx + 1], 'right');
  });

  document.getElementById('fabBtn').addEventListener('click', () => {
    editingId = null;
    document.getElementById('sheetTitle').textContent = 'Add to day';
    showTypeFields(document.getElementById('entryType').value);
    openSheet();
  });

  document.getElementById('cancelBtn').addEventListener('click', closeSheet);
  document.getElementById('overlay').addEventListener('click', closeSheet);
  document.getElementById('entryForm').addEventListener('submit', saveEntry);

  document.getElementById('entryType').addEventListener('change', e => {
    showTypeFields(e.target.value);
  });

  bindSwipe();
}
