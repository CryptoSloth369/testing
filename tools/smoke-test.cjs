// Headless smoke test: serves the game, loads it (desktop or phone), walks, sits, and saves screenshots.
// Uses the Playwright + Chromium that cloud sessions have preinstalled. Software rendering is slow
// (~1 fps), so this checks behaviour, not frame rate.
//
//   node tools/smoke-test.cjs            desktop
//   node tools/smoke-test.cjs phone      phone emulation with touch input
//   ROOT=dist-artifact node tools/smoke-test.cjs   (test an artifact build; add a CSP to mimic the viewer)

const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '..'));
const OUT = path.resolve(process.env.OUT || path.join(__dirname, '..', 'test-shots'));
const phone = process.argv[2] === 'phone';
fs.mkdirSync(OUT, { recursive: true });

const types = { '.js': 'text/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary' };
const srv = http.createServer((q, s) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  fs.readFile(f, (e, d) => {
    if (e) { s.writeHead(404); s.end(); return; }
    // the artifact viewer blocks fetches of data: URLs; mimic that
    s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'content-security-policy': "connect-src 'self'" });
    s.end(d);
  });
}).listen(8130, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext(phone ? { ...devices['Pixel 5'], deviceScaleFactor: 1 } : { viewport: { width: 640, height: 360 } });
  const pg = await ctx.newPage();
  let errors = 0;
  pg.on('pageerror', (e) => { errors++; console.log('PAGE ERROR', e.message); });
  const shot = async (name) => {
    const url = await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(window.__dream.renderer.domElement.toDataURL('image/jpeg', 0.9)))));
    fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
  };
  const state = () => pg.evaluate(() => ({ state: window.__dream.player.state, pos: window.__dream.player.position.toArray().map((v) => +v.toFixed(2)) }));

  await pg.goto('http://localhost:8130/');
  await pg.waitForFunction(() => window.__dream, null, { timeout: 120000 });
  await (phone ? pg.tap('#enter') : pg.click('#enter'));

  if (phone) {
    const cdp = await ctx.newCDPSession(pg);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    await touch('touchStart', [[80, 600]]); await touch('touchMove', [[80, 560]]);
    await pg.waitForTimeout(4000); await touch('touchEnd', []);
  } else {
    await pg.keyboard.down('KeyW'); await pg.waitForTimeout(4000); await pg.keyboard.up('KeyW');
  }
  console.log('after walking', await state());
  await shot(`${phone ? 'phone' : 'desktop'}-walk.jpg`);

  await pg.evaluate(() => window.__dream.player.position.set(0.3, 0, -17));
  await pg.waitForTimeout(1500);
  if (phone) await pg.tap('#btn-sit'); else await pg.keyboard.press('KeyE');
  await pg.evaluate(() => { window.__dream.trip.raw = 1; });
  await pg.waitForTimeout(18000);
  console.log('after sitting', await state());
  await shot(`${phone ? 'phone' : 'desktop'}-trip.jpg`);

  console.log(errors ? `${errors} page error(s)` : 'no page errors', '· screenshots in', OUT);
  await browser.close(); srv.close();
});
