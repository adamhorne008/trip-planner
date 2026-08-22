// ============================================================
// budget.js — The Ridings
// ============================================================

let currentUser = 'Adam';
let editingItemId = null;
let allItems = [];

const SECTIONS = [
  { key: 'adam-income',     label: "Adam's Income",        type: 'income'  },
  { key: 'kayleigh-income', label: "Kayleigh's Income",    type: 'income'  },
  { key: 'other-income',    label: 'Other Income',          type: 'income'  },
  { key: 'ridings',         label: 'The Ridings Outgoings', type: 'expense' },
  { key: 'whitfield',       label: 'Whitfield Outgoings',   type: 'expense' },
  { key: 'general',         label: 'General Outgoings',     type: 'expense' },
];

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
  if (frequency === 'weekly')  return amount * 52 / 12;
  if (frequency === 'annual')  return amount / 12;
  return amount;
}

function formatGBP(n) {
  return '£' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function renderBudget() {
  const body = document.getElementById('budgetBody');
  let html = '';

  // Income sections
  html += '<div class="budget-section-group">';
  html += '<div class="budget-group-label">Income</div>';
  for (const sec of SECTIONS.filter(s => s.type === 'income')) {
    html += renderSection(sec);
  }
  html += '</div>';

  // Expense sections
  html += '<div class="budget-section-group">';
  html += '<div class="budget-group-label">Outgoings</div>';
  for (const sec of SECTIONS.filter(s => s.type === 'expense')) {
    html += renderSection(sec);
  }
  html += '</div>';

  // Totals
  const totalIncome  = allItems.filter(i => i.type === 'income') .reduce((s,i) => s + toMonthly(i.amount, i.frequency), 0);
  const totalExpense = allItems.filter(i => i.type === 'expense').reduce((s,i) => s + toMonthly(i.amount, i.frequency), 0);
  const diff = totalIncome - totalExpense;

  html += `
    <div class="budget-totals">
      <div class="budget-totals__row">
        <span>Total income</span>
        <span class="budget-totals__income">${formatGBP(totalIncome)}</span>
      </div>
      <div class="budget-totals__row">
        <span>Total outgoings</span>
        <span class="budget-totals__expense">${formatGBP(totalExpense)}</span>
      </div>
      <div class="budget-totals__row budget-totals__row--diff">
        <span>Monthly difference</span>
        <span class="${diff >= 0 ? 'budget-totals__surplus' : 'budget-totals__deficit'}">${formatGBP(diff)}</span>
      </div>
    </div>
    <div style="height:80px;"></div>`;

  body.innerHTML = html;

  body.querySelectorAll('.budget-item[data-id]').forEach(el => {
    el.addEventListener('click', () => openEditItem(el.dataset.id));
  });
  body.querySelectorAll('.budget-add-btn[data-section]').forEach(btn => {
    btn.addEventListener('click', () => openAddItem(btn.dataset.section, btn.dataset.type));
  });
}

function renderSection(sec) {
  const items = allItems.filter(i => i.section === sec.key);
  const total = items.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
  const freqLabel = { monthly: '/mo', weekly: '/wk', annual: '/yr' };

  const itemsHtml = items.map(i => `
    <div class="budget-item" data-id="${i.id}">
      <div class="budget-item__label">${i.label}</div>
      <div class="budget-item__right">
        <span class="budget-item__amount">${formatGBP(i.amount)}</span>
        <span class="budget-item__freq">${freqLabel[i.frequency] || '/mo'}</span>
        <span class="budget-item__monthly">(${formatGBP(toMonthly(i.amount, i.frequency))}/mo)</span>
      </div>
    </div>`).join('');

  return `
    <div class="budget-section">
      <div class="budget-section__header">
        <span class="budget-section__title">${sec.label}</span>
        <span class="budget-section__total">${formatGBP(total)}/mo</span>
      </div>
      ${itemsHtml}
      <button class="budget-add-btn" data-section="${sec.key}" data-type="${sec.type}">+ Add</button>
    </div>`;
}

function openAddItem(section, type) {
  editingItemId = null;
  document.getElementById('itemSheetTitle').textContent = 'Add item';
  document.getElementById('itemForm').reset();
  document.getElementById('itemSection').value = section;
  document.getElementById('itemType').value = type;
  document.getElementById('deleteItemBtn').style.display = 'none';
  openSheet('itemSheet');
}

function openEditItem(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  editingItemId = id;
  document.getElementById('itemSheetTitle').textContent = 'Edit item';
  document.getElementById('itemId').value = id;
  document.getElementById('itemSection').value = item.section;
  document.getElementById('itemType').value = item.type;
  document.getElementById('itemLabel').value = item.label;
  document.getElementById('itemAmount').value = item.amount;
  document.getElementById('itemFrequency').value = item.frequency;
  document.getElementById('deleteItemBtn').style.display = '';
  openSheet('itemSheet');
}

async function saveItem(ev) {
  ev.preventDefault();
  const btn = document.getElementById('saveItemBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const payload = {
    section:   document.getElementById('itemSection').value,
    type:      document.getElementById('itemType').value,
    label:     document.getElementById('itemLabel').value.trim(),
    amount:    parseFloat(document.getElementById('itemAmount').value),
    frequency: document.getElementById('itemFrequency').value,
  };

  let error, data;
  if (editingItemId) {
    ({ error, data } = await db.from('budget_items').update(payload).eq('id', editingItemId).select().single());
    if (!error && data) {
      const idx = allItems.findIndex(i => i.id === editingItemId);
      if (idx !== -1) allItems[idx] = data;
    }
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
  document.getElementById('deleteItemBtn').addEventListener('click', () => {
    if (editingItemId) deleteItem(editingItemId);
  });
  document.getElementById('userAvatar').addEventListener('click', () => openSheet('userSheet'));
  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await db.auth.signOut(); window.location.href = '/login';
  });
  document.getElementById('overlay').addEventListener('click', () => {
    document.querySelectorAll('.sheet.open').forEach(s => closeSheet(s.id));
  });
}
