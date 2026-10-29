#!/usr/bin/env node
// Headless playtest: drives the game in system Chrome, captures screenshots + console errors.
// Usage: node scripts/playtest.mjs [outDir] [url]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const out = process.argv[2] || './playtest-out';
const url = process.argv[3] || 'http://localhost:3000';
fs.mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--window-size=1440,900', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', `--user-data-dir=${out}/.chrome`],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 4).join('\n')}`));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async name => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const hold = async (key, ms) => { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); };
const game = fn => page.evaluate(fn);

await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await sleep(3000);
await shot('01-title');
await page.keyboard.press('Enter');
await sleep(4000);
await shot('02-start');

// walk around the hub
await hold('s', 900);
await hold('d', 700);
await sleep(300);
await shot('03-moved');

// panels
for (const [k, name] of [['i', '04-inventory'], ['c', '05-character'], ['j', '06-journal'], ['m', '07-map'], ['h', '08-help']]) {
  await page.keyboard.press('Escape');
  await sleep(150);
  await page.keyboard.press(k);
  await sleep(500);
  await shot(name);
}
await page.keyboard.press('Escape');
await sleep(300);

// combat: spawn a few enemies next to the player and fight
await game(() => {
  const g = window.__game.scene.getScene('game');
  for (const [id, dx, dy] of [['hollow', 2, 0], ['hollow_axe', -2, 1], ['fenhound', 0, 2]]) {
    g.spawnEnemy(id, g.player.x + dx, g.player.y + dy, 1);
  }
});
await sleep(1600);
await shot('09-enemies');
for (let i = 0; i < 8; i++) { await page.mouse.click(760, 450); await sleep(260); }
await shot('10-fight');
await page.keyboard.press(' ');
await sleep(200);
await shot('11-roll');

// night
await game(() => { const g = window.__game.scene.getScene('game'); g.minutes = 23 * 60; });
await sleep(900);
await shot('12-night');

// travel to the cathedral story site
await game(() => {
  const g = window.__game.scene.getScene('game');
  const s = g.gen.sites.find(s => s.id === 'choir');
  g.player.x = g.P.x = s.x + 0.5; g.player.y = g.P.y = s.y + 14;
  g.minutes = 10 * 60;
  g.stream.update(g.P.x, g.P.y);
});
await sleep(3000);
await shot('13-cathedral');
await game(() => {
  const g = window.__game.scene.getScene('game');
  const s = g.gen.sites.find(s => s.id === 'choir');
  g.player.x = g.P.x = s.x + 0.5; g.player.y = g.P.y = s.y + 4;
});
await sleep(2500);
await shot('14-boss');

// armour change — proves gear renders on the character
await game(() => {
  const g = window.__game.scene.getScene('game');
  for (const id of ['grave_helm', 'grave_plate', 'grave_arms', 'grave_legs', 'gravewarden_halberd', 'ossuary_tower']) {
    g.P.inv.push({ id, qty: 1 });
  }
  g.P.equip.helm = 'grave_helm'; g.P.equip.chest = 'grave_plate';
  g.P.equip.arms = 'grave_arms'; g.P.equip.legs = 'grave_legs';
  g.P.equip.weapon = 'gravewarden_halberd'; g.P.equip.offhand = 'ossuary_tower';
  g.refreshAppearance();
});
await sleep(1500);
await shot('15-armoured');

const state = await game(() => {
  const g = window.__game.scene.getScene('game');
  return {
    hp: Math.round(g.player.hp), maxHp: g.player.maxHp, runes: g.P.runes,
    actors: g.actors.length, props: g.stream.props.size, chunks: g.stream.live.size,
    fps: Math.round(window.__game.loop.actualFps), biome: g.biome,
    textures: window.__game.textures.list ? Object.keys(window.__game.textures.list).length : -1,
  };
});
console.log('STATE', JSON.stringify(state));
fs.writeFileSync(`${out}/errors.txt`, errors.join('\n'));
console.log(`errors: ${errors.length}`);
console.log(errors.slice(0, 12).join('\n'));
await browser.close();
