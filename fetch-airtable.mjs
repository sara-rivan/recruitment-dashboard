// Pulls the dashboard numbers from Airtable and writes data.json
// Runs inside the GitHub Action (Node 20+). Needs two secrets:
//   AIRTABLE_TOKEN    - personal access token with data.records:read on the base
//   AIRTABLE_BASE_ID  - e.g. appXXXXXXXXXXXXXX
import { writeFileSync } from 'node:fs';

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
if (!TOKEN || !BASE_ID) {
  console.error('Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID');
  process.exit(1);
}

const TABLE = 'Recruitment - Roles';
const FILTER = "{Planned}='Hiring'";          // only roles where Planned = Hiring
const EXCLUDE_TITLES = ['TEMPLATE'];

// short key used by index.html  ->  Airtable field name
const FIELD_MAP = {
  role:         'Role Title',
  checklist:    'Checklist %',                // your checklist formula field
  priority:     'Priority',
  phire:        'P(hire)',
  start:        'Expected start month',
  applicants:   'Application Count (Total)',
  pOut:         '% Outbound (total)',
  pNet:         '% Network (total)',
  pIn:          '% Inbound (total)',
  engW:         'Network engagements (week)',
  engWChg:      'Network engagements (week) change %',
  engM:         'Network engagements (month)',
  engMChg:      'Network engagements (month) change %',
  outstanding:  'Outstanding actions',
  review:       'N.o. of candidates at review stages',
  over2:        'N.o. candidates >2 days at review stages',
  wpW:          'WPs this week',
  wpWChg:       'WPs this week change %',
  wpM:          'WPs this month',
  wpMChg:       'WPs this month change %',
  owner:        'Owner',
  snapshotDate: 'Snapshot date',
};

async function fetchAll() {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`);
    Object.values(FIELD_MAP).forEach((f) => url.searchParams.append('fields[]', f));
    url.searchParams.set('filterByFormula', FILTER);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) {
      console.error(`Airtable error ${res.status}: ${await res.text()}`);
      process.exit(1);
    }
    const json = await res.json();
    records.push(...json.records);
    offset = json.offset;
  } while (offset);
  return records;
}

const records = await fetchAll();
const roles = records
  .map((r) => {
    const row = {};
    for (const [key, field] of Object.entries(FIELD_MAP)) {
      if (r.fields[field] !== undefined) row[key] = r.fields[field];   // Airtable omits empty fields
    }
    return row;
  })
  .filter((r) => r.role && !EXCLUDE_TITLES.includes(r.role));

writeFileSync('data.json', JSON.stringify({ updated: new Date().toISOString(), roles }, null, 1));
console.log(`Wrote ${roles.length} roles to data.json`);
