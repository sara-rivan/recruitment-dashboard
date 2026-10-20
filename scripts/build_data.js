// Pulls the figures from Airtable (read-only token) and writes site/data.json.
// No candidate emails, LinkedIn links or names are written - only totals, team member names and role names.
const fs = require('fs');
const path = require('path');

const BASE = 'appuiyuClsVHmWj1h';
const T = {
  referral: 'tblcBbfCDLT0p6Ng3',  // Recruitment - Referral Funnel
  apps: 'tblbSWN54ln2qt2jr',      // Recruitment - Applications Funnel
  board: 'tblqaneQ2h15gNDzD',     // Recruitment - Internal Referrals Leaderboard
  arch: 'tblXOHAxSdaABoxWy',      // Recruitment - Archetype Selection
};
const WEEKS_START = Date.UTC(2026, 9, 5); // first week shown: w/c 5 Oct 2026
const DAY = 864e5, WEEK = 7 * DAY;

const sel = (x) => (typeof x === 'string' ? x : x && x.name ? x.name : '');
const ne = (e) => String(e || '').trim().toLowerCase();
const nl = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const monday = (t) => { const d = new Date(t); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.getTime(); };
// Any of these statuses counts as engaged (a person only needs one record with one of them):
// 2. Engagement, No.2 (not interested in further discussion), 3.1 Call booked, 3.2 Factory visit booked,
// 4.1 Moved into the Applicant Funnel, 4.2 Future Interest
const ENGAGED_PREFIXES = ['2.', 'No.2', '3.1', '3.2', '4.1', '4.2'];
const isEngaged = (s) => ENGAGED_PREFIXES.some((p) => String(s || '').trim().startsWith(p));

