// Supabase client — shared across all pages
const SUPABASE_URL = 'https://ayjhdtwamaposrfqmrxc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6KnUjwF44JdU2NLxQ1Y49A_NEcFacYE';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Trip date range
const TRIP_START = '2026-06-14';
const TRIP_END   = '2026-07-19';

function getTripDates() {
  const dates = [];
  const cur = new Date(TRIP_START + 'T00:00:00');
  const end = new Date(TRIP_END   + 'T00:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = '/login';
    return null;
  }
  return session;
}
