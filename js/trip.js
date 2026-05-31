// ============================================================
// trip.js — Day view logic
// ============================================================

const DATES = getTripDates();
let currentDate = '';
let swipeStartX = 0, swipeStartY = 0;
let editingId = null, editingType = null;

// ── Init ──────────────────────────────────────────────────
(async () => {
  await requireAuth();
  const params = new URLSearchParams(window.location.search);
  let date = params.get('date');
  if (!DATES.includes(date)) date = TRIP_START;
  currentDate = date;
  buildDots();
  renderHeader();
  await Promise.all([loadDay(), loadLocation()]);
  bindEvents();
})();

// ── Navigation ────────────────────────────────────────────
function dayIndex() { return DATES.indexOf(currentDate); }

async function goToDate(date, direction) {
  currentDate = date;
  history.replaceState({}, '', '/trip?date=' + date);
  renderHeader();
  await Promise.all([loadDay(direction), loadLocation()]);
}

function renderHeader() {
  const idx = dayIndex();
  document.getElementById('dayTitle').textContent = formatDateShort(currentDate);
  document.getElementById('daySubtitle').textContent = `Day ${idx + 1} of ${DATES.length}`;
  document.getElementById('prevBtn').disabled = (idx === 0);
  document.getElementById('nextBtn').disabled = (idx === DATES.length - 1);
  document.querySelectorAll('.day-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === idx);
  });
}

function buildDots() {
  const container = document.getElementById('dayDots');
  DATES.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'day-dot';
    dot.title = formatDateShort(DATES[i]);
    dot.addEventListener('click', () => goToDate(DATES[i], i > dayIndex() ? 'right' : 'left'));
    container.appendChild(dot);
  });
}

// ── Load day ──────────────────────────────────────────────
async function loadDay(direction) {
  const content = document.getElementById('dayContent');
  content.innerHTML = '<div class="spinner"></div>';

  const [entriesRes, accomRes, locRes] = await Promise.all([
    db.from('calendar_entries').select('*').eq('date', currentDate)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    db.from('accommodations').select('*')
      .lte('check_in_date', currentDate)
      .gte('check_out_date', currentDate),
    db.from('day_locations').select('location').eq('date', currentDate).maybeSingle()
  ]);

  if (entriesRes.error) {
    content.innerHTML = `<p style="color:var(--muted);padding:20px">${entriesRes.error.message}</p>`;
    return;
  }

  // If a location is set for today, fetch shortlist items matching it
  let nearbyItems = [];
  const dayLocation = locRes.data?.location?.trim();
  if (dayLocation) {
    const { data: shortlist } = await db
      .from('shortlist_items')
      .select('*')
      .ilike('location', `%${dayLocation}%`)
      .order('created_at', { ascending: false });
    nearbyItems = shortlist || [];
  }

  renderEntries(entriesRes.data || [], accomRes.data || [], nearbyItems, direction);
}

