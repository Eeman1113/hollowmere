import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--use-angle=metal','--user-data-dir=/tmp/sp/.chrome3'], defaultViewport:{width:1440,height:900}});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e => errs.push('ERR '+e.message));
p.on('console', m => { if (m.type()==='error') errs.push('CON '+m.text()); });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
await p.goto('http://localhost:3000', {waitUntil:'networkidle0'});
await p.evaluate(()=>localStorage.clear());
await p.reload({waitUntil:'networkidle0'}); await sleep(2500);
await p.keyboard.press('Enter'); await sleep(4500);
// gather every hub NPC around the player so the whole cast is in one frame
await p.evaluate(()=>{
  const g = window.__game.scene.getScene('game');
  const ids = ['elder','merchant','herbalist','warden','bellkeeper','smith','hunter'];
  ids.forEach((id,i)=>{
    const a = Math.PI*2*i/ids.length;
    let n = g.npcs.find(x=>x.npc===id);
    if (!n) { g.spawnNpc(id, g.P.x + Math.cos(a)*4, g.P.y + Math.sin(a)*4); n = g.npcs.find(x=>x.npc===id); }
    if (n) { n.x = g.P.x + Math.cos(a)*4; n.y = g.P.y + Math.sin(a)*4; }
  });
});
await sleep(1500);
await p.screenshot({path:'/tmp/hub-cast.png'});
console.log(await p.evaluate(()=>{
  const g = window.__game.scene.getScene('game');
  return g.npcs.map(n=>`${n.npc}:${n.baked.key}`).join(' | ');
}));
console.log('errors', errs.length, errs.slice(0,3).join('\n'));
await b.close();
