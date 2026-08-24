// ============================================================
// quotes.js — The Ridings
// ============================================================

let currentUser = 'Adam';
let editingQuoteId = null;
let allQuotes = [];

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   cls: 'quote-status--pending'   },
  confirmed: { label: 'Confirmed', cls: 'quote-status--confirmed' },
  completed: { label: 'Completed', cls: 'quote-status--completed' },
};

(async () => {
  await requireAuth();
  const user = await getCurrentUser();
  currentUser = user.name;

  const avatar = document.getElementById('userAvatar');
  avatar.textContent = currentUser[0];
  avatar.className = 'user-avatar user-avatar--' + currentUser.toLowerCase();
  document.getElementById('userSheetName').textContent = 'Signed in as ' + currentUser;
  document.getElementById('navQuotes').classList.add('active');

  // Default month picker to current month
  const now = new Date();
  document.getElementById('quoteMonth').value =
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  await loadQuotes();
  renderQuotes();
  bindEvents();
})();

async function loadQuotes() {
  const { data } = await db
    .from('quotes')
    .select('*')
    .order('quote_month', { ascending: false })
    .order('created_at', { ascending: false });
  allQuotes = data || [];
}

function formatMonth(m) {
  if (!m) return '';
  // m is 'YYYY-MM-DD' from Supabase date column
  const d = new Date(m.slice(0,7) + '-01T12:00:00');
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function formatGBP(n) {
  if (n == null || n === '') return null;
  return '£' + parseFloat(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function renderQuotes() {
  const body = document.getElementById('quotesList');
  if (!allQuotes.length) {
    body.innerHTML = `<div class="empty-state"><p>No quotes yet.<br>Tap + to add the first one.</p></div>`;
    return;
  }

  // Group by month
  const groups = {};
  for (const q of allQuotes) {
    const key = q.quote_month ? q.quote_month.slice(0, 7) : 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  }

  // Sort groups newest first
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  let html = '';
  for (const key of sortedKeys) {
    const label = formatMonth(key + '-01');
    const groupQuotes = groups[key];
    const groupTotal = groupQuotes.reduce((s, q) => s + (q.price ? parseFloat(q.price) : 0), 0);

    html += `<div class="quote-month-header">
      <span>${label}</span>
      ${groupTotal > 0 ? `<span class="quote-month-total">${formatGBP(groupTotal)}</span>` : ''}
    </div>`;

    for (const q of groupQuotes) {
      const sc = STATUS_CONFIG[q.status] || STATUS_CONFIG.pending;
      html += `
        <div class="quote-card" data-id="${q.id}">
          <div class="quote-card__top">
            <div class="quote-card__title">${q.title}</div>
            <span class="quote-status ${sc.cls}">${sc.label}</span>
          </div>
          ${q.price != null ? `<div class="quote-card__price">${formatGBP(q.price)}</div>` : ''}
          ${q.description ? `<div class="quote-card__desc">${q.description}</div>` : ''}
        </div>`;
    }
  }

  html += '<div style="height:80px;"></div>';
  body.innerHTML = html;

  body.querySelectorAll('.quote-card[data-id]').forEach(el => {
    el.addEventListener('click', () => openEditQuote(el.dataset.id));
  });
}

function openAddQuote() {
  editingQuoteId = null;
  document.getElementById('quoteSheetTitle').textContent = 'Add quote';
  document.getElementById('quoteForm').reset();
  const now = new Date();
  document.getElementById('quoteMonth').value =
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  document.getElementById('deleteQuoteBtn').style.display = 'none';
  openSheet('quoteSheet');
}

function openEditQuote(id) {
  const q = allQuotes.find(x => x.id === id);
  if (!q) return;
  editingQuoteId = id;
  document.getElementById('quoteSheetTitle').textContent = 'Edit quote';
  document.getElementById('quoteId').value    = id;
  document.getElementById('quoteTitle').value = q.title;
  document.getElementById('quotePrice').value = q.price != null ? q.price : '';
  document.getElementById('quoteDesc').value  = q.description || '';
  document.getElementById('quoteMonth').value = q.quote_month ? q.quote_month.slice(0, 7) : '';
  document.getElementById('quoteStatus').value = q.status || 'pending';
  document.getElementById('deleteQuoteBtn').style.display = '';
  openSheet('quoteSheet');
}

async function saveQuote(ev) {
  ev.preventDefault();
  const btn = document.getElementById('saveQuoteBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const monthVal = document.getElementById('quoteMonth').value; // 'YYYY-MM'
  const payload = {
    title:       document.getElementById('quoteTitle').value.trim(),
    price:       document.getElementById('quotePrice').value !== ''
                   ? parseFloat(document.getElementById('quotePrice').value)
                   : null,
    description: document.getElementById('quoteDesc').value.trim() || null,
    quote_month: monthVal ? monthVal + '-01' : null,
    status:      document.getElementById('quoteStatus').value,
  };

  let error, data;
  if (editingQuoteId) {
    ({ error, data } = await db.from('quotes').update(payload).eq('id', editingQuoteId).select().single());
    if (!error && data) {
      const idx = allQuotes.findIndex(q => q.id === editingQuoteId);
      if (idx !== -1) allQuotes[idx] = data;
    }
  } else {
    ({ error, data } = await db.from('quotes').insert(payload).select().single());
    if (!error && data) allQuotes.unshift(data);
  }

  btn.disabled = false; btn.textContent = 'Save';
  if (error) { alert(error.message); return; }
  closeSheet('quoteSheet');
  renderQuotes();
}

async function deleteQuote(id) {
  if (!confirm('Delete this quote?')) return;
  await db.from('quotes').delete().eq('id', id);
  allQuotes = allQuotes.filter(q => q.id !== id);
  closeSheet('quoteSheet');
  renderQuotes();
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
  document.getElementById('fabBtn').addEventListener('click', openAddQuote);
  document.getElementById('cancelQuoteBtn').addEventListener('click', () => closeSheet('quoteSheet'));
  document.getElementById('quoteForm').addEventListener('submit', saveQuote);
  document.getElementById('deleteQuoteBtn').addEventListener('click', () => {
    if (editingQuoteId) deleteQuote(editingQuoteId);
  });
  document.getElementById('userAvatar').addEventListener('click', () => openSheet('userSheet'));
  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await db.auth.signOut(); window.location.href = '/login';
  });
  document.getElementById('overlay').addEventListener('click', () => {
    document.querySelectorAll('.sheet.open').forEach(s => closeSheet(s.id));
  });
}
