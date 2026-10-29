import * as Phaser from 'phaser';
import { Px, upload, shade } from '../art/raster';
import { makeGlow, makeLightMask, makeShadow, makeSwatch, bakeNow } from '../art/bake';
import { makeTileAtlas } from '../art/tiles';
import { paintProp } from '../art/propdraw';
import { PLAYER_CLIPS } from '../art/anim';
import { LOOKS } from '../art/looks';
import { P } from '../art/palette';
import { O } from '../world/types';
import { mulberry32 } from '../core';
import { hasSave, clearSave } from '../state';
import { FONT } from '../font';
import { button, C, frame, txt } from '../ui/widgets';
import { sfx } from '../sfx';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    makeShadow(this);
    makeTileAtlas(this);
    makeGlow(this, 'glow_warm', P.flame, 96);
    makeLightMask(this);
    makeSwatch(this, 'spark', [255, 255, 255], 3, 3, true);
    makeTitleArt(this);
    this.scene.start('title');
  }
}

/** A painted key-art plate for the menu: a lantern on a hill under a dead sky. */
function makeTitleArt(scene: Phaser.Scene) {
  const W = 480, H = 270;
  const px = new Px(W, H);
  const r = mulberry32(90210);
  // sky
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const c = [
      10 + t * 26 + (1 - t) * 4,
      12 + t * 22,
      22 + t * 20,
    ] as [number, number, number];
    px.rect(0, y, W, 1, c);
  }
  // a low moon
  px.ellipse(W * 0.74, H * 0.22, 42, 42, [40, 46, 62], 0.5);
  px.ellipse(W * 0.74, H * 0.22, 26, 26, [168, 180, 206]);
  px.ellipse(W * 0.72, H * 0.2, 20, 20, [188, 198, 220]);
  // ridge lines
  const ridge = (baseY: number, amp: number, col: [number, number, number], step: number) => {
    for (let x = 0; x < W; x++) {
      const y = baseY + Math.sin(x / step) * amp + Math.sin(x / (step * 0.37)) * amp * 0.4;
      px.rect(x, y, 1, H - y, col);
    }
  };
  ridge(H * 0.56, 10, [22, 26, 36], 70);
  ridge(H * 0.68, 7, [16, 19, 27], 44);
  ridge(H * 0.8, 5, [10, 12, 18], 30);
  // dead trees on the near ridge
  for (let i = 0; i < 9; i++) {
    const x = 20 + r() * (W - 40);
    const base = H * 0.8 + Math.sin(x / 30) * 5 + Math.sin(x / 11) * 2 + 2;
    const h = 24 + r() * 26;
    px.capsule(x, base, x + (r() - 0.5) * 6, base - h, 2.2, 0.8, [8, 9, 14]);
    for (let k = 0; k < 4; k++) {
      const a = -1.9 + r() * 1.6;
      px.capsule(x, base - h * (0.6 + r() * 0.4), x + Math.cos(a) * 12, base - h + Math.sin(a) * 8, 1.2, 0.3, [8, 9, 14]);
    }
  }
  // the lantern
  const lx = W * 0.3, ly = H * 0.78;
  const lp = new Px(90, 120);
  paintProp(O.LANTERN, { px: lp, cx: 45, by: 112, r: mulberry32(5), v: 0, h: 1 });
  lp.outline([8, 7, 10], 0.9);
  lp.blitTo(px, lx - 45, ly - 112);
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = r() * 70;
    px.blend(lx + Math.cos(a) * d, ly - 40 + Math.sin(a) * d * 0.7, P.flame, 0.04 * (1 - d / 70));
  }
  // drifting ash
  for (let i = 0; i < 120; i++) px.blend(r() * W, r() * H, [180, 180, 190], 0.1 + r() * 0.2);
  px.grain(3, 0.06);
  upload(scene, 'titleart', px);
  void shade;
}