// ── Render ────────────────────────────────────────────────
function renderEntries(entries, accommodations, nearbyItems, direction) {
  const content = document.getElementById('dayContent');

  if (!entries.length && !accommodations.length && !nearbyItems.length) {
    content.innerHTML = `
      <div class="empty-day">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p>Nothing planned yet.<br/>Tap + to add something.</p>
      </div>`;
    animateContent(content, direction);
    return;
  }

  const order  = ['travel', 'game', 'activity', 'note'];
  const labels = { travel: '✈️ Travel', game: '⚽ Games', activity: '🎯 Activities', note: '📝 Notes' };
  const groups = {};
  order.forEach(t => groups[t] = []);
  entries.forEach(e => { if (groups[e.type]) groups[e.type].push(e); });

  let html = '';

  if (accommodations.length) {
    html += `<div class="section-header">🏨 Accommodation</div>`;
    accommodations.forEach(a => { html += buildAccomCard(a); });
  }

  order.forEach(type => {
    if (!groups[type].length) return;
    html += `<div class="section-header">${labels[type]}</div>`;
    groups[type].forEach(e => { html += buildEntryCard(e); });
  });

  // Nearby shortlist section
  if (nearbyItems.length) {
    html += `<div class="nearby-shortlist">
      <div class="nearby-shortlist__header">💡 Shortlist ideas nearby</div>
      ${nearbyItems.map(item => `
        <div class="nearby-shortlist__item">
          <div>
            <div class="nearby-shortlist__name">${item.name}</div>
            <div class="nearby-shortlist__meta">${item.location ? `📍 ${item.location}` : ''}${item.link ? ` · <a href="${item.link}" target="_blank" rel="noopener" style="color:var(--accent2)">Link ↗</a>` : ''}</div>
          </div>
          <button class="nearby-shortlist__add" data-item-id="${item.id}">＋ Add</button>
        </div>`).join('')}
    </div>`;
  }

  content.innerHTML = html;
  animateContent(content, direction);

  content.querySelectorAll('.entry-card[data-id]').forEach(card => {
    card.addEventListener('click', () => openDetailSheet(card.dataset.id, 'entry'));
  });
  content.querySelectorAll('.accom-card[data-id]').forEach(card => {
    card.addEventListener('click', () => openDetailSheet(card.dataset.id, 'accom'));
  });
  content.querySelectorAll('.nearby-shortlist__add').forEach(btn => {
    btn.addEventListener('click', () => assignNearbyItem(btn.dataset.itemId));
  });
}

function animateContent(content, direction) {
  if (!direction) return;
  content.classList.add(`slide-in-${direction}`);
  setTimeout(() => content.classList.remove(`slide-in-${direction}`), 300);
}

function buildAccomCard(a) {
  return `
    <div class="accom-card" data-id="${a.id}">
      <div class="accom-card__label">Accommodation</div>
      <div class="accom-card__name">${a.name}</div>
      ${a.location ? `<div class="accom-card__location">📍 ${a.location}</div>` : ''}
    </div>`;
}

function buildEntryCard(e) {
  const d = e.details || {};
  let meta = '';
  switch (e.type) {
    case 'travel':
      if (d.mode) meta += `<strong>${d.mode}</strong>`;
      if (d.from || d.to) meta += ` · ${d.from || '?'} → ${d.to || '?'}`;
      if (d.departure_time || d.arrival_time) meta += `<br/>${d.departure_time || ''} → ${d.arrival_time || ''}`;
      if (d.confirmation) meta += `<br/>Ref: ${d.confirmation}`;
      break;
    case 'game':
      if (d.home_team && d.away_team) meta += `<strong>${d.home_team} vs ${d.away_team}</strong>`;
      if (d.venue) meta += `<br/>${d.venue}${d.city ? ', ' + d.city : ''}`;
      if (d.kickoff_time) meta += `<br/>Kick-off: ${d.kickoff_time}`;
      break;
    case 'activity':
      if (d.location) meta += d.location;
      if (d.description) meta += (meta ? '<br/>' : '') + d.description;
      break;
    case 'note':
      if (d.content) meta += d.content;
      break;
  }
  return `
    <div class="entry-card" data-type="${e.type}" data-id="${e.id}">
      <div class="entry-card__type">${e.type}</div>
      <div class="entry-card__title">${e.title}</div>
      ${meta ? `<div class="entry-card__meta">${meta}</div>` : ''}
    </div>`;
}

