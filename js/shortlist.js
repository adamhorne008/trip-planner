// ============================================================
// shortlist.js — Shortlist page logic
// ============================================================

let editingItemId = null;
let allItems = [];
let activeFilter = null; // null = show all
let selectedTags = []; // tags selected in the add/edit form

// ── Init ──────────────────────────────────────────────────
(async () => {
  await requireAuth();
  populateDateSelect();
  initFilterListener();
  initGridListener();
  await loadShortlist();
  bindEvents();
})();

// ── Load shortlist ────────────────────────────────────────
async function loadShortlist() {
  const grid = document.getElementById('shortlistGrid');
  grid.innerHTML = '<div class="spinner"></div>';

  const { data: items, error } = await db
    .from('shortlist_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    grid.innerHTML = `<p style="color:var(--muted);padding:20px">${error.message}</p>`;
    return;
  }

  allItems = items || [];
  renderFilters();
  renderGrid();
}

// ── Filters ───────────────────────────────────────────────
function initFilterListener() {
  document.getElementById('locationFilters').addEventListener('click', e => {
    const btn = e.target.closest('.location-filter-btn');
    if (!btn) return;
    const kind = btn.dataset.kind;
    if (kind === 'all') activeFilter = null;
    else if (kind === 'loc') activeFilter = 'loc:' + btn.dataset.loc;
    else if (kind === 'tag') activeFilter = 'tag:' + btn.dataset.tag;
    renderFilters();
    renderGrid();
  });
}

function renderFilters() {
  const container = document.getElementById('locationFilters');

  const locations = [...new Set(
    allItems.map(i => (i.location || '').trim()).filter(Boolean)
  )].sort();

  const tags = [...new Set(
    allItems.flatMap(i => i.tags || [])
  )].sort();

  if (!locations.length && !tags.length) {
    container.innerHTML = '';
    return;
  }

  const allBtn = `<button class="location-filter-btn${activeFilter === null ? ' active' : ''}" data-loc="" data-kind="all">All</button>`;
  const locBtns = locations.map(loc =>
    `<button class="location-filter-btn${activeFilter === 'loc:' + loc ? ' active' : ''}" data-loc="${loc}" data-kind="loc">📍 ${loc}</button>`
  ).join('');
  const tagBtns = tags.map(tag =>
    `<button class="location-filter-btn tag-filter-btn${activeFilter === 'tag:' + tag ? ' active' : ''}" data-tag="${tag}" data-kind="tag">${tag}</button>`
  ).join('');
  container.innerHTML = allBtn + locBtns + tagBtns;
}

function initGridListener() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (!btn.closest('#shortlistGrid')) return; // only handle grid card buttons
    const { action, id } = btn.dataset;
    if (action === 'edit')   openEditItemSheet(id);
    if (action === 'delete') deleteItem(id);
    if (action === 'assign') openAssignSheet(id);
  });
}

function renderGrid() {
  const grid = document.getElementById('shortlistGrid');
  let filtered = allItems;
  if (activeFilter) {
    const [kind, value] = activeFilter.split(':');
    if (kind === 'loc') filtered = allItems.filter(i => (i.location || '').trim() === value);
    if (kind === 'tag') filtered = allItems.filter(i => (i.tags || []).includes(value));
  }

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-shortlist">
      <p>${activeFilter ? `No items match this filter.` : 'No ideas yet.<br/>Tap + to add something you\'d like to do.'}</p>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(buildItemCard).join('');
}


function buildItemCard(item) {
  const tags = (item.tags || []);
  const tagsHtml = tags.length
    ? `<div class="shortlist-item__tags">${tags.map(t => `<span class="shortlist-tag">${t}</span>`).join('')}</div>`
    : '';
  const datePill = item.date
    ? `<span class="shortlist-date-pill">📅 ${formatDateShort(item.date)}</span>`
    : '';
  return `
    <div class="shortlist-item">
      <div class="shortlist-item__name">${item.name}</div>
      <div class="shortlist-item__meta">
        ${item.location ? `📍 ${item.location}` : ''}
        ${item.location && item.link ? ' · ' : ''}
        ${item.link ? `<a href="${item.link}" target="_blank" rel="noopener">🔗 Link</a>` : ''}
      </div>
      ${tagsHtml}
      ${datePill}
      <div class="shortlist-item__actions">
        <button class="btn-assign" data-action="assign" data-id="${item.id}">＋ Add to day</button>
        <button data-action="edit"   data-id="${item.id}" style="background:var(--surface2);color:var(--muted);border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;border:none;">Edit</button>
        <button class="btn-del"      data-action="delete" data-id="${item.id}" style="background:transparent;color:#ff6b6b;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;">Delete</button>
      </div>
    </div>`;
}

// ── Delete ────────────────────────────────────────────────
async function deleteItem(id) {
  if (!confirm('Remove from shortlist?')) return;
  await db.from('shortlist_items').delete().eq('id', id);
  await loadShortlist();
}

