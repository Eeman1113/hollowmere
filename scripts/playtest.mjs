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
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async name => { const pk = await page.evaluate(() => window.__game?.scene.getScene('ui')?.panelKind ?? null).catch(() => null); await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name, 'panel:', pk); };
const hold = async (key, ms) => { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); };
const game = fn => page.evaluate(fn);

await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await sleep(2500);
await shot('01-title');
await page.keyboard.press('Enter');
await sleep(2500);
await shot('02-start');
await hold('s', 900);
await hold('d', 700);
await sleep(300);
await shot('03-moved');
await page.keyboard.press('i');
await sleep(500);
await shot('04-inventory');
await page.keyboard.press('i');
await page.keyboard.press('c');
await sleep(400);
await shot('05-craft');
await page.keyboard.press('Escape');
await page.keyboard.press('m');
await sleep(400);
await shot('06-map');
await page.keyboard.press('Escape');
// exit the house and walk to the plaza
await hold('s', 1600);
await hold('d', 2200);
await shot('07-village');
// night
await game(() => { const g = window.__game.scene.getScene('game'); g.minutes += (23 - g.hour) * 60; });
await sleep(800);
await shot('08-night');
// teleport near forest to see creatures, then fight
await game(() => { const g = window.__game.scene.getScene('game'); g.player.x = g.P.x = 50.5; g.player.y = g.P.y = 75.5; g.minutes += 12 * 60; g.spawnMob('wolf', 52, 76); g.spawnMob('boar', 48, 77); g.spawnMob('deer', 53, 73); });
await sleep(1200);
await shot('09-creatures');
for (let i = 0; i < 6; i++) { await page.mouse.click(760, 470); await sleep(350); }
await shot('10-fight');
// bandit camp + boss
await game(() => { const g = window.__game.scene.getScene('game'); g.player.x = g.P.x = 76.5; g.player.y = g.P.y = 22.5; g.P.hp = g.P.maxHp = 999; });
await sleep(1500);
await shot('11-bandits');
await game(() => { const g = window.__game.scene.getScene('game'); g.player.x = g.P.x = 18.5; g.player.y = g.P.y = 28.5; });
await sleep(2500);
await shot('12-chapel');
const state = await game(() => { const g = window.__game.scene.getScene('game'); return { hp: g.P.hp, mobs: g.mobs.length, fps: window.__game.loop.actualFps, inv: g.P.inv }; });
console.log(JSON.stringify(state));
fs.writeFileSync(`${out}/errors.txt`, errors.join('\n'));
console.log(`errors: ${errors.length}`);
console.log(errors.slice(0, 15).join('\n'));
await browser.close();