// ── Detail sheet ──────────────────────────────────────────
async function openDetailSheet(id, source) {
  let html = '';

  if (source === 'accom') {
    const { data: a } = await db.from('accommodations').select('*').eq('id', id).single();
    if (!a) return;
    document.getElementById('detailTitle').textContent = a.name;
    html += detailRow('🏨 Accommodation', true, 'var(--accommodation)');
    if (a.location) html += detailRow(`📍 ${a.location}`);
    html += detailRow(`Check-in: <strong>${formatDateShort(a.check_in_date)}${a.check_in_time ? ' at ' + a.check_in_time : ''}</strong>`);
    html += detailRow(`Check-out: <strong>${formatDateShort(a.check_out_date)}${a.check_out_time ? ' at ' + a.check_out_time : ''}</strong>`);
    if (a.link) html += detailRow(`<a href="${a.link}" target="_blank" rel="noopener" style="color:var(--accent2);text-decoration:underline;">Booking link ↗</a>`);
  } else {
    const { data: e } = await db.from('calendar_entries').select('*').eq('id', id).single();
    if (!e) return;
    const d = e.details || {};
    const typeColor = { travel: 'var(--travel)', game: 'var(--game)', activity: 'var(--activity)', note: 'var(--muted)' };
    document.getElementById('detailTitle').textContent = e.title;
    html += detailRow(e.type, true, typeColor[e.type] || 'var(--muted)');
    switch (e.type) {
      case 'travel':
        if (d.mode) html += detailRow(`Mode: <strong>${d.mode}</strong>`);
        if (d.from || d.to) html += detailRow(`${d.from || '?'} → ${d.to || '?'}`);
        if (d.departure_time) html += detailRow(`Departs: <strong>${d.departure_time}</strong>`);
        if (d.arrival_time)   html += detailRow(`Arrives: <strong>${d.arrival_time}</strong>`);
        if (d.confirmation)   html += detailRow(`Ref: <strong>${d.confirmation}</strong>`);
        if (d.link) html += detailRow(`<a href="${d.link}" target="_blank" rel="noopener" style="color:var(--accent2);text-decoration:underline;">Booking link ↗</a>`);
        break;
      case 'game':
        if (d.home_team && d.away_team) html += detailRow(`<strong>${d.home_team} vs ${d.away_team}</strong>`);
        if (d.venue) html += detailRow(`📍 ${d.venue}${d.city ? ', ' + d.city : ''}`);
        if (d.kickoff_time) html += detailRow(`Kick-off: <strong>${d.kickoff_time}</strong>`);
        if (d.ticket_ref)   html += detailRow(`Ticket: <strong>${d.ticket_ref}</strong>`);
        break;
      case 'activity':
        if (d.location)    html += detailRow(`📍 ${d.location}`);
        if (d.description) html += detailRow(d.description);
        if (d.link) html += detailRow(`<a href="${d.link}" target="_blank" rel="noopener" style="color:var(--accent2);text-decoration:underline;">More info ↗</a>`);
        break;
      case 'note':
        if (d.content) html += detailRow(d.content);
        break;
    }
  }

  document.getElementById('detailBody').innerHTML = html;
  document.getElementById('detailDeleteBtn').dataset.id     = id;
  document.getElementById('detailDeleteBtn').dataset.source = source;
  document.getElementById('detailEditBtn').dataset.id       = id;
  document.getElementById('detailEditBtn').dataset.source   = source;
  openSheet('detailSheet');
}

function detailRow(html, isLabel = false, color = '') {
  const style = isLabel
    ? `font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${color};margin-bottom:10px;`
    : 'font-size:14px;color:var(--text);margin-bottom:8px;line-height:1.5;';
  return `<div style="${style}">${html}</div>`;
}

// ── Delete ────────────────────────────────────────────────
async function deleteEntry(id, source) {
  if (!confirm('Delete this item?')) return;
  const table = source === 'accom' ? 'accommodations' : 'calendar_entries';
  await db.from(table).delete().eq('id', id);
  closeSheet('detailSheet');
  await loadDay();
}

// ── Assign nearby shortlist item to today ─────────────────
async function assignNearbyItem(itemId) {
  const { data: item } = await db.from('shortlist_items').select('*').eq('id', itemId).single();
  if (!item) return;
  const { error } = await db.from('calendar_entries').insert({
    date:    currentDate,
    type:    'activity',
    title:   item.name,
    details: { location: item.location || '', link: item.link || '' },
  });
  if (error) { alert(error.message); return; }
  await db.from('shortlist_items').delete().eq('id', itemId);
  await loadDay();
}

