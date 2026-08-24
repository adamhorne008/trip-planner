// ============================================================
// supabase-client.js — The Ridings
// ============================================================

const SUPABASE_URL = 'https://ayjhdtwamaposrfqmrxc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6KnUjwF44JdU2NLxQ1Y49A_NEcFacYE';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Update these with real email addresses ────────────────
const USER_EMAIL_MAP = {
  'adamhorne008@yahoo.co.uk': 'Adam',
  'cavell1983@aol.com': 'Kayleigh',   
};

async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = '/login'; return null; }
  return session;
}

async function getCurrentUser() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return { name: 'Adam', email: '' };
  const email = session.user.email || '';
  const mapped = USER_EMAIL_MAP[email];
  const name = mapped || (email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1));
  return { name, email };
}

function formatDateShort(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDateMed(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayISO() {
  const n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0');
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
}
