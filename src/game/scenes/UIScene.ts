import * as Phaser from 'phaser';
import { ITEMS, NPCS, O, QUESTS, RECIPES, SHOP_STOCK, SKILLS, SKILL_NAMES, T } from '../data';
import { W, H, type Stack } from '../world';
import { carryWeight, maxCarry, skillXpFor, xpForLevel, countItem } from '../state';
import { dialogFor, type DialogNode } from '../dialog';
import { sfx, isMuted, setMuted } from '../sfx';
import { FONT } from '../font';
import type { Actor, GameScene } from './GameScene';

type PanelKind = 'inv' | 'craft' | 'quests' | 'map' | 'help' | 'pause' | 'loot' | 'shop' | 'dialog' | 'end';

const C = {
  panel: 0x16130f, panelEdge: 0x6a5838, slot: 0x2a241c, slotHi: 0x4a3e2a, text: '#e8dcc0', dim: '#9a8e74', gold: '#f0d060',
};

export class UIScene extends Phaser.Scene {
  g!: GameScene;
  dark!: Phaser.GameObjects.RenderTexture;
  lightPool: Phaser.GameObjects.Image[] = [];
  rainG!: Phaser.GameObjects.Graphics;
  drops: { x: number; y: number; s: number }[] = [];
  hud!: Phaser.GameObjects.Graphics;
  hpText!: Phaser.GameObjects.Text;
  stText!: Phaser.GameObjects.Text;
  lvlText!: Phaser.GameObjects.Text;
  clock!: Phaser.GameObjects.Text;
  goldText!: Phaser.GameObjects.Text;
  prompt!: Phaser.GameObjects.Text;
  hints!: Phaser.GameObjects.Text;
  logTexts: Phaser.GameObjects.Text[] = [];
  logs: { msg: string; color: string; t: number }[] = [];
  moodleC!: Phaser.GameObjects.Container;
  moodleKey = '';
  equipC!: Phaser.GameObjects.Container;
  equipKey = '';
  mini!: Phaser.GameObjects.Container;
  miniDot!: Phaser.GameObjects.Arc;
  miniImg!: Phaser.GameObjects.Image;
  vignette!: Phaser.GameObjects.Image;
  hurt!: Phaser.GameObjects.Rectangle;
  panel: Phaser.GameObjects.Container | null = null;
  panelKind: PanelKind | null = null;
  panelRect = new Phaser.Geom.Rectangle();
  lootIdx = -1;
  dialogNode: DialogNode | null = null;
  dialogNpc: Actor | null = null;
  tooltip!: Phaser.GameObjects.Text;
  dirty = false;
  bannerText!: Phaser.GameObjects.Text;
  fadeRect!: Phaser.GameObjects.Rectangle;

  constructor() { super('ui'); }

  init(data: { game: GameScene }) { this.g = data.game; }

