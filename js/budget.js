// ============================================================
// budget.js — The Ridings
// ============================================================

let currentUser = 'Adam';
let editingItemId = null;
let allItems = [];
let collapsedSections = new Set();

const SECTIONS = [
  { key: 'adam_income',     label: "Adam's Income",         type: 'income',  icon: '💼' },
  { key: 'kayleigh_income', label: "Kayleigh's Income",     type: 'income',  icon: '💼' },
  { key: 'other_income',    label: 'Other Income',           type: 'income',  icon: '➕' },
  { key: 'ridings_out',     label: 'The Ridings',            type: 'expense', icon: '🏠' },
  { key: 'whitfield_out',   label: 'Whitfield',              type: 'expense', icon: '🏡' },
  { key: 'general_out',     label: 'General',                type: 'expense', icon: '🛒' },
];

function sectionType(key) {
  return key.endsWith('_income') ? 'income' : 'expense';
}

(async () => {
  await requireAuth();
  const user = await getCurrentUser();
  currentUser = user.name;

  const avatar = document.getElementById('userAvatar');
  avatar.textContent = currentUser[0];
  avatar.className = 'user-avatar user-avatar--' + currentUser.toLowerCase();
  document.getElementById('userSheetName').textContent = 'Signed in as ' + currentUser;
  document.getElementById('navBudget').classList.add('active');

  await loadItems();
  renderBudget();
  bindEvents();
})();

async function loadItems() {
  const { data } = await db.from('budget_items').select('*').order('created_at', { ascending: true });
  allItems = data || [];
}

function toMonthly(amount, frequency) {
  if (frequency === 'weekly') return amount * 52 / 12;
  if (frequency === 'annual') return amount / 12;
  return Number(amount) || 0;
}

function formatGBP(n) {
  const abs = Math.abs(n);
  const str = '£' + abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? '-' + str : str;
}

function renderBudget() {
  const body = document.getElementById('budgetBody');

  const totalIncome  = allItems.filter(i => sectionType(i.section) === 'income')
    .reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  const totalExpense = allItems.filter(i => sectionType(i.section) === 'expense')
    .reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  const diff = totalIncome - totalExpense;
  const pct  = totalIncome > 0 ? Math.min(100, (totalExpense / totalIncome) * 100) : 0;
  const surplus = diff >= 0;

  // ── Summary card ──
  let html = `
    <div class="bud-summary">
      <div class="bud-summary__row">
        <div class="bud-summary__stat">
          <span class="bud-summary__label">Monthly in</span>
          <span class="bud-summary__value bud-summary__value--in">${formatGBP(totalIncome)}</span>
        </div>
        <div class="bud-summary__divider"></div>
        <div class="bud-summary__stat">
          <span class="bud-summary__label">Monthly out</span>
          <span class="bud-summary__value bud-summary__value--out">${formatGBP(totalExpense)}</span>
        </div>
        <div class="bud-summary__divider"></div>
        <div class="bud-summary__stat">
          <span class="bud-summary__label">${surplus ? 'Left over' : 'Shortfall'}</span>
          <span class="bud-summary__value ${surplus ? 'bud-summary__value--surplus' : 'bud-summary__value--deficit'}">${formatGBP(Math.abs(diff))}</span>
        </div>
      </div>
      <div class="bud-bar-wrap">
        <div class="bud-bar">
          <div class="bud-bar__fill ${surplus ? '' : 'bud-bar__fill--over'}" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <span class="bud-bar__label">${pct.toFixed(0)}% of income spent</span>
      </div>
    </div>`;

  // ── Income sections ──
  html += `<div class="bud-group-label">
    <span>Income</span>
    <span class="bud-group-total bud-group-total--in">${formatGBP(totalIncome)}/mo</span>
  </div>`;
  for (const sec of SECTIONS.filter(s => s.type === 'income')) {
    html += renderSection(sec);
  }

  // ── Expense sections ──
  html += `<div class="bud-group-label" style="margin-top:16px;">
    <span>Outgoings</span>
    <span class="bud-group-total bud-group-total--out">${formatGBP(totalExpense)}/mo</span>
  </div>`;
  for (const sec of SECTIONS.filter(s => s.type === 'expense')) {
    html += renderSection(sec);
  }

  html += '<div style="height:90px;"></div>';
  body.innerHTML = html;

  // Collapsible section headers
  body.querySelectorAll('.bud-section__header[data-section]').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const key = hdr.dataset.section;
      if (collapsedSections.has(key)) collapsedSections.delete(key);
      else collapsedSections.add(key);
      renderBudget();
    });
  });

  body.querySelectorAll('.bud-item[data-id]').forEach(el => {
    el.addEventListener('click', () => openEditItem(el.dataset.id));
  });
  body.querySelectorAll('.bud-add-btn[data-section]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openAddItem(btn.dataset.section); });
  });
}