export class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }

  create() {
    const { width: w, height: h } = this.scale;
    this.cameras.main.setBackgroundColor('#05070b');

    const art = this.add.image(w / 2, h / 2, 'titleart');
    const sc = Math.max(w / 480, h / 270);
    art.setScale(sc).setAlpha(0.95);
    this.tweens.add({ targets: art, scale: sc * 1.06, duration: 24000, yoyo: true, repeat: -1 });

    const shade2 = this.add.graphics();
    shade2.fillStyle(0x05070b, 0.45).fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      shade2.fillStyle(0x000000, 0.07);
      shade2.fillRect(0, 0, w, i * 18 + 18);
      shade2.fillRect(0, h - i * 18 - 18, w, i * 18 + 18);
    }

    txt(this, w / 2, h * 0.24, 'HOLLOWMERE', 86, C.goldHi).setOrigin(0.5).setScrollFactor(0);
    txt(this, w / 2, h * 0.355, 'the lamps are going out', 24, C.dim).setOrigin(0.5);
    const g = this.add.graphics();
    g.lineStyle(1, C.edge, 0.6).lineBetween(w / 2 - 200, h * 0.395, w / 2 + 200, h * 0.395);

    const save = hasSave();
    const items: [string, () => void, boolean][] = [
      ['Continue', () => this.start(true), save],
      ['New Journey', () => this.confirmNew(save), true],
      ['Controls', () => this.showHelp(), true],
    ];
    items.forEach(([label, fn, en], i) => {
      const bw = 300, bx = w / 2 - bw / 2, by = h * 0.47 + i * 62;
      const b = button(this, bx, by, bw, 46, label, () => { sfx.click(); fn(); }, en, 24);
      void b;
    });

    txt(this, w / 2, h - 46, 'An isometric soulslike. Every sprite, tile and sound is generated in code.', 17, C.dim).setOrigin(0.5);
    txt(this, w / 2, h - 24, 'Press ENTER to begin', 18, C.gold).setOrigin(0.5);
    this.input.keyboard!.once('keydown-ENTER', () => this.start(save));
  }

  confirmNew(hasOld: boolean) {
    if (!hasOld) return this.start(false);
    const { width: w, height: h } = this.scale;
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(0x05070b, 0.9).fillRect(0, 0, w, h);
    frame(this, g, w / 2 - 240, h / 2 - 110, 480, 220);
    txt(this, w / 2, h / 2 - 70, 'Abandon the old journey?', 26, C.goldHi).setOrigin(0.5).setDepth(41);
    txt(this, w / 2, h / 2 - 30, 'Your save will be erased.', 19, C.dim).setOrigin(0.5).setDepth(41);
    const yes = button(this, w / 2 - 190, h / 2 + 20, 170, 44, 'Begin anew', () => { clearSave(); this.start(false); }, true, 20);
    const no = button(this, w / 2 + 20, h / 2 + 20, 170, 44, 'Keep it', () => this.scene.restart(), true, 20);
    yes.bg.setDepth(41); yes.label.setDepth(42); no.bg.setDepth(41); no.label.setDepth(42);
  }

  showHelp() {
    const { width: w, height: h } = this.scale;
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(0x05070b, 0.93).fillRect(0, 0, w, h);
    frame(this, g, w / 2 - 320, h / 2 - 230, 640, 460);
    txt(this, w / 2, h / 2 - 206, 'CONTROLS', 30, C.goldHi).setOrigin(0.5).setDepth(41);
    const rows = [
      'W A S D — move', 'Shift — sprint', 'Space — roll (invulnerable)',
      'Left click — light attack', 'Right click — heavy attack',
      'Q — guard', 'Tab — lock on', 'F — two-hand',
      'E — interact / rest at a lantern', 'R — drink Lantern Oil',
      'I — equipment   C — self   J — journal   M — map', 'Esc — pause',
    ];
    rows.forEach((r, i) => txt(this, w / 2 - 270, h / 2 - 160 + i * 32, r, 21, C.text).setDepth(41));
    const b = button(this, w / 2 - 90, h / 2 + 170, 180, 44, 'Back', () => this.scene.restart(), true, 20);
    b.bg.setDepth(41); b.label.setDepth(42);
  }

  start(load: boolean) {
    // bake the player once up-front so the first frame of the game is correct
    bakeNow(this, { key: 'bake_player', look: LOOKS.player, clips: PLAYER_CLIPS, mirror: false, seed: 11 });
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('game', { load }));
  }
}

export { FONT };