  create() {
    this.lightPool = []; this.logTexts = []; this.logs = []; this.panel = null; this.panelKind = null; this.drops = [];
    this.moodleKey = ''; this.equipKey = ''; this.dialogNpc = null;
    const w = this.scale.width, h = this.scale.height;
    this.dark = this.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(0);
    for (let i = 0; i < 48; i++) this.lightPool.push(new Phaser.GameObjects.Image(this, 0, 0, 'light'));
    this.rainG = this.add.graphics().setDepth(1);
    this.vignette = this.add.image(w / 2, h / 2, 'vignette').setDisplaySize(w, h).setDepth(2).setAlpha(0.55);
    this.hurt = this.add.rectangle(0, 0, w, h, 0xa00000, 0).setOrigin(0).setDepth(3);
    this.hud = this.add.graphics().setDepth(10);
    const ts = (size: number, color = C.text) => ({ fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 3 });
    this.hpText = this.add.text(0, 0, '', ts(15)).setDepth(11);
    this.stText = this.add.text(0, 0, '', ts(15)).setDepth(11);
    this.lvlText = this.add.text(0, 0, '', ts(16, '#ffe080')).setDepth(11);
    this.goldText = this.add.text(0, 0, '', ts(16, C.gold)).setDepth(11);
    this.clock = this.add.text(0, 0, '', ts(20)).setOrigin(0.5, 0).setDepth(11);
    this.prompt = this.add.text(0, 0, '', { ...ts(18, '#fff6d0'), backgroundColor: '#000000aa', padding: { x: 8, y: 3 } }).setOrigin(0.5, 1).setDepth(11);
    this.hints = this.add.text(0, 0, '[I] Inventory  [C] Craft  [J] Quests  [M] Map  [H] Help  [Esc] Menu', ts(14, C.dim)).setOrigin(0.5, 1).setDepth(11);
    for (let i = 0; i < 8; i++) this.logTexts.push(this.add.text(0, 0, '', { ...ts(15), wordWrap: { width: 460 } }).setDepth(11));
    this.moodleC = this.add.container(0, 0).setDepth(11);
    this.equipC = this.add.container(0, 0).setDepth(11);
    this.buildMinimap();
    this.tooltip = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '15px', color: C.text, backgroundColor: '#0c0a08ee', padding: { x: 8, y: 6 }, wordWrap: { width: 260 } }).setDepth(100).setVisible(false);
    this.bannerText = this.add.text(w / 2, h * 0.28, '', { fontFamily: FONT, fontSize: '44px', color: '#fff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(90).setAlpha(0);
    this.fadeRect = this.add.rectangle(0, 0, w, h, 0x000000, 0).setOrigin(0).setDepth(95);
    this.layout();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.onResize, this); this.lightPool.forEach(l => l.destroy()); this.lightPool = []; });

    // Hotkeys use a DOM listener: Phaser's queued key events can double-fire when
    // several keys arrive within one frame, which made Esc close and reopen panels.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !this.g.P) return;
      const k = e.key.toLowerCase();
      if (k === 'tab') e.preventDefault();
      if (this.panelKind === 'dialog' && this.dialogNode) {
        const n = Number(e.key);
        if (n >= 1 && n <= this.dialogNode.options.length) { this.chooseOption(n - 1); return; }
      }
      switch (k) {
        case 'i': case 'tab': this.toggle('inv'); break;
        case 'c': this.toggle('craft'); break;
        case 'j': this.toggle('quests'); break;
        case 'm': this.toggle('map'); break;
        case 'h': this.toggle('help'); break;
        case 'escape': if (this.panelKind === 'end') return; if (this.panel) this.close(); else if (!this.g.dead && !this.g.sleeping) this.open('pause'); break;
        case 'r': if (this.panelKind === 'loot') { this.g.takeFromContainer(this.lootIdx, 0, true); this.refresh(); } break;
        case 'e': this.g.interact(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (this.tooltip.visible) this.tooltip.setPosition(Math.min(p.x + 16, this.scale.width - this.tooltip.width - 4), Math.min(p.y + 12, this.scale.height - this.tooltip.height - 4)); });
  }

  onResize(size: Phaser.Structs.Size) {
    const w = size.width, h = size.height;
    this.dark.resize(w, h);
    this.vignette.setPosition(w / 2, h / 2).setDisplaySize(w, h);
    this.hurt.setSize(w, h);
    this.fadeRect.setSize(w, h);
    this.bannerText.setPosition(w / 2, h * 0.28);
    this.layout();
    if (this.panelKind) this.rebuild();
  }

  layout() {
    const w = this.scale.width, h = this.scale.height;
    this.hpText.setPosition(20, 14);
    this.stText.setPosition(20, 40);
    this.lvlText.setPosition(20, 68);
    this.goldText.setPosition(120, 68);
    this.clock.setPosition(w / 2, 10);
    this.prompt.setPosition(w / 2, h - 84);
    this.hints.setPosition(w / 2, h - 8);
    this.mini.setPosition(w - 100, 96);
    this.moodleC.setPosition(w - 20, 196);
    this.equipC.setPosition(w / 2 - 50, h - 68);
    this.logTexts.forEach((t, i) => t.setPosition(16, h - 40 - (this.logTexts.length - 1 - i) * 20));
  }

  // ---------- public API used by GameScene ----------
  log(msg: string, color = C.text) {
    this.logs.push({ msg, color, t: this.time.now });
    if (this.logs.length > 40) this.logs.shift();
    this.renderLog();
  }
  refresh() { this.dirty = true; }
  setPrompt(s: string | null) { this.prompt.setText(s ?? '').setVisible(!!s && !this.panel); }
  banner(s: string, color: string) {
    this.bannerText.setText(s).setColor(color).setAlpha(0).setScale(0.8);
    this.tweens.killTweensOf(this.bannerText);
    this.tweens.add({ targets: this.bannerText, alpha: 1, scale: 1, duration: 400, yoyo: true, hold: 1800 });
  }
  hurtFlash() { this.hurt.setFillStyle(0xa00000, 0.28); this.tweens.add({ targets: this.hurt, fillAlpha: 0, duration: 350 }); }
  blocksMovement() { return this.panelKind === 'dialog' || this.panelKind === 'shop' || this.panelKind === 'pause' || this.panelKind === 'end' || this.panelKind === 'help'; }
  blocksWorldClick() { return !!this.panel; }
  pausesGame() { return this.panelKind === 'pause' || this.panelKind === 'help'; }
  openLoot(i: number) { this.lootIdx = i; this.open('loot'); }
  openDialog(a: Actor) { this.dialogNpc = a; this.dialogNode = dialogFor(this.g, a.npc!); sfx.click(); this.open('dialog'); }
  openCraft() { this.open('craft'); }
  showDeath(reason: string) { this.endInfo = { title: 'YOU DIED', sub: reason, color: '#d04040' }; this.time.delayedCall(1200, () => this.open('end')); }
  showVictory() { this.endInfo = { title: 'HOLLOWMERE IS SAVED', sub: 'The Hollow Heart is destroyed and dawn returns to the valley.', color: '#60ffe0', win: true }; this.time.delayedCall(600, () => this.open('end')); }
  endInfo: { title: string; sub: string; color: string; win?: boolean } | null = null;

  fadeSleep(mid: () => void, done: () => void) {
    this.close();
    const t = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Zzz...', { fontFamily: FONT, fontSize: '36px', color: '#c8c8e8' }).setOrigin(0.5).setDepth(96).setAlpha(0);
    this.tweens.add({
      targets: [this.fadeRect, t], alpha: 1, duration: 900,
      onComplete: () => { mid(); this.time.delayedCall(700, () => this.tweens.add({ targets: [this.fadeRect, t], alpha: 0, duration: 900, onComplete: () => { t.destroy(); done(); } })); },
    });
  }

  // ---------- frame ----------
  update() {
    if (!this.g.P) return;
    this.drawDarkness();
    this.drawRain();
    this.drawHud();
    if (this.panelKind === 'loot' && this.g.world) {
      const i = this.lootIdx, x = (i % W) + 0.5, y = Math.floor(i / W) + 0.5;
      if (Math.hypot(x - this.g.P.x, y - this.g.P.y) > 2.4) this.close();
    }
    if (this.panelKind === 'dialog' && this.dialogNpc && Math.hypot(this.dialogNpc.x - this.g.P.x, this.dialogNpc.y - this.g.P.y) > 3) this.close();
    if (this.dirty) { this.dirty = false; if (this.panelKind && this.panelKind !== 'dialog' && this.panelKind !== 'end') this.rebuild(); }
    // fade old log lines
    const now = this.time.now;
    const shown = this.logs.slice(-this.logTexts.length);
    shown.forEach((l, k) => { const t = this.logTexts[this.logTexts.length - shown.length + k]; t.setAlpha(Math.max(0.15, 1 - Math.max(0, now - l.t - 8000) / 6000)); });
    if (this.panelKind === 'map') this.updateMapDot();
    this.updateMiniDot();
  }

  drawDarkness() {
    const n = this.g.night, rain = this.g.rain;
    const inside = this.g.world.houseAt(this.g.P.x, this.g.P.y) >= 0;
    const alpha = Math.min(0.9, n * 0.84 + rain * 0.18 + (inside ? 0.12 : 0));
    if (alpha < 0.02) { this.dark.setVisible(false); return; }
    this.dark.setVisible(true);
    const h = this.g.hour;
    const dusk = (h > 17 && h < 21) || (h > 4 && h < 7.5);
    const col = dusk && n < 0.7 ? 0x2a1428 : 0x050a1c;
    this.dark.clear();
    this.dark.fill(col, alpha);
    const lights = this.g.getLights();
    lights.slice(0, this.lightPool.length).forEach((l, k) => {
      const img = this.lightPool[k];
      img.setPosition(l.x, l.y).setScale((l.r * 2) / 256, l.r / 256 * 1.3);
      this.dark.erase(img);
    });
    this.dark.render();
  }

  drawRain() {
    const r = this.g.rain;
    const g = this.rainG;
    g.clear();
    if (r < 0.05) return;
    const w = this.scale.width, h = this.scale.height;
    const want = Math.floor(r * 260);
    while (this.drops.length < want) this.drops.push({ x: Math.random() * w, y: Math.random() * h, s: 8 + Math.random() * 8 });
    if (this.drops.length > want) this.drops.length = want;
    g.lineStyle(1, 0xa8c0d8, 0.35 + r * 0.2);
    for (const d of this.drops) {
      d.y += d.s * 1.6; d.x -= d.s * 0.35;
      if (d.y > h) { d.y = -10; d.x = Math.random() * (w + 100); }
      g.lineBetween(d.x, d.y, d.x - 3, d.y + 11);
    }
  }

  drawHud() {
    const P = this.g.P, g = this.hud;
    g.clear();
    const bar = (x: number, y: number, wd: number, frac: number, col: number) => {
      g.fillStyle(0x000000, 0.65).fillRoundedRect(x - 2, y - 2, wd + 4, 18, 4);
      g.fillStyle(col, 0.25).fillRect(x, y, wd, 14);
      g.fillStyle(col, 1).fillRect(x, y, wd * Phaser.Math.Clamp(frac, 0, 1), 14);
      g.fillStyle(0xffffff, 0.12).fillRect(x, y, wd * Phaser.Math.Clamp(frac, 0, 1), 4);
    };
    bar(110, 16, 190, P.hp / P.maxHp, P.bleeding ? 0xd02020 : 0xb83838);
    bar(110, 42, 190, P.stamina / P.maxStamina, 0xd8b030);
    g.fillStyle(0x000000, 0.6).fillRect(20, 92, 280, 5);
    g.fillStyle(0x80c0ff, 1).fillRect(20, 92, 280 * (P.xp / xpForLevel(P.level)), 5);
    this.hpText.setText(`Health ${Math.ceil(P.hp)}`);
    this.stText.setText(`Stamina`);
    this.lvlText.setText(`Level ${P.level}`);
    this.goldText.setText(`${P.gold} gold`);
    const hr = Math.floor(this.g.hour), mn = Math.floor((this.g.minutes % 60) / 10) * 10;
    const tod = this.g.night > 0.6 ? 'Night' : this.g.night > 0 ? (this.g.hour > 12 ? 'Dusk' : 'Dawn') : 'Day';
    this.clock.setText(`Day ${this.g.day}  ·  ${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}  ·  ${tod}${this.g.rain > 0.3 ? '  ·  Rain' : ''}`);
    this.drawMoodles();
    this.drawEquip();
  }

  drawMoodles() {
    const P = this.g.P;
    const m: [string, number][] = [];
    const tier = (v: number, names: string[]) => { if (v >= 90) m.push([names[2], 3]); else if (v >= 70) m.push([names[1], 2]); else if (v >= 50) m.push([names[0], 1]); };
    tier(P.hunger, ['Peckish', 'Hungry', 'Starving']);
    tier(P.thirst, ['Thirsty', 'Parched', 'Dehydrated']);
    tier(P.fatigue, ['Drowsy', 'Tired', 'Exhausted']);
    if (P.bleeding) m.push(['Bleeding', 3]);
    if (P.hp < P.maxHp * 0.25) m.push(['Critical', 3]); else if (P.hp < P.maxHp * 0.5) m.push(['Injured', 2]);
    if (carryWeight(P) > maxCarry(P)) m.push(['Heavy Load', 2]);
    if (P.stamina < 15) m.push(['Winded', 1]);
    if (this.g.rain > 0.4 && this.g.world.houseAt(P.x, P.y) < 0) m.push(['Wet', 1]);
    if (P.hunger < 15 && P.thirst < 15 && P.fatigue < 30 && !P.bleeding) m.push(['Well Fed', 0]);
    const key = m.map(x => x.join()).join('|');
    if (key === this.moodleKey) return;
    this.moodleKey = key;
    this.tweens.killTweensOf(this.moodleC.list);
    this.moodleC.removeAll(true);
    const cols = [0x5a9a4a, 0xc8b040, 0xd87830, 0xc83030];
    m.forEach(([name, sev], i) => {
      const y = i * 34;
      const circ = this.add.circle(-16, y + 14, 14, cols[sev]).setStrokeStyle(2, 0x000000, 0.8);
      const letter = this.add.text(-16, y + 14, name[0], { fontFamily: FONT, fontSize: '18px', color: '#000' }).setOrigin(0.5);
      const label = this.add.text(-36, y + 14, name, { fontFamily: FONT, fontSize: '16px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 0.5);
      this.moodleC.add([circ, letter, label]);
      if (sev >= 3) this.tweens.add({ targets: circ, scale: 1.15, duration: 400, yoyo: true, repeat: -1 });
    });
  }

  drawEquip() {
    const P = this.g.P;
    const key = `${P.weapon}|${P.armor}`;
    if (key === this.equipKey) return;
    this.equipKey = key;
    this.equipC.removeAll(true);
    [[P.weapon, 'Weapon'], [P.armor, 'Armor']].forEach(([id, label], i) => {
      const x = i * 56;
      const box = this.add.rectangle(x, 0, 46, 46, C.slot, 0.85).setOrigin(0).setStrokeStyle(2, C.panelEdge);
      this.equipC.add(box);
      if (id) this.equipC.add(this.add.image(x + 23, 23, `icon_${id}`));
      else this.equipC.add(this.add.text(x + 23, 23, label === 'Weapon' ? 'Fist' : '—', { fontFamily: FONT, fontSize: '14px', color: C.dim }).setOrigin(0.5));
    });
  }

  renderLog() {
    const shown = this.logs.slice(-this.logTexts.length);
    this.logTexts.forEach(t => t.setText(''));
    shown.forEach((l, k) => { const t = this.logTexts[this.logTexts.length - shown.length + k]; t.setText(l.msg).setColor(l.color).setAlpha(1); });
  }

  // ---------- minimap ----------
  mapTexture() {
    const key = 'minimap';
    const world = this.g.world;
    const tex = this.textures.exists(key) ? (this.textures.get(key) as Phaser.Textures.CanvasTexture) : this.textures.createCanvas(key, W, H)!;
    const c = tex.getContext();
    const img = c.createImageData(W, H);
    const gcol: Record<number, number[]> = {
      [T.GRASS]: [86, 112, 56], [T.GRASS2]: [80, 104, 54], [T.GRASS3]: [96, 120, 62], [T.DIRT]: [130, 106, 76], [T.WATER]: [52, 96, 130],
      [T.DEEP]: [30, 62, 96], [T.SAND]: [184, 165, 120], [T.FLOOR]: [140, 100, 64], [T.STONE]: [128, 128, 122], [T.FARM]: [100, 78, 52],
    };
    for (let i = 0; i < W * H; i++) {
      let col = gcol[world.ground[i]] ?? [0, 0, 0];
      const o = world.obj[i];
      if (o === O.TREE || o === O.PINE) col = [40, 66, 36];
      else if (o === O.WALL) col = [200, 184, 152];
      else if (o === O.RUIN || o === O.ALTAR) col = [90, 200, 180];
      else if (o === O.TENT || o === O.CAMPFIRE) col = [200, 80, 50];
      img.data.set([col[0], col[1], col[2], 255], i * 4);
    }
    c.putImageData(img, 0, 0);
    this.g.mapDirty = false;
    tex.refresh();
    return key;
  }

  buildMinimap() {
    const S = 1.15;
    this.mini = this.add.container(0, 0).setDepth(11);
    const bg = this.add.circle(0, 0, 86, 0x000000, 0.55).setStrokeStyle(2, C.panelEdge);
    const sq = this.add.container(0, 0).setScale(1, 0.5);
    const rot = this.add.container(0, 0).setRotation(Math.PI / 4);
    this.miniImg = this.add.image(0, 0, this.mapTexture()).setScale(S);
    this.miniDot = this.add.circle(0, 0, 3, 0xffff60).setStrokeStyle(1, 0x000);
    rot.add([this.miniImg, this.miniDot]);
    sq.add(rot);
    this.mini.add([bg, sq]);
    (this.mini as unknown as { rot: Phaser.GameObjects.Container }).rot = rot;
    this.time.addEvent({ delay: 5000, loop: true, callback: () => { if (this.g.mapDirty) this.mapTexture(); } });
    this.mini.setScale(0.8);
  }
  updateMiniDot() {
    const S = 1.15;
    this.miniDot.setPosition((this.g.P.x - W / 2) * S, (this.g.P.y - H / 2) * S);
  }
  mapDot: Phaser.GameObjects.Arc | null = null;
  mapScale = 1;
  updateMapDot() { if (this.mapDot) this.mapDot.setPosition((this.g.P.x - W / 2) * this.mapScale, (this.g.P.y - H / 2) * this.mapScale); }

  // ---------- panels ----------
  toggle(k: PanelKind) {
    if (this.panelKind === 'end' || this.panelKind === 'dialog' || this.panelKind === 'shop' || this.g.dead || this.g.sleeping) return;
    if (this.panelKind === k) this.close(); else this.open(k);
  }
  open(k: PanelKind) {
    if (this.panelKind === 'end' && k !== 'end') return;
    this.panelKind = k;
    sfx.click();
    this.rebuild();
  }
  close() {
    this.panel?.destroy(); this.panel = null; this.panelKind = null; this.tooltip.setVisible(false);
    this.dialogNpc = null; this.mapDot = null;
    this.prompt.setVisible(!!this.prompt.text);
  }

  rebuild() {
    this.panel?.destroy();
    this.tooltip.setVisible(false);
    this.mapDot = null;
    const k = this.panelKind!;
    this.panel = this.add.container(0, 0).setDepth(50);
    this.prompt.setVisible(false);
    switch (k) {
      case 'inv': this.buildInventory(); break;
      case 'craft': this.buildCraft(); break;
      case 'quests': this.buildQuests(); break;
      case 'map': this.buildMap(); break;
      case 'help': this.buildHelp(); break;
      case 'pause': this.buildPause(); break;
      case 'loot': this.buildLoot(); break;
      case 'shop': this.buildShop(); break;
      case 'dialog': this.buildDialog(); break;
      case 'end': this.buildEnd(); break;
    }
  }

  frame(w: number, h: number, title: string, y?: number) {
    const sw = this.scale.width, sh = this.scale.height;
    const x = Math.round((sw - w) / 2), yy = y ?? Math.round((sh - h) / 2);
    this.panelRect.setTo(x, yy, w, h);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5).fillRoundedRect(x + 6, yy + 8, w, h, 8);
    g.fillStyle(C.panel, 0.96).fillRoundedRect(x, yy, w, h, 8);
    g.lineStyle(2, C.panelEdge, 1).strokeRoundedRect(x, yy, w, h, 8);
    g.lineStyle(1, 0x3a3020, 1).strokeRoundedRect(x + 5, yy + 5, w - 10, h - 10, 6);
    const t = this.add.text(x + w / 2, yy + 12, title, { fontFamily: FONT, fontSize: '24px', color: '#f0d890', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0);
    const close = this.add.text(x + w - 14, yy + 10, '✕', { fontFamily: FONT, fontSize: '20px', color: C.dim }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.close());
    this.panel!.add([g, t, close]);
    return { x, y: yy };
  }

  text(x: number, y: number, s: string, size = 16, color = C.text, wrap?: number) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, wordWrap: wrap ? { width: wrap } : undefined, lineSpacing: 2 });
    this.panel!.add(t);
    return t;
  }

  button(x: number, y: number, w: number, h: number, label: string, onClick: () => void, enabled = true) {
    const r = this.add.rectangle(x, y, w, h, enabled ? 0x3a3020 : 0x221e18).setOrigin(0).setStrokeStyle(1, enabled ? C.panelEdge : 0x3a3428);
    const t = this.add.text(x + w / 2, y + h / 2, label, { fontFamily: FONT, fontSize: '17px', color: enabled ? C.text : '#5a5448' }).setOrigin(0.5);
    if (enabled) {
      r.setInteractive({ useHandCursor: true });
      r.on('pointerover', () => r.setFillStyle(0x5a4a30));
      r.on('pointerout', () => r.setFillStyle(0x3a3020));
      r.on('pointerdown', () => { sfx.click(); onClick(); });
    }
    this.panel!.add([r, t]);
    return r;
  }

  slot(x: number, y: number, s: Stack | null, onClick?: (p: Phaser.Input.Pointer) => void, extra?: string, highlight = false) {
    const r = this.add.rectangle(x, y, 48, 48, highlight ? 0x4a5a2a : C.slot).setOrigin(0).setStrokeStyle(1, highlight ? 0xa8c060 : 0x4a3e2a);
    this.panel!.add(r);
    if (!s) return;
    const icon = s.id === 'gold' ? 'icon_gold' : `icon_${s.id}`;
    this.panel!.add(this.add.image(x + 24, y + 24, icon));
    if (s.qty > 1) this.panel!.add(this.add.text(x + 45, y + 46, String(s.qty), { fontFamily: FONT, fontSize: '15px', color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(1, 1));
    r.setInteractive({ useHandCursor: true });
    r.on('pointerover', (p: Phaser.Input.Pointer) => {
      r.setFillStyle(C.slotHi);
      const d = ITEMS[s.id];
      const name = s.id === 'gold' ? `${s.qty} Gold` : d.name;
      const stats: string[] = [];
      if (d?.dmg) stats.push(`Damage ${d.dmg}  Reach ${d.range}`);
      if (d?.armor) stats.push(`Armor ${d.armor}`);
      if (d?.hunger) stats.push(`Hunger ${d.hunger}`);
      if (d?.thirst) stats.push(`Thirst ${d.thirst}`);
      if (d?.heal) stats.push(`Health ${d.heal > 0 ? '+' : ''}${d.heal}`);
      if (d?.fatigue) stats.push(`Fatigue ${d.fatigue}`);
      this.tooltip.setText([name, d?.desc ?? '', stats.join('  '), d ? `Weight ${d.weight}` : '', extra ?? ''].filter(Boolean).join('\n')).setVisible(true).setPosition(p.x + 16, p.y + 12);
    });
    r.on('pointerout', () => { r.setFillStyle(highlight ? 0x4a5a2a : C.slot); this.tooltip.setVisible(false); });
    if (onClick) r.on('pointerdown', (p: Phaser.Input.Pointer) => { onClick(p); });
  }

  buildInventory() {
    const P = this.g.P;
    const { x, y } = this.frame(760, 470, 'Inventory & Character');
    const cols = 7;
    this.text(x + 24, y + 52, `Carrying ${carryWeight(P).toFixed(1)} / ${maxCarry(P)}`, 16, carryWeight(P) > maxCarry(P) ? '#ff8060' : C.dim);
    for (let i = 0; i < 35; i++) {
      const s = P.inv[i] ?? null;
      const sx = x + 24 + (i % cols) * 54, sy = y + 78 + Math.floor(i / cols) * 54;
      const eq = !!s && (P.weapon === s.id || P.armor === s.id);
      this.slot(sx, sy, s, p => {
        if (!s) return;
        if (p.rightButtonDown() || p.event.shiftKey) this.g.dropItem(s.id); else this.g.useItem(s.id);
        this.refresh();
      }, s ? (eq ? 'Equipped — click to unequip' : this.hintFor(s.id)) + '\nRight-click / Shift-click: drop' : undefined, eq);
    }
    // character sheet
    const cx = x + 430;
    this.text(cx, y + 52, 'Character', 20, '#f0d890');
    const lines = [
      `Level ${P.level}   XP ${P.xp}/${xpForLevel(P.level)}`,
      `Health ${Math.ceil(P.hp)}/${P.maxHp}   Strength ${P.str}`,
      `Hunger ${Math.round(P.hunger)}%   Thirst ${Math.round(P.thirst)}%`,
      `Fatigue ${Math.round(P.fatigue)}%   Gold ${P.gold}`,
      `Weapon: ${P.weapon ? ITEMS[P.weapon].name : 'Fists'}`,
      `Armor: ${P.armor ? ITEMS[P.armor].name : 'None'}`,
    ];
    lines.forEach((l, i) => this.text(cx, y + 82 + i * 22, l, 16));
    this.text(cx, y + 228, 'Skills', 20, '#f0d890');
    SKILLS.forEach((s, i) => {
      const sk = P.skills[s], yy = y + 258 + i * 34;
      this.text(cx, yy, `${SKILL_NAMES[s]}  ${sk.lvl}`, 16);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.6).fillRect(cx + 150, yy + 4, 150, 10);
      g.fillStyle(0x80b0e0, 1).fillRect(cx + 150, yy + 4, 150 * (sk.xp / skillXpFor(sk.lvl)), 10);
      this.panel!.add(g);
    });
    const kills = Object.entries(P.kills).map(([k, v]) => `${k} ${v}`).join(', ') || 'none yet';
    this.text(cx, y + 398, `Kills: ${kills}`, 14, C.dim, 300);
    this.text(x + 24, y + 440, 'Click: use / equip     Right-click: drop', 14, C.dim);
  }

  hintFor(id: string) {
    const k = ITEMS[id]?.kind;
    return k === 'weapon' || k === 'armor' ? 'Click to equip' : k === 'food' ? 'Click to eat' : k === 'drink' ? 'Click to drink' : k === 'medical' ? 'Click to use' : '';
  }

  buildLoot() {
    const P = this.g.P;
    const list = this.g.world.containers.get(this.lootIdx) ?? [];
    const name = { [O.CRATE]: 'Crate', [O.CUPBOARD]: 'Cupboard', [O.BARREL]: 'Barrel', [O.CHEST]: 'Chest' }[this.g.world.obj[this.lootIdx] as number] ?? 'Container';
    const { x, y } = this.frame(720, 400, name);
    this.text(x + 24, y + 50, 'Contents (click to take)', 16, C.dim);
    for (let i = 0; i < 20; i++) this.slot(x + 24 + (i % 5) * 54, y + 76 + Math.floor(i / 5) * 54, list[i] ?? null, () => { this.g.takeFromContainer(this.lootIdx, i); this.refresh(); });
    if (!list.length) this.text(x + 24, y + 300, 'Empty.', 16, C.dim);
    this.button(x + 24, y + 300 + 30, 160, 34, 'Take All [R]', () => { this.g.takeFromContainer(this.lootIdx, 0, true); this.refresh(); }, list.length > 0);
    this.text(x + 380, y + 50, 'Your items (click to store)', 16, C.dim);
    for (let i = 0; i < 30; i++) {
      const s = P.inv[i] ?? null;
      this.slot(x + 380 + (i % 6) * 54, y + 76 + Math.floor(i / 6) * 54, s, () => { if (s) { this.g.putToContainer(this.lootIdx, s.id); this.refresh(); } });
    }
  }

  buildShop() {
    const P = this.g.P;
    const { x, y } = this.frame(780, 470, 'Tobin\'s Trading Post');
    this.text(x + 24, y + 48, `Your gold: ${P.gold}`, 18, C.gold);
    this.text(x + 24, y + 76, 'Buy (click)', 16, C.dim);
    SHOP_STOCK.forEach((id, i) => {
      const sx = x + 24 + (i % 4) * 90, sy = y + 100 + Math.floor(i / 4) * 80;
      this.slot(sx, sy, { id, qty: 1 }, () => { this.g.buy(id); this.refresh(); }, `Price: ${ITEMS[id].value} gold`);
      this.text(sx, sy + 50, `${ITEMS[id].value}g`, 15, P.gold >= ITEMS[id].value ? C.gold : '#7a6a40');
    });
    this.text(x + 420, y + 76, 'Sell (click) — half value', 16, C.dim);
    P.inv.slice(0, 30).forEach((s, i) => {
      const sx = x + 420 + (i % 6) * 56, sy = y + 100 + Math.floor(i / 6) * 64;
      const v = ITEMS[s.id].kind === 'quest' ? 0 : Math.max(1, Math.floor(ITEMS[s.id].value / 2));
      this.slot(sx, sy, s, () => { this.g.sell(s.id); this.refresh(); }, v ? `Sells for ${v} gold` : 'Not for sale');
    });
  }

  buildCraft() {
    const P = this.g.P;
    const { x, y } = this.frame(640, 520, 'Crafting');
    const fire = this.g.nearFire();
    this.text(x + 24, y + 48, `Survival skill ${P.skills.survival.lvl}   ·   ${fire ? 'Near a fire' : 'No fire nearby (some recipes need one)'}`, 15, fire ? '#f0b060' : C.dim);
    RECIPES.forEach((r, i) => {
      const yy = y + 78 + i * 42;
      const ok = this.g.canCraft(r);
      const icon = this.add.image(x + 44, yy + 18, r.out === 'campfire' ? 'icon_campfire' : `icon_${r.out}`);
      this.panel!.add(icon);
      const name = r.name ?? ITEMS[r.out].name;
      this.text(x + 70, yy + 2, name, 17, ok ? C.text : C.dim);
      const needs = Object.entries(r.needs).map(([id, q]) => `${q} ${ITEMS[id].name} (${countItem(P, id)})`).join(', ');
      const extra = [r.nearFire ? 'fire' : '', r.skill ? `Survival ${r.skill}` : ''].filter(Boolean).join(', ');
      this.text(x + 70, yy + 20, needs + (extra ? `  ·  needs ${extra}` : ''), 13, ok ? '#b8c8a0' : '#7a6e5a');
      this.button(x + 520, yy + 4, 96, 30, 'Craft', () => { this.g.craft(r); this.refresh(); }, ok);
    });
  }

  buildQuests() {
    const P = this.g.P;
    const { x, y } = this.frame(600, 440, 'Journal');
    let yy = y + 56;
    const qs = Object.values(QUESTS).filter(q => P.quests[q.id].status !== 'none');
    if (!qs.length) this.text(x + 24, yy, 'No quests yet. Talk to the villagers — start with Elder Maren in the hall north-east of the well.', 16, C.dim, 550);
    for (const q of qs) {
      const st = P.quests[q.id];
      const prog = q.kind === 'fetch' ? countItem(P, q.target) : st.progress;
      const done = st.status === 'done';
      this.text(x + 24, yy, `${done ? '✓' : '•'} ${q.title}`, 19, done ? '#7a9a6a' : '#f0d890');
      this.text(x + 44, yy + 24, done ? 'Completed.' : `${q.desc}\n${q.goal}: ${Math.min(prog, q.count)}/${q.count}  —  return to ${NPCS[q.giver as keyof typeof NPCS].name}`, 15, done ? C.dim : C.text, 520);
      yy += done ? 54 : 84;
    }
  }

  buildMap() {
    const sw = this.scale.width, sh = this.scale.height;
    const size = Math.min(sw, sh * 2) * 0.8;
    const { x, y } = this.frame(Math.min(sw - 40, size + 40), Math.min(sh - 40, size / 2 + 90), 'Map of Hollowmere');
    const cx = x + Math.min(sw - 40, size + 40) / 2, cy = y + 50 + Math.min(sh - 130, size / 2) / 2;
    const S = (size / Math.SQRT2) / W * 0.98;
    this.mapScale = S;
    const sq = this.add.container(cx, cy).setScale(1, 0.5);
    const rot = this.add.container(0, 0).setRotation(Math.PI / 4);
    rot.add(this.add.image(0, 0, this.mapTexture()).setScale(S));
    this.mapDot = this.add.circle(0, 0, 5, 0xffff60).setStrokeStyle(2, 0x000);
    rot.add(this.mapDot);
    sq.add(rot);
    this.panel!.add(sq);
    const mark = (wx: number, wy: number, label: string, col: string) => {
      const a = Math.PI / 4, dx = (wx - W / 2) * S, dy = (wy - H / 2) * S;
      const px = cx + dx * Math.cos(a) - dy * Math.sin(a), py = cy + (dx * Math.sin(a) + dy * Math.cos(a)) * 0.5;
      this.panel!.add(this.add.text(px, py - 8, label, { fontFamily: FONT, fontSize: '16px', color: col, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1));
    };
    mark(50, 50, 'Hollowmere Village', '#fff0c0');
    mark(82, 18, 'Redhand Camp', '#ff8080');
    mark(18, 18, 'Hollow Chapel', '#60ffe0');
    mark(20, 80, 'Old Farmstead', '#e8d8a8');
    mark(74, 74, 'Mirror Lake', '#a8d0ff');
    this.updateMapDot();
  }

  buildHelp() {
    const { x, y } = this.frame(640, 500, 'How to Survive');
    this.text(x + 28, y + 52, [
      'WASD / Arrows — move        Shift — sprint (uses stamina)',
      'Left click / Space — attack toward cursor / facing',
      'E — interact: talk, loot, chop, gather, drink, sleep, cook',
      'I / Tab — inventory        C — crafting        J — journal',
      'M — map        Mouse wheel — zoom        Esc — menu',
      '',
      'Survival: watch your moodles (right side). Eat when hungry,',
      'drink at wells or lakes, sleep in a bed when tired.',
      'Bleeding drains health — use a bandage (2 cloth).',
      '',
      'Nights are dark and dangerous: wraiths roam and wolves',
      'grow bold. Lamps and campfires keep the dark at bay.',
      '',
      'Chop trees with an axe for logs. Build campfires (3 logs,',
      '2 stones) to cook meat and brew tonics.',
      '',
      'Level up by fighting and completing quests. Skills improve',
      'as you use them. The game autosaves every minute and on sleep.',
    ].join('\n'), 16, C.text);
  }

  buildPause() {
    const { x, y } = this.frame(340, 330, 'Paused');
    this.button(x + 50, y + 60, 240, 40, 'Resume', () => this.close());
    this.button(x + 50, y + 110, 240, 40, 'Save Game', () => { this.g.save(); this.close(); });
    this.button(x + 50, y + 160, 240, 40, isMuted() ? 'Sound: Off' : 'Sound: On', () => { setMuted(!isMuted()); this.rebuild(); });
    this.button(x + 50, y + 210, 240, 40, 'Help', () => this.open('help'));
    this.button(x + 50, y + 260, 240, 40, 'Save & Quit to Title', () => { this.g.save(true); this.quitToTitle(); });
  }

  quitToTitle() {
    this.close();
    this.scene.stop('game');
    this.scene.start('title');
  }

  buildDialog() {
    const node = this.dialogNode!;
    const sw = this.scale.width, sh = this.scale.height;
    const w = Math.min(760, sw - 40);
    const textH = 120, optsH = node.options.length * 34;
    const h = textH + optsH + 30;
    const { x, y } = this.frame(w, h, this.dialogNpc ? NPCS[this.dialogNpc.npc!].name : '', sh - h - 100);
    this.text(x + 24, y + 48, node.text, 18, C.text, w - 48);
    node.options.forEach((o, i) => {
      const t = this.text(x + 34, y + textH + 20 + i * 34, `${i + 1}. ${o.label}`, 18, '#f0d890');
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#ffffff'));
      t.on('pointerout', () => t.setColor('#f0d890'));
      t.on('pointerdown', () => this.chooseOption(i));
    });
  }

  chooseOption(i: number) {
    const o = this.dialogNode?.options[i];
    if (!o) return;
    sfx.click();
    const next = o.act();
    if (next === 'shop') { this.open('shop'); return; }
    if (!next) { this.close(); return; }
    if (this.panelKind !== 'dialog') return; // e.g. victory screen opened
    this.dialogNode = next;
    this.rebuild();
  }

  buildEnd() {
    const info = this.endInfo!;
    const P = this.g.P;
    const sw = this.scale.width, sh = this.scale.height;
    const shade = this.add.rectangle(0, 0, sw, sh, 0x000000, 0.7).setOrigin(0).setInteractive();
    this.panel!.add(shade);
    this.panelRect.setTo(0, 0, sw, sh);
    const t = this.add.text(sw / 2, sh * 0.3, info.title, { fontFamily: FONT, fontSize: '64px', color: info.color, stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
    const kills = Object.values(P.kills).reduce((a, b) => a + b, 0);
    const s = this.add.text(sw / 2, sh * 0.3 + 70, `${info.sub}\n\nThis is how you lived: ${this.g.day - 1} days, ${Math.floor(this.g.hour)} hours.\nLevel ${P.level} · ${kills} kills · ${P.gold} gold`, { fontFamily: FONT, fontSize: '22px', color: '#e8dcc0', align: 'center' }).setOrigin(0.5, 0);
    this.panel!.add([t, s]);
    const bx = sw / 2 - 120;
    if (info.win) this.button(bx, sh * 0.3 + 230, 240, 44, 'Keep Exploring', () => { this.endInfo = null; this.panelKind = null; this.close(); });
    this.button(bx, sh * 0.3 + (info.win ? 284 : 230), 240, 44, info.win ? 'Title Screen' : 'Try Again', () => { this.endInfo = null; this.panelKind = null; this.quitToTitle(); });
  }
}
