import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--use-angle=metal','--user-data-dir=/tmp/sp/.chrome2'], defaultViewport:{width:1440,height:900}});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e => errs.push('ERR '+e.message));
p.on('console', m => { if (m.type()==='error') errs.push('CON '+m.text()); });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
await p.goto('http://localhost:3000', {waitUntil:'networkidle0'});
await p.evaluate(()=>localStorage.clear());
await p.reload({waitUntil:'networkidle0'}); await sleep(2500);
await p.keyboard.press('Enter'); await sleep(4500);
const ids = process.argv[2] ? process.argv[2].split(',') : ['hollow','gravewarden','choirman'];
await p.evaluate((ids)=>{
  const g = window.__game.scene.getScene('game');
  g.player.maxHp = g.player.hp = 99999;
  ids.forEach((id,i)=>{
    const a = Math.PI*2*i/ids.length;
    g.spawnEnemy(id, g.player.x + Math.cos(a)*3.5, g.player.y + Math.sin(a)*3.5, 0);
  });
}, ids);
await sleep(2000);
await p.screenshot({path:'/tmp/sheets-idle.png'});
for (let i=0;i<6;i++){ await p.mouse.click(720,450); await sleep(300); }
await p.screenshot({path:'/tmp/sheets-fight.png'});
console.log(await p.evaluate(()=>{
  const g = window.__game.scene.getScene('game');
  return g.actors.map(a=>`${a.name}:${a.baked.key}(${a.baked.w}x${a.baked.h}) clip=${a.clip}`).join(' | ');
}));
console.log('errors', errs.length, errs.slice(0,3).join('\n'));
await b.close();
