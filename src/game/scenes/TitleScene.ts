import * as Phaser from 'phaser';
import { makeFallbackCharacters, makeGroundAtlas, makeItemIcons, makeObjectTextures } from '../textures';
import { registerCodedSprites } from '../sprites';
import { hasSave, clearSave } from '../state';
import { FONT } from '../font';
import { sfx } from '../sfx';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    registerCodedSprites(this); // ChatGPT-derived pixel sprites first …
    makeFallbackCharacters(this); // … procedural ones fill any gaps
    makeGroundAtlas(this);
    makeObjectTextures(this);
    makeItemIcons(this);
    berryBushes(this);
    this.scene.start('title');
  }
}

function berryBushes(scene: Phaser.Scene) {
  // The generated bush has no fruit: paint berries onto a copy so picked/unpicked bushes read differently.
  if (!scene.textures.exists('bush_idle_0')) return;
  const src = scene.textures.get('bush_idle_0').getSourceImage() as HTMLCanvasElement;
  const tex = scene.textures.createCanvas('bush_berries', src.width, src.height);
  if (!tex) return;
  const c = tex.getContext();
  c.drawImage(src, 0, 0);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(src.width * (0.18 + rnd() * 0.64)), y = Math.floor(src.height * (0.15 + rnd() * 0.55));
    c.fillStyle = '#5a0a14'; c.fillRect(x, y, 3, 3);
    c.fillStyle = i % 2 ? '#c82838' : '#e84858'; c.fillRect(x, y, 2, 2);
  }
  tex.refresh();
}

export class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    const w = this.scale.width, h = this.scale.height;
    this.cameras.main.setBackgroundColor('#0b1016');
    const bg = this.add.graphics();
    const draw = () => {
      const W2 = this.scale.width, H2 = this.scale.height;
      bg.clear();
      for (let i = 0; i < 24; i++) { bg.fillStyle(Phaser.Display.Color.GetColor(14 + i, 20 + i * 1.2, 30 + i * 1.5), 1); bg.fillRect(0, (H2 * i) / 24, W2, H2 / 24 + 1); }
      bg.fillStyle(0xe8e0c8, 0.9).fillCircle(W2 * 0.78, H2 * 0.2, 34);
      bg.fillStyle(0x0b1016, 1).fillCircle(W2 * 0.78 + 12, H2 * 0.2 - 6, 30);
    };
    draw();
    // treeline silhouette using the in-game tree textures
    const trees: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 26; i++) {
      const t = this.add.image((i / 25) * w + Phaser.Math.Between(-20, 20), h + 10, i % 3 ? 'pine' : 'tree').setOrigin(0.5, 1).setScale(1.6 + Math.random() * 0.8).setTint(0x1a2a24);
      trees.push(t);
    }
    const hero = this.add.image(w / 2, h - 60, 'player_front_0').setOrigin(0.5, 1).setScale(3);
    this.time.addEvent({ delay: 180, loop: true, callback: () => { const f = (Number(hero.texture.key.split('_').pop()) + 1) % 4; if (this.textures.exists(`player_front_${f}`)) hero.setTexture(`player_front_${f}`); } });
    const title = this.add.text(w / 2, h * 0.24, 'HOLLOWMERE', { fontFamily: FONT, fontSize: '96px', color: '#e8d8a0', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5);
    const sub = this.add.text(w / 2, h * 0.24 + 70, 'an isometric survival RPG', { fontFamily: FONT, fontSize: '26px', color: '#9ab0a0' }).setOrigin(0.5);
    const tag = this.add.text(w / 2, h * 0.24 + 104, 'This is how you lived.', { fontFamily: FONT, fontSize: '20px', color: '#6a8078' }).setOrigin(0.5);
    const btns: Phaser.GameObjects.GameObject[] = [];
    const mk = (y: number, label: string, cb: () => void) => {
      const r = this.add.rectangle(w / 2, y, 280, 48, 0x2a241c, 0.9).setStrokeStyle(2, 0x6a5838).setInteractive({ useHandCursor: true });
      const t = this.add.text(w / 2, y, label, { fontFamily: FONT, fontSize: '26px', color: '#e8dcc0' }).setOrigin(0.5);
      r.on('pointerover', () => r.setFillStyle(0x4a3e2a)); r.on('pointerout', () => r.setFillStyle(0x2a241c));
      r.on('pointerdown', () => { sfx.click(); cb(); });
      btns.push(r, t);
      return [r, t] as const;
    };
    let y = h * 0.52;
    if (hasSave()) { mk(y, 'Continue', () => this.scene.start('game', { load: true })); y += 62; }
    mk(y, 'New Game', () => { clearSave(); this.scene.start('game', { load: false }); });
    const help = this.add.text(w / 2, h * 0.52 + 140, 'WASD move · Click attack · E interact · I inventory · C craft · H help', { fontFamily: FONT, fontSize: '18px', color: '#7a8a80' }).setOrigin(0.5);
    // drifting embers
    const embers = this.add.particles(0, 0, 'px', { x: { min: 0, max: w }, y: h, lifespan: 6000, speedY: { min: -40, max: -15 }, speedX: { min: -10, max: 10 }, scale: { start: 1.5, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: [0xffa040, 0x60ffe0], frequency: 120 });
    this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('game', { load: hasSave() }));
    this.scale.on('resize', () => this.scene.restart());
    this.events.once('shutdown', () => this.scale.removeAllListeners('resize'));
    void [title, sub, tag, help, embers, trees];
  }
}
