import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--use-angle=metal','--user-data-dir=/tmp/sp/.chrome'], defaultViewport:{width:1440,height:900}});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e => errs.push('ERR '+e.message));
p.on('console', m => { if (m.type()==='error') errs.push('CON '+m.text()); });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
await p.goto('http://localhost:3000', {waitUntil:'networkidle0'});
await p.evaluate(()=>localStorage.clear());
await p.reload({waitUntil:'networkidle0'}); await sleep(2500);
await p.keyboard.press('Enter'); await sleep(4500);
// walk a few directions so the sheet's three views all get exercised
const shots = [['s','south'],['d','east'],['w','north'],['a','west']];
for (const [k,name] of shots) {
  await p.keyboard.down(k); await sleep(650);
  await p.screenshot({path:`/tmp/sp-${name}.png`});
  await p.keyboard.up(k); await sleep(120);
}
console.log(await p.evaluate(()=>{
  const g = window.__game.scene.getScene('game');
  return `sheet=${g.player.baked.key} w=${g.player.baked.w} h=${g.player.baked.h} dir=${g.player.dir} clip=${g.player.clip} fps=${Math.round(window.__game.loop.actualFps)}`;
}));
console.log('errors', errs.length, errs.slice(0,3).join('\n'));
await b.close();
