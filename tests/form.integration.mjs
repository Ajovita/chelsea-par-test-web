import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Use the Miniflare version already installed with Wrangler; no extra dependency.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler'));
const { Miniflare } = await import(wranglerRequire.resolve('miniflare'));
if (!existsSync('dist/server/index.js')) throw new Error('Build first: npm run build');
const modules = [
  { type: 'ESModule', path: 'dist/server/index.js' },
  ...readdirSync('dist/server', { recursive: true }).filter(path => path.endsWith('.js') && path !== 'index.js').map(path => ({ type: 'ESModule', path: 'dist/server/' + path })),
];
const origin = 'https://form-tests.invalid'; // Isolated emulator only; no network submissions.
const temp = mkdtempSync(join(tmpdir(), 'kold-form-tests-'));
const options = {
  modules, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
  d1Databases: ['DB'], r2Buckets: ['BUCKET'],
  d1Persist: join(temp, 'd1'), r2Persist: join(temp, 'r2'),
  bindings: { PRIVATE_PREVIEW_ADMIN: 'true' },
};
const mf = new Miniflare(options);
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Perth' });
const shiftDate = (days) => new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const jpg = readFileSync('public/images/portrait.jpg');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNMqYhiYGBgYmBgYGBgAAAOvAE6k3HT0QAAAABJRU5ErkJggg==', 'base64');
const webp = Buffer.from('UklGRjAAAABXRUJQVlA4ICQAAABwAQCdASoCAAIAAUAmJYwCdAFAAAD+6Wka4ubIiiwwmB2AAAA=', 'base64');
function form(overrides = {}) {
  const data = new FormData();
  const values = { name: 'QA Test Person', email: 'qa@example.com', phone: '', package: 'Photography', type: 'Enquiry', date: '', time: '', message: 'A portrait shoot enquiry for testing.', consent: 'on', ...overrides };
  for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value);
  return data;
}
async function send(path, init = {}) {
  const url = origin + path;
  // Serialize Node FormData so the Worker receives a real multipart body.
  if (init.body instanceof FormData) {
    const request = new Request(url, init);
    init = { ...init, headers: Object.fromEntries(request.headers), body: new Uint8Array(await request.arrayBuffer()) };
  }
  return mf.dispatchFetch(url, init);
}
async function submit(data, expected = 200, headers = { Origin: origin }) {
  const response = await send('/api/enquiries', { method: 'POST', headers, body: data });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  if (expected === 200) assert.match(result.id, /^[0-9a-f-]{36}$/);
  else assert.equal(typeof result.error, 'string');
  return result;
}
let attachmentId, enquiryId;
await test('Enquiry and meeting form API', { concurrency: false }, async t => {
  try {
    const db = await mf.getD1Database('DB');
    for (const name of readdirSync('drizzle').filter(name => name.endsWith('.sql')).sort()) {
      for (const sql of readFileSync('drizzle/' + name, 'utf8').split('--> statement-breakpoint').filter(sql => sql.trim())) await db.prepare(sql).run();
    }
    const counts = async () => {
      const enquiries = await db.prepare('SELECT count(*) AS n FROM enquiries').first();
      const uploads = await db.prepare('SELECT count(*) AS n FROM uploads').first();
      const objects = await (await mf.getR2Bucket('BUCKET')).list();
      return [enquiries.n, uploads.n, objects.objects.length];
    };
    await t.test('F01: minimal enquiry is saved with new status and correct fields', async () => {
      const result = await submit(form()); enquiryId = result.id;
      const row = await db.prepare('SELECT * FROM enquiries WHERE id = ?').bind(result.id).first();
      assert.equal(row.name, 'QA Test Person'); assert.equal(row.email, 'qa@example.com');
      assert.equal(row.package, 'Photography'); assert.equal(row.type, 'Enquiry'); assert.equal(row.status, 'new');
      assert.equal(row.date, ''); assert.equal(row.time, ''); assert.ok(row.created_at);
    });
    await t.test('F02: all five package choices are accepted and stored', async () => {
      for (const pkg of ['Photography', 'Videography', 'Reels & posts', 'Photo + video', 'Not sure yet']) {
        const result = await submit(form({ package: pkg }));
        assert.equal((await db.prepare('SELECT package FROM enquiries WHERE id = ?').bind(result.id).first()).package, pkg);
      }
    });
    await t.test('F03: meeting with future date/time is stored as a request', async () => {
      const result = await submit(form({ type: 'Meeting', date: shiftDate(7), time: '10:30' }));
      const row = await db.prepare('SELECT * FROM enquiries WHERE id = ?').bind(result.id).first();
      assert.equal(row.date, shiftDate(7)); assert.equal(row.time, '10:30'); assert.equal(row.type, 'Meeting'); assert.equal(row.status, 'new');
    });
    await t.test('F04: today is accepted in Perth time', async () => { await submit(form({ date: today })); });
    await t.test('F05: surrounding whitespace is trimmed', async () => {
      const result = await submit(form({ name: '  Test Person  ', email: '  qa@example.com  ', message: '  A test enquiry with whitespace.  ' }));
      const row = await db.prepare('SELECT * FROM enquiries WHERE id = ?').bind(result.id).first();
      assert.equal(row.name, 'Test Person'); assert.equal(row.email, 'qa@example.com'); assert.equal(row.message, 'A test enquiry with whitespace.');
    });
    await t.test('F06: valid field length boundaries are accepted', async () => {
      await submit(form({ name: 'Ab', message: '0123456789' }));
      await submit(form({ name: 'N'.repeat(100), phone: '1'.repeat(40), message: 'M'.repeat(5000) }));
    });
    const invalid = [
      ['F07', 'empty name', { name: '' }], ['F08', 'one character name', { name: 'A' }],
      ['F09', 'name over 100 characters', { name: 'N'.repeat(101) }],
      ['F10', 'missing email', { email: undefined }], ['F11', 'malformed email', { email: 'not-an-email' }],
      ['F12', 'email over 254 characters', { email: 'a'.repeat(245) + '@example.com' }],
      ['F13', 'phone over 40 characters', { phone: '1'.repeat(41) }],
      ['F14', 'blank message', { message: '   ' }], ['F15', 'message below 10 characters', { message: '123456789' }],
      ['F16', 'message over 5000 characters', { message: 'M'.repeat(5001) }],
      ['F17', 'missing consent', { consent: undefined }], ['F18', 'invalid consent', { consent: 'false' }],
      ['F19', 'unknown package', { package: 'Invalid package' }], ['F20', 'unknown form type', { type: 'Instant booking' }],
      ['F21', 'meeting without date', { type: 'Meeting', time: '10:00' }],
      ['F22', 'meeting without time', { type: 'Meeting', date: shiftDate(7) }],
      ['F23', 'past date', { date: shiftDate(-1) }], ['F24', 'impossible date', { date: '2099-02-30' }],
      ['F25', 'wrong date format', { date: '20/12/2099' }], ['F26', 'invalid time', { time: '25:00' }],
      ['F27', 'filled honeypot', { website: 'https://spam.invalid' }],
    ];
    for (const [id, label, overrides] of invalid) await t.test(id + ': reject ' + label + ' without creating records', async () => {
      const before = await counts(); await submit(form(overrides), 400); assert.deepEqual(await counts(), before);
    });
    await t.test('F28: JPEG, PNG and WebP attachments persist with their enquiry', async () => {
      const data = form();
      for (const [bytes, name, type] of [[jpg, 'portrait.jpg', 'image/jpeg'], [png, 'reference.png', 'image/png'], [webp, 'reference.webp', 'image/webp']]) data.append('photos', new File([bytes], name, { type }));
      const result = await submit(data);
      const rows = (await db.prepare('SELECT * FROM uploads WHERE enquiry_id = ?').bind(result.id).all()).results;
      assert.equal(rows.length, 3); assert.deepEqual(rows.map(row => row.mime).sort(), ['image/jpeg', 'image/png', 'image/webp']);
      for (const row of rows) {
        const object = await (await mf.getR2Bucket('BUCKET')).get(row.id);
        assert.ok(object); assert.equal(object.size, row.size); assert.equal(object.httpMetadata.contentType, row.mime);
      }
      attachmentId = rows[0].id;
    });
    await t.test('F29: reject four photos without creating records or stored objects', async () => {
      const before = await counts(), data = form();
      for (let i = 0; i < 4; i++) data.append('photos', new File([jpg], i + '.jpg', { type: 'image/jpeg' }));
      await submit(data, 400); assert.deepEqual(await counts(), before);
    });
    await t.test('F30: accept exactly 8 MiB and reject one byte above it', async () => {
      const bytes = new Uint8Array(8 * 1024 * 1024); bytes.set(jpg);
      const valid = form(); valid.append('photos', new File([bytes], 'boundary.jpg', { type: 'image/jpeg' })); await submit(valid);
      const before = await counts(), invalid = form(); invalid.append('photos', new File([bytes, new Uint8Array(1)], 'large.jpg', { type: 'image/jpeg' }));
      await submit(invalid, 400); assert.deepEqual(await counts(), before);
    });
    await t.test('F31: reject renamed text masquerading as a PNG', async () => {
      const before = await counts(), data = form(); data.append('photos', new File(['plain text'], 'fake.png', { type: 'image/png' }));
      await submit(data, 400); assert.deepEqual(await counts(), before);
    });
    await t.test('F32: reject mismatched JPEG bytes and PNG MIME type', async () => {
      const before = await counts(), data = form(); data.append('photos', new File([jpg], 'fake.png', { type: 'image/png' }));
      await submit(data, 400); assert.deepEqual(await counts(), before);
    });
    await t.test('F33: reject cross-origin submissions', async () => { const before = await counts(); await submit(form(), 403, { Origin: 'https://other.invalid' }); assert.deepEqual(await counts(), before); });
    await t.test('F34: reject submissions without Origin', async () => { const before = await counts(); await submit(form(), 403, {}); assert.deepEqual(await counts(), before); });
    await t.test('F35: authorised dashboard reads attachment and changes status', async () => {
      const response = await send('/api/media/' + attachmentId); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const update = await send('/api/enquiries', { method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: enquiryId, status: 'contacted' }) }); assert.equal(update.status, 200);
      assert.equal((await db.prepare('SELECT status FROM enquiries WHERE id = ?').bind(enquiryId).first()).status, 'contacted');
    });
    await t.test('F36: unauthorised visitor cannot read inbox, read private photos or change status', async () => {
      await mf.setOptions({ ...options, bindings: {} });
      assert.equal((await send('/api/enquiries')).status, 403);
      assert.equal((await send('/api/media/' + attachmentId)).status, 404);
      assert.equal((await send('/api/enquiries', { method: 'PATCH', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: enquiryId, status: 'closed' }) })).status, 403);
    });
  } finally {
    await mf.dispose(); rmSync(temp, { recursive: true, force: true });
  }
});