// ---------- Airtable REST ----------
async function fetchAll(token, table, fieldIds, formula) {
  const rows = [];
  let offset = '';
  do {
    const p = new URLSearchParams();
    p.set('pageSize', '100');
    p.set('returnFieldsByFieldId', 'true');
    fieldIds.forEach((f) => p.append('fields[]', f));
    if (formula) p.set('filterByFormula', formula);
    if (offset) p.set('offset', offset);
    const url = `https://api.airtable.com/v0/${BASE}/${table}?${p.toString()}`;
    let res, tries = 0;
    for (;;) {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 429 && tries < 5) { tries += 1; await new Promise((r) => setTimeout(r, 31000)); continue; }
      break;
    }
    if (!res.ok) throw new Error(`Airtable ${table} returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = await res.json();
    (body.records || []).forEach((r) => rows.push(r));
    offset = body.offset || '';
    await new Promise((r) => setTimeout(r, 220)); // stay under 5 requests a second
  } while (offset);
  return rows;
}

async function pull(token) {
  const [referral, referrals, signed, board, arch] = await Promise.all([
    fetchAll(token, T.referral, ['fldrZQjQpxhPP72rr', 'fldxxSB6Z1MBQjXTG', 'fldQKUgf9leWSmWc2', 'fldu3ksNuwTMTpED9', 'flduY9LD2fbquyeLY', 'fld3BRq8Zzg0sbawJ']),
    fetchAll(token, T.apps, ['fldcLUIY1qoZ13cku', 'fldi6Y1pAYNhKQjF6', 'fldnBSYv91dEhTmNW', 'fldOD4zvVs1C3j8Lf', 'fld2tmvdXdweTy7Lq', 'fldWBT7qgTy8RLmLw'], "{Where did you hear about this role?}='Referral'"),
    fetchAll(token, T.apps, ['fldcLUIY1qoZ13cku', 'fldi6Y1pAYNhKQjF6', 'fld2tmvdXdweTy7Lq'], "{Status}='10. Contract Signed'"),
    fetchAll(token, T.board, ['fldlyv8AbvmCzY4vN', 'flddnNQRc0UAG4Ah5']),
    fetchAll(token, T.arch, ['flda8eNzA2V9vUmEg', 'fldRf27obtNMveciE'], "{[LIVE FIELD] Archetype (Yes/No)}='Yes'"),
  ]);
  const f = (r) => r.fields || {};
  return {
    records: referral.map((r) => ({ gem_id: f(r).fldrZQjQpxhPP72rr || r.id, key: ne(f(r).fldxxSB6Z1MBQjXTG), key2: nl(f(r).fldQKUgf9leWSmWc2), member: sel(f(r).fldu3ksNuwTMTpED9).trim(), status: sel(f(r).flduY9LD2fbquyeLY), reviewed: f(r).fld3BRq8Zzg0sbawJ || '' })),
    referrals: referrals.map((r) => ({ key: ne(f(r).fldcLUIY1qoZ13cku), key2: nl(f(r).fldi6Y1pAYNhKQjF6), specify: String(f(r).fldnBSYv91dEhTmNW || ''), applied: f(r).fldOD4zvVs1C3j8Lf || '' })),
    signed: signed.map((r) => ({ key: ne(f(r).fldcLUIY1qoZ13cku), key2: nl(f(r).fldi6Y1pAYNhKQjF6) })),
    board: board.map((r) => ({ member: String(f(r).fldlyv8AbvmCzY4vN || '').trim(), total: Number(f(r).flddnNQRc0UAG4Ah5 || 0) })),
    arch: arch.map((r) => ({ role: sel(f(r).flda8eNzA2V9vUmEg) || 'Unspecified', gem_id: String(f(r).fldRf27obtNMveciE || '').trim() })),
  };
}

// ---------- the same calculations the Claude dashboard used ----------
function buildData(raw, now = Date.now()) {
  const { referrals, signed, board, arch } = raw;
  // records with a blank Team Member (" ") are removed from every count
  const records = raw.records.map((r) => ({ ...r, member: String(r.member || '').trim() })).filter((r) => r.member);

  // engaged: unique people at "2. Engagement" or "No.2 - Not interested in further discussion"
  const engagedRecs = records.filter((r) => isEngaged(r.status));
  const engaged = new Set(engagedRecs.map((r) => r.gem_id)).size; // unique Gem IDs

  // net-new hires: signed applications that are also in the Referral Funnel
  const outKeys = new Set();
  records.forEach((r) => { if (r.key) outKeys.add(r.key); if (r.key2) outKeys.add(r.key2); });
  const hires = signed.filter((a) => (a.key && outKeys.has(a.key)) || (a.key2 && outKeys.has(a.key2))).length;

  // archetypes per role and % engaged (matched by Gem ID)
  const engagedIds = new Set(engagedRecs.map((r) => r.gem_id));
  const m = new Map();
  arch.forEach((a) => {
    const o = m.get(a.role) || { role: a.role, archetypes: 0, engaged: 0 };
    o.archetypes += 1;
    if (a.gem_id && engagedIds.has(a.gem_id)) o.engaged += 1;
    m.set(a.role, o);
  });
  const roles = [...m.values()].sort((a, b) => b.archetypes - a.archetypes || a.role.localeCompare(b.role));
  const tot = roles.reduce((s, r) => ({ archetypes: s.archetypes + r.archetypes, engaged: s.engaged + r.engaged }), { archetypes: 0, engaged: 0 });
  const archetype_roles = roles.concat([{ role: 'Total', archetypes: tot.archetypes, engaged: tot.engaged }])
    .map((r) => ({ role: r.role, archetypes: r.archetypes, engaged_pct: r.archetypes ? Math.round(100 * r.engaged / r.archetypes) : 0 }));

  // referral leaderboard (Internal Referrals Leaderboard table)
  const leaders = board.map((r) => ({ member: String(r.member || '').trim(), total: r.total })).filter((r) => r.member && r.total > 0)
    .sort((a, b) => b.total - a.total || a.member.localeCompare(b.member)).slice(0, 10);

  // engagement leaderboard
  const seen = new Set(), c = new Map();
  engagedRecs.filter((r) => r.member).forEach((r) => {
    const k = r.member + '|' + r.gem_id;
    if (seen.has(k)) return;
    seen.add(k);
    c.set(r.member, (c.get(r.member) || 0) + 1);
  });
  const engaged_leaders = [...c.entries()].map(([member, total]) => ({ member, total }))
    .sort((a, b) => b.total - a.total || a.member.localeCompare(b.member)).slice(0, 10);

  // net-new engagements by week: first week each person replied (Referral Funnel "2." + Referral applications naming a team member)
  const full = [...new Set(records.map((r) => r.member).filter(Boolean))];
  const matchMember = (spec) => {
    const s = norm(spec); if (!s) return '';
    const toks = s.split(' ');
    for (const n of full) { const nn = norm(n); if (nn && (s === nn || s.includes(nn))) return n; }
    for (const n of full) { const f = norm(n).split(' ')[0]; if (f.length > 2 && toks.includes(f) && full.filter((x) => norm(x).split(' ')[0] === f).length === 1 && toks.length <= 2) return n; }
    return '';
  };
  const first = new Map();
  const put = (k, w) => { if (!first.has(k) || w < first.get(k)) first.set(k, w); };
  const keyToGem = new Map();
  records.forEach((r) => { if (r.key) keyToGem.set(r.key, r.gem_id); if (r.key2) keyToGem.set(r.key2, r.gem_id); });
  engagedRecs.filter((r) => r.reviewed).forEach((r) => put(r.gem_id, monday(r.reviewed)));
  referrals.forEach((a) => { const k = keyToGem.get(a.key) || keyToGem.get(a.key2) || a.key || a.key2; if (k && a.applied && matchMember(a.specify)) put(k, monday(a.applied)); });
  const nowW = monday(now), weekly = [];
  for (let t = WEEKS_START; t <= nowW; t += WEEK) weekly.push({ week: new Date(t).toISOString().slice(0, 10), engagements: [...first.values()].filter((w) => w === t).length });

  // actions: pending > 2 days or message sent > 7 days since Last status review
  const a = new Map();
  records.forEach((r) => {
    if (!r.member) return;
    const o = a.get(r.member) || { member: r.member, actions: 0 };
    const age = r.reviewed ? now - new Date(r.reviewed).getTime() : 0;
    const s = String(r.status);
    if ((s.startsWith('0.') && age > 2 * DAY) || (s.startsWith('1.') && age > 7 * DAY)) o.actions += 1;
    a.set(r.member, o);
  });
  const actions = [...a.values()].filter((o) => o.actions > 0).sort((x, y) => y.actions - x.actions || x.member.localeCompare(y.member));

  return { generated: new Date(now).toISOString(), engaged, hires, archetype_roles, leaders, engaged_leaders, weekly, actions };
}

module.exports = { buildData };

if (require.main === module) {
  (async () => {
    const token = process.env.AIRTABLE_TOKEN;
    if (!token) { console.error('AIRTABLE_TOKEN is not set'); process.exit(1); }
    const raw = await pull(token);
    const data = buildData(raw);
    const out = path.join(process.cwd(), 'site');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify(data, null, 2));
    console.log(`Wrote site/data.json: ${data.archetype_roles.length - 1} roles, ${data.engaged} engaged, ${data.hires} hires, ${data.actions.length} people with actions.`);
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
