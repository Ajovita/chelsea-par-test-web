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
function form(overrides = {}) {
  const data = new URLSearchParams();
  const values = { name: 'QA Test Person', email: 'qa@example.com', phone: '', package: 'Photography', type: 'Enquiry', date: '', time: '', message: 'A portrait shoot enquiry for testing.', consent: 'on', ...overrides };
  for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value);
  return data;
}
async function send(path, init = {}) {
  const url = origin + path;
  // Serialize Node FormData so the Worker receives a real multipart body.
  if (init.body instanceof FormData || init.body instanceof URLSearchParams) {
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
let enquiryId;
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
    await t.test('F28: reject multipart photo attachments without storing anything', async () => {
      const before=await counts(), data=new FormData();
      for(const [key,value] of form())data.set(key,value);
      data.append('photos',new File([jpg],'photo.jpg',{type:'image/jpeg'}));
      await submit(data,415); assert.deepEqual(await counts(),before);
    });
    await t.test('F29: reject legacy multipart enquiries even without photos', async () => {
      const before=await counts(), data=new FormData(); for(const [key,value] of form())data.set(key,value);
      await submit(data,415);assert.deepEqual(await counts(),before);
    });
    await t.test('F30: reject actual request bodies over 64 KiB without relying on Content-Length', async () => {
      const before=await counts();
      const response=await send('/api/enquiries',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'message='+ 'A'.repeat(65536)});
      assert.equal(response.status,413);assert.deepEqual(await counts(),before);
    });
    await t.test('F31: reject legacy photos field in a text enquiry', async () => {
      const before=await counts();await submit(form({photos:'photo.jpg'}),400);assert.deepEqual(await counts(),before);
    });
    await t.test('F32: reject unsupported JSON request format', async () => {
      const before=await counts();const response=await send('/api/enquiries',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Test Person'})});
      assert.equal(response.status,415);assert.deepEqual(await counts(),before);
    });
    await t.test('F33: reject cross-origin submissions', async () => { const before = await counts(); await submit(form(), 403, { Origin: 'https://other.invalid' }); assert.deepEqual(await counts(), before); });
    await t.test('F34: reject submissions without Origin', async () => { const before = await counts(); await submit(form(), 403, {}); assert.deepEqual(await counts(), before); });
    await t.test('F35: authorised dashboard reads text-only inbox and changes status', async () => {
      const inbox=await (await send('/api/enquiries')).json();assert.ok(inbox.enquiries.length);assert.equal('uploads' in inbox,false);
      const update=await send('/api/enquiries',{method:'PATCH',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id:enquiryId,status:'contacted'})});assert.equal(update.status,200);
      assert.equal((await db.prepare('SELECT status FROM enquiries WHERE id = ?').bind(enquiryId).first()).status,'contacted');
      await (await mf.getR2Bucket('BUCKET')).put('historical-attachment',jpg,{httpMetadata:{contentType:'image/jpeg'}});
      assert.equal((await send('/api/media/historical-attachment')).status,404);
    });
    await t.test('F36: unauthorised visitor cannot read inbox or change status', async () => {
      await mf.setOptions({...options,bindings:{}});assert.equal((await send('/api/enquiries')).status,403);
      assert.equal((await send('/api/enquiries',{method:'PATCH',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id:enquiryId,status:'closed'})})).status,403);
    });
    await t.test('F37: studio portfolio photo upload remains available only to authorised owner', async () => {
      await mf.setOptions(options);const data=new FormData();data.set('title','QA portfolio');data.set('category','Photography');data.set('description','QA only');data.set('image',new File([jpg],'cover.jpg',{type:'image/jpeg'}));
      const response=await send('/api/projects',{method:'POST',headers:{Origin:origin},body:data});assert.equal(response.status,200);
      const projects=await (await send('/api/projects')).json();assert.equal(projects.length,1);
      await mf.setOptions({...options,bindings:{}});
      assert.equal((await send('/api/media/'+projects[0].imageId)).status,200);
      assert.equal((await send('/api/projects',{method:'POST',headers:{Origin:origin},body:data})).status,403);
    });
  } finally {
    await mf.dispose(); rmSync(temp, { recursive: true, force: true });
  }
});