// ── Edit from detail ──────────────────────────────────────
async function editFromDetail(id, source) {
  closeSheet('detailSheet');
  if (source === 'accom') {
    const { data: a } = await db.from('accommodations').select('*').eq('id', id).single();
    if (!a) return;
    editingId = id; editingType = 'accom';
    document.getElementById('sheetTitle').textContent = 'Edit accommodation';
    document.getElementById('entryId').value    = id;
    document.getElementById('entryType').value  = 'accommodation';
    document.getElementById('entryTitle').value = a.name;
    showTypeFields('accommodation');
    setVal('accomLocation',    a.location);
    setVal('accomCheckinDate', a.check_in_date);
    setVal('accomCheckoutDate',a.check_out_date);
    setVal('accomCheckinTime', a.check_in_time);
    setVal('accomCheckoutTime',a.check_out_time);
    setVal('accomLink',        a.link);
    openSheet('entrySheet');
  } else {
    openEditSheet(id);
  }
}

async function openEditSheet(id) {
  const { data: entry } = await db.from('calendar_entries').select('*').eq('id', id).single();
  if (!entry) return;
  editingId = id; editingType = 'entry';
  document.getElementById('sheetTitle').textContent = 'Edit entry';
  document.getElementById('entryId').value    = id;
  document.getElementById('entryType').value  = entry.type;
  document.getElementById('entryTitle').value = entry.title;
  showTypeFields(entry.type);
  const d = entry.details || {};
  switch (entry.type) {
    case 'travel':
      setVal('travelMode', d.mode); setVal('travelFrom', d.from); setVal('travelTo', d.to);
      setVal('travelDep', d.departure_time); setVal('travelArr', d.arrival_time);
      setVal('travelRef', d.confirmation);   setVal('travelLink', d.link);
      break;
    case 'game':
      setVal('gameHome', d.home_team); setVal('gameAway', d.away_team);
      setVal('gameVenue', d.venue);    setVal('gameCity', d.city);
      setVal('gameKickoff', d.kickoff_time); setVal('gameTicket', d.ticket_ref);
      break;
    case 'activity':
      setVal('actLocation', d.location); setVal('actDescription', d.description);
      setVal('actLink', d.link);
      break;
    case 'note':
      setVal('noteContent', d.content);
      break;
  }
  openSheet('entrySheet');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

// ── Save entry ────────────────────────────────────────────
async function saveEntry(e) {
  e.preventDefault();
  const btn  = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const type  = document.getElementById('entryType').value;
  const title = document.getElementById('entryTitle').value.trim();
  let error;

  if (type === 'accommodation') {
    const payload = {
      name:           title,
      location:       document.getElementById('accomLocation').value.trim(),
      check_in_date:  document.getElementById('accomCheckinDate').value,
      check_out_date: document.getElementById('accomCheckoutDate').value,
      check_in_time:  document.getElementById('accomCheckinTime').value,
      check_out_time: document.getElementById('accomCheckoutTime').value,
      link:           document.getElementById('accomLink').value.trim(),
    };
    if (editingId && editingType === 'accom') {
      ({ error } = await db.from('accommodations').update(payload).eq('id', editingId));
    } else {
      ({ error } = await db.from('accommodations').insert(payload));
    }
  } else {
    let details = {};
    switch (type) {
      case 'travel':
        details = { mode: document.getElementById('travelMode').value, from: document.getElementById('travelFrom').value, to: document.getElementById('travelTo').value, departure_time: document.getElementById('travelDep').value, arrival_time: document.getElementById('travelArr').value, confirmation: document.getElementById('travelRef').value, link: document.getElementById('travelLink').value }; break;
      case 'game':
        details = { home_team: document.getElementById('gameHome').value, away_team: document.getElementById('gameAway').value, venue: document.getElementById('gameVenue').value, city: document.getElementById('gameCity').value, kickoff_time: document.getElementById('gameKickoff').value, ticket_ref: document.getElementById('gameTicket').value }; break;
      case 'activity':
        details = { location: document.getElementById('actLocation').value, description: document.getElementById('actDescription').value, link: document.getElementById('actLink').value }; break;
      case 'note':
        details = { content: document.getElementById('noteContent').value }; break;
    }
    const payload = { type, title, details, date: currentDate };
    if (editingId && editingType === 'entry') {
      ({ error } = await db.from('calendar_entries').update(payload).eq('id', editingId));
    } else {
      ({ error } = await db.from('calendar_entries').insert(payload));
    }
  }

  btn.disabled = false; btn.textContent = 'Save';
  if (error) { alert(error.message); return; }
  closeSheet('entrySheet');
  await loadDay();
}

// ── Sheets ────────────────────────────────────────────────
function openSheet(sheetId) {
  document.getElementById('overlay').classList.add('open');
  document.getElementById(sheetId).classList.add('open');
}

function closeSheet(sheetId) {
  document.getElementById(sheetId).classList.remove('open');
  if (sheetId === 'entrySheet') {
    document.getElementById('entryForm').reset();
    showTypeFields('activity');
    editingId = null; editingType = null;
    document.getElementById('sheetTitle').textContent = 'Add to day';
    document.getElementById('entryId').value = '';
  }
  // Hide overlay if no sheets are open
  const anyOpen = document.querySelector('.sheet.open');
  if (!anyOpen) document.getElementById('overlay').classList.remove('open');
}

function showTypeFields(type) {
  document.querySelectorAll('.type-fields').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`fields-${type}`);
  if (el) el.classList.add('active');
}

