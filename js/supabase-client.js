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
  // Use UTC noon to avoid any timezone shifting the date
  const [sy, sm, sd] = TRIP_START.split('-').map(Number);
  const [ey, em, ed] = TRIP_END.split('-').map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd, 12));
  const end = new Date(Date.UTC(ey, em - 1, ed, 12));
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = '/login';
    return null;
  }
  return session;
}