// ── Item sheet (add/edit) ─────────────────────────────────
function openAddItemSheet() {
  editingItemId = null;
  document.getElementById('itemSheetTitle').textContent = 'Add to shortlist';
  document.getElementById('itemForm').reset();
  document.getElementById('itemId').value = '';
  document.getElementById('itemDate').value = '';
  selectedTags = [];
  document.getElementById('itemTags').value = '[]';
  syncTagPicker();
  openSheet('itemSheet');
}

function syncTagPicker() {
  document.querySelectorAll('#tagPicker .tag-btn').forEach(btn => {
    btn.classList.toggle('active', selectedTags.includes(btn.dataset.tag));
  });
}

async function openEditItemSheet(id) {
  const { data: item } = await db.from('shortlist_items').select('*').eq('id', id).single();
  if (!item) return;
  editingItemId = id;
  document.getElementById('itemSheetTitle').textContent = 'Edit item';
  document.getElementById('itemId').value    = id;
  document.getElementById('itemName').value  = item.name || '';
  document.getElementById('itemLocation').value = item.location || '';
  document.getElementById('itemDate').value  = item.date || '';
  document.getElementById('itemLink').value  = item.link || '';
  selectedTags = item.tags || [];
  document.getElementById('itemTags').value = JSON.stringify(selectedTags);
  syncTagPicker();
  openSheet('itemSheet');
}

async function saveItem(e) {
  e.preventDefault();
  const btn = document.getElementById('saveItemBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const dateVal = document.getElementById('itemDate').value;
  const payload = {
    name:     document.getElementById('itemName').value.trim(),
    location: document.getElementById('itemLocation').value.trim(),
    link:     document.getElementById('itemLink').value.trim(),
    tags:     selectedTags,
    date:     dateVal || null,
  };

  let error;
  if (editingItemId) {
    ({ error } = await db.from('shortlist_items').update(payload).eq('id', editingItemId));
  } else {
    ({ error } = await db.from('shortlist_items').insert(payload));
  }

  btn.disabled = false; btn.textContent = 'Save';
  if (error) { alert(error.message); return; }

  closeSheet('itemSheet');
  await loadShortlist();
}

// ── Assign to day ─────────────────────────────────────────
function populateDateSelect() {
  const select = document.getElementById('assignDate');
  getTripDates().forEach(date => {
    const opt = document.createElement('option');
    opt.value = date;
    opt.textContent = formatDate(date);
    select.appendChild(opt);
  });
}

async function openAssignSheet(id) {
  document.getElementById('assignItemId').value = id;
  closeSheet('itemSheet');
  openSheet('assignSheet');
}

async function confirmAssign() {
  const itemId = document.getElementById('assignItemId').value;
  const date   = document.getElementById('assignDate').value;
  const btn    = document.getElementById('confirmAssignBtn');

  btn.disabled = true; btn.textContent = 'Assigning…';

  // Get shortlist item details
  const { data: item } = await db.from('shortlist_items').select('*').eq('id', itemId).single();
  if (!item) { btn.disabled = false; btn.textContent = 'Assign'; return; }

  // Insert as calendar activity
  const { error: insertError } = await db.from('calendar_entries').insert({
    date,
    type:    'activity',
    title:   item.name,
    details: {
      location: item.location || '',
      link:     item.link || '',
    },
  });

  if (insertError) {
    alert(insertError.message);
    btn.disabled = false; btn.textContent = 'Assign';
    return;
  }

  // Delete from shortlist
  await db.from('shortlist_items').delete().eq('id', itemId);

  btn.disabled = false; btn.textContent = 'Assign';
  closeSheet('assignSheet');
  await loadShortlist();

  // Optionally jump to that day
  if (confirm(`Added to ${formatDateShort(date)}. Go to that day?`)) {
    window.location.href = '/trip?date=' + date;
  }
}

// ── Sheet helpers ─────────────────────────────────────────
function openSheet(sheetId) {
  document.getElementById('overlay').classList.add('open');
  document.getElementById(sheetId).classList.add('open');
}

function closeSheet(sheetId) {
  document.getElementById('overlay').classList.remove('open');
  if (sheetId) {
    document.getElementById(sheetId).classList.remove('open');
  } else {
    document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open'));
  }
}

// ── Bind events ───────────────────────────────────────────
function bindEvents() {
  document.getElementById('fabBtn').addEventListener('click', openAddItemSheet);
  document.getElementById('cancelItemBtn').addEventListener('click', () => closeSheet('itemSheet'));
  document.getElementById('cancelAssignBtn').addEventListener('click', () => closeSheet('assignSheet'));
  document.getElementById('overlay').addEventListener('click', () => closeSheet());
  document.getElementById('itemForm').addEventListener('submit', saveItem);
  document.getElementById('confirmAssignBtn').addEventListener('click', confirmAssign);

  // Tag picker
  document.getElementById('tagPicker').addEventListener('click', e => {
    const btn = e.target.closest('.tag-btn');
    if (!btn) return;
    const tag = btn.dataset.tag;
    if (selectedTags.includes(tag)) {
      selectedTags = selectedTags.filter(t => t !== tag);
    } else {
      selectedTags.push(tag);
    }
    document.getElementById('itemTags').value = JSON.stringify(selectedTags);
    syncTagPicker();
  });
}