// ── Location ──────────────────────────────────────────────
async function loadLocation() {
  const { data } = await db.from('day_locations').select('location').eq('date', currentDate).maybeSingle();
  const textEl = document.getElementById('locationText');
  if (data && data.location) {
    textEl.textContent = data.location;
    textEl.classList.remove('empty');
  } else {
    textEl.textContent = 'Tap to set location';
    textEl.classList.add('empty');
  }
}

async function saveLocation() {
  const location = document.getElementById('locationInput').value.trim();
  const btn = document.getElementById('saveLocationBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  await db.from('day_locations').upsert({ date: currentDate, location }, { onConflict: 'date' });
  btn.disabled = false; btn.textContent = 'Save';
  closeSheet('locationSheet');
  await loadLocation();
}

// ── Swipe ─────────────────────────────────────────────────
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

// ── Bind events ───────────────────────────────────────────
function bindEvents() {
  document.getElementById('prevBtn').addEventListener('click', () => {
    const idx = dayIndex(); if (idx > 0) goToDate(DATES[idx - 1], 'left');
  });
  document.getElementById('nextBtn').addEventListener('click', () => {
    const idx = dayIndex(); if (idx < DATES.length - 1) goToDate(DATES[idx + 1], 'right');
  });

  document.getElementById('fabBtn').addEventListener('click', () => {
    editingId = null; editingType = null;
    document.getElementById('sheetTitle').textContent = 'Add to day';
    showTypeFields(document.getElementById('entryType').value);
    openSheet('entrySheet');
  });

  document.getElementById('cancelBtn').addEventListener('click', () => closeSheet('entrySheet'));
  document.getElementById('entryForm').addEventListener('submit', saveEntry);
  document.getElementById('entryType').addEventListener('change', e => showTypeFields(e.target.value));

  document.getElementById('detailDeleteBtn').addEventListener('click', function() {
    deleteEntry(this.dataset.id, this.dataset.source);
  });
  document.getElementById('detailEditBtn').addEventListener('click', function() {
    editFromDetail(this.dataset.id, this.dataset.source);
  });
  document.getElementById('detailCloseBtn').addEventListener('click', () => closeSheet('detailSheet'));

  document.getElementById('locationBar').addEventListener('click', () => {
    const isEmpty = document.getElementById('locationText').classList.contains('empty');
    document.getElementById('locationInput').value = isEmpty ? '' : document.getElementById('locationText').textContent;
    openSheet('locationSheet');
  });
  document.getElementById('cancelLocationBtn').addEventListener('click', () => closeSheet('locationSheet'));
  document.getElementById('saveLocationBtn').addEventListener('click', saveLocation);

  document.getElementById('overlay').addEventListener('click', () => {
    document.querySelectorAll('.sheet.open').forEach(s => {
      closeSheet(s.id);
    });
  });

  bindSwipe();
}