function renderSection(sec) {
  const freqLabel = { monthly: '/mo', weekly: '/wk', annual: '/yr' };
  const items = allItems
    .filter(i => i.section === sec.key)
    .sort((a, b) => toMonthly(b.amount, b.frequency) - toMonthly(a.amount, a.frequency));
  const total      = items.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  const isGeneral  = sec.key === 'general_out';
  const collapsed  = collapsedSections.has(sec.key);

  // Work out the largest monthly value for bar scaling
  const maxMonthly = items.length ? toMonthly(items[0].amount, items[0].frequency) : 1;

  const itemsHtml = collapsed ? '' : items.map(i => {
    const monthly  = toMonthly(i.amount, i.frequency);
    const barPct   = maxMonthly > 0 ? (monthly / maxMonthly) * 100 : 0;
    const assigneeTag = isGeneral && i.assigned_to
      ? `<span class="bud-item__tag bud-item__tag--${i.assigned_to.toLowerCase()}">${i.assigned_to}</span>`
      : '';
    const freqStr = i.frequency && i.frequency !== 'monthly'
      ? `<span class="bud-item__freq">${freqLabel[i.frequency]}</span>`
      : '';
    return `
    <div class="bud-item" data-id="${i.id}">
      <div class="bud-item__top">
        <div class="bud-item__name">${i.name}${assigneeTag}</div>
        <div class="bud-item__amounts">
          <span class="bud-item__amount">${formatGBP(i.amount)}</span>${freqStr}
          ${i.frequency !== 'monthly' ? `<span class="bud-item__monthly">${formatGBP(monthly)}/mo</span>` : ''}
        </div>
      </div>
      <div class="bud-item__bar-wrap">
        <div class="bud-item__bar" style="width:${barPct.toFixed(1)}%"></div>
      </div>
    </div>`;
  }).join('');

  const addBtn = collapsed ? '' : `<button class="bud-add-btn" data-section="${sec.key}">+ Add item</button>`;

  return `
    <div class="bud-section${collapsed ? ' bud-section--collapsed' : ''}">
      <div class="bud-section__header" data-section="${sec.key}">
        <div class="bud-section__left">
          <span class="bud-section__icon">${sec.icon}</span>
          <span class="bud-section__label">${sec.label}</span>
          <span class="bud-section__count">${items.length}</span>
        </div>
        <div class="bud-section__right">
          <span class="bud-section__total">${formatGBP(total)}/mo</span>
          <span class="bud-section__chevron">${collapsed ? '›' : '⌄'}</span>
        </div>
      </div>
      ${itemsHtml}
      ${addBtn}
    </div>`;
}

function openAddItem(section) {
  editingItemId = null;
  document.getElementById('itemSheetTitle').textContent = 'Add item';
  document.getElementById('itemForm').reset();
  document.getElementById('itemSection').value = section;
  document.getElementById('deleteItemBtn').style.display = 'none';
  document.getElementById('assignedToGroup').style.display = section === 'general_out' ? '' : 'none';
  openSheet('itemSheet');
}

function openEditItem(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  editingItemId = id;
  document.getElementById('itemSheetTitle').textContent = 'Edit item';
  document.getElementById('itemSection').value = item.section;
  document.getElementById('itemName').value    = item.name;
  document.getElementById('itemAmount').value  = item.amount;
  document.getElementById('itemFrequency').value = item.frequency || 'monthly';
  document.getElementById('assignedToGroup').style.display = item.section === 'general_out' ? '' : 'none';
  document.getElementById('itemAssignedTo').value = item.assigned_to || '';
  document.getElementById('deleteItemBtn').style.display = '';
  openSheet('itemSheet');
}

async function saveItem(ev) {
  ev.preventDefault();
  const btn = document.getElementById('saveItemBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  const section = document.getElementById('itemSection').value;
  const payload = {
    section,
    name:        document.getElementById('itemName').value.trim(),
    amount:      parseFloat(document.getElementById('itemAmount').value),
    frequency:   document.getElementById('itemFrequency').value,
    assigned_to: section === 'general_out'
      ? (document.getElementById('itemAssignedTo').value || null)
      : null,
  };
  let error, data;
  if (editingItemId) {
    ({ error, data } = await db.from('budget_items').update(payload).eq('id', editingItemId).select().single());
    if (!error && data) { const idx = allItems.findIndex(i => i.id === editingItemId); if (idx !== -1) allItems[idx] = data; }
  } else {
    ({ error, data } = await db.from('budget_items').insert(payload).select().single());
    if (!error && data) allItems.push(data);
  }
  btn.disabled = false; btn.textContent = 'Save';
  if (error) { alert(error.message); return; }
  closeSheet('itemSheet');
  renderBudget();
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  await db.from('budget_items').delete().eq('id', id);
  allItems = allItems.filter(i => i.id !== id);
  closeSheet('itemSheet');
  renderBudget();
}

function openSheet(id) {
  document.getElementById('overlay').classList.add('open');
  document.getElementById(id).classList.add('open');
}
function closeSheet(id) {
  document.getElementById(id).classList.remove('open');
  if (!document.querySelector('.sheet.open')) document.getElementById('overlay').classList.remove('open');
}

function bindEvents() {
  document.getElementById('cancelItemBtn').addEventListener('click', () => closeSheet('itemSheet'));
  document.getElementById('itemForm').addEventListener('submit', saveItem);
  document.getElementById('deleteItemBtn').addEventListener('click', () => { if (editingItemId) deleteItem(editingItemId); });
  document.getElementById('userAvatar').addEventListener('click', () => openSheet('userSheet'));
  document.getElementById('signOutBtn').addEventListener('click', async () => { await db.auth.signOut(); window.location.href = '/login'; });
  document.getElementById('overlay').addEventListener('click', () => { document.querySelectorAll('.sheet.open').forEach(s => closeSheet(s.id)); });
}
