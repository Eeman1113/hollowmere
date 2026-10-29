import * as Phaser from 'phaser';
import { toScreen } from '../core';
import { FONT } from '../font';
import { bar, button, C, frame, txt } from '../ui/widgets';
import { resolve } from '../art/bake';
import { ARMOR_SETS, ITEMS, UPGRADE_COST, upgradeMul, type ItemDef } from '../content/items';
import { NPCS, REMNANTS, type Remnant } from '../content/lore';
import { CHAPTERS, ENDINGS, currentChapter } from '../content/story';
import { BIOMES } from '../world/types';
import {
  activeSets, addItem, armorTotals, carried, countItem, equip, itemOf, LOAD_NAME, loadTier,
  maxHp, maxLoad, maxStam, removeItem, slotFor, STAT_BLURB, STAT_NAME, STATS, upgradeOf,
  weaponPower, xpForLevel,
} from '../state';
import { armorReduction } from '../combat';
import { sfx } from '../sfx';
import type { GameScene } from './GameScene';
import type { Actor } from '../actor';

type Panel =
  | null | 'inventory' | 'character' | 'lantern' | 'levelup' | 'travel' | 'smith'
  | 'shop' | 'dialog' | 'map' | 'journal' | 'pause' | 'help' | 'death' | 'remnant' | 'ending';

export class UIScene extends Phaser.Scene {
  g!: GameScene;
  hud!: Phaser.GameObjects.Graphics;
  dark!: Phaser.GameObjects.RenderTexture;
  lightMask!: Phaser.GameObjects.Image;
  weather!: Phaser.GameObjects.Graphics;
  vignette!: Phaser.GameObjects.Graphics;
  panelG!: Phaser.GameObjects.Graphics;
  panelObjs: Phaser.GameObjects.GameObject[] = [];
  panel: Panel = null;

  logLines: { s: string; c: string; t: number }[] = [];
  logText!: Phaser.GameObjects.Text;
  prompt!: Phaser.GameObjects.Text;
  objective!: Phaser.GameObjects.Text;
  zoneText!: Phaser.GameObjects.Text;
  hudText: Phaser.GameObjects.Text[] = [];
  bannerBox?: Phaser.GameObjects.Container;
  dirty = true;

  // transient
  hurtAlpha = 0;
  bossName = '';
  bossTitle = '';
  lastZone = '';
  zoneT = 0;

  // panel scratch
  dialogNpc: Actor | null = null;
  dialogNode = 'start';
  invTab: 'weapon' | 'armour' | 'items' = 'weapon';
  shopStock: string[] = [];
  shopMode: 'buy' | 'sell' = 'buy';
  remnant: Remnant | null = null;
  smithTarget: string | null = null;
  endingId: string | null = null;

  constructor() { super('ui'); }
  init(data: { game: GameScene }) { this.g = data.game; }

  create() {
    const { width: w, height: h } = this.scale;
    this.dark = this.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(10).setScrollFactor(0);
    // reusable off-list sprite; positioned and scaled per light, then erased into the layer
    this.lightMask = this.add.image(0, 0, 'lightmask').setOrigin(0.5, 0.5).setVisible(false);
    this.weather = this.add.graphics().setDepth(11);
    this.vignette = this.add.graphics().setDepth(12);
    this.hud = this.add.graphics().setDepth(20);

    this.logText = txt(this, 16, 0, '', 17, C.text, 460).setDepth(21);
    this.prompt = txt(this, w / 2, h - 108, '', 20, C.goldHi).setOrigin(0.5).setDepth(21);
    this.objective = txt(this, w - 18, 54, '', 17, C.dim, 300).setOrigin(1, 0).setDepth(21);
    this.zoneText = txt(this, w / 2, h * 0.3, '', 40, C.goldHi).setOrigin(0.5).setDepth(21).setAlpha(0);

    this.panelG = this.add.graphics().setDepth(40);

    this.scale.on('resize', () => this.layout());
    this.input.keyboard!.on('keydown-I', () => this.toggle('inventory'));
    this.input.keyboard!.on('keydown-C', () => this.toggle('character'));
    this.input.keyboard!.on('keydown-J', () => this.toggle('journal'));
    this.input.keyboard!.on('keydown-M', () => this.toggle('map'));
    this.input.keyboard!.on('keydown-H', () => this.toggle('help'));
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.panel === 'death' || this.panel === 'ending') return;
      if (this.panel) this.closeAll(); else this.open('pause');
    });
    this.layout();
    this.log('Press H for controls.', '#8b8676');
  }

  layout() {
    const { width: w, height: h } = this.scale;
    this.logText.setPosition(16, h - 190);
    this.prompt.setPosition(w / 2, h - 118);
    this.objective.setPosition(w - 18, 54);
    this.zoneText.setPosition(w / 2, h * 0.32);
    this.dirty = true;
    if (this.panel) this.rebuild();
  }

  // ------------------------------------------------------------ public API
  log(s: string, c = C.text) {
    this.logLines.push({ s, c, t: this.time.now });
    if (this.logLines.length > 6) this.logLines.shift();
    this.renderLog();
  }
  refresh() { this.dirty = true; if (this.panel) this.rebuild(); }
  setPrompt(s: string | null) { this.prompt.setText(s ?? '').setVisible(!!s && !this.panel); }
  hurtFlash(k: number) { this.hurtAlpha = Math.min(0.45, 0.12 + k * 0.8); }
  blocksWorld() { return this.panel !== null; }
  pausesGame() { return this.panel === 'pause' || this.panel === 'help' || this.panel === 'death' || this.panel === 'ending' || this.panel === 'remnant'; }
  closeAll() { this.close(); }

  banner(title: string, sub: string) {
    this.bannerBox?.destroy();
    const { width: w, height: h } = this.scale;
    const c = this.add.container(w / 2, h * 0.36).setDepth(38);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.55).fillRect(-280, -40, 560, 80);
    g.lineStyle(1, C.edge, 0.8).lineBetween(-250, -40, 250, -40).lineBetween(-250, 40, 250, 40);
    c.add(g);
    c.add(txt(this, 0, -16, title, 34, C.goldHi).setOrigin(0.5));
    c.add(txt(this, 0, 18, sub, 19, C.dim).setOrigin(0.5));
    c.setAlpha(0);
    this.bannerBox = c;
    this.tweens.add({ targets: c, alpha: 1, duration: 350, yoyo: true, hold: 1700, onComplete: () => c.destroy() });
  }

  showZone(name: string) {
    if (name === this.lastZone) return;
    this.lastZone = name;
    this.zoneText.setText(name).setAlpha(0);
    this.tweens.add({ targets: this.zoneText, alpha: 1, duration: 600, yoyo: true, hold: 1500 });
  }

  showBoss(name: string, title: string) { this.bossName = name; this.bossTitle = title; this.dirty = true; }
  hideBoss() { this.bossName = ''; this.dirty = true; }
  showBossDown(title: string, epitaph: string) { this.banner('VICTORY', title); void epitaph; }
  showDeath() { this.time.delayedCall(1100, () => this.open('death')); }
  showRemnant(r: Remnant) { this.remnant = r; sfx.page(); this.open('remnant'); }
  openDialog(a: Actor) { this.dialogNpc = a; this.dialogNode = this.dialogStart(a); sfx.click(); this.open('dialog'); }
  openPanel(p: Exclude<Panel, null>) { this.open(p); }
  showEnding(id: string) { this.endingId = id; this.open('ending'); }

  dialogStart(a: Actor) {
    const id = a.npc!;
    const f = this.g.P.flags;
    if (id === 'elder') {
      if (f.boss_bride && !f.boss_first) return 'done2';
      if (f.boss_choir) return 'done1';
      if (f.ended) return 'end';
    }
    if (id === 'bellkeeper' && f.boss_first) return 'final';
    return 'start';
  }

  // ------------------------------------------------------------- per frame
  update() {
    const g = this.g;
    if (!g?.P) return;
    this.drawDarkness();
    this.drawWeather();
    this.drawVignette();
    if (this.dirty) { this.drawHud(); this.dirty = false; }
    else this.drawHudBars();
    const biome = BIOMES[g.biome];
    if (biome) this.showZone(biome.name);
    this.objective.setText(this.objectiveText());
    if (this.logLines.length && this.time.now - this.logLines[0].t > 14000) { this.logLines.shift(); this.renderLog(); }
  }

  objectiveText() {
    const ch = currentChapter(this.g.P.flags);
    return `${ch.title}\n${ch.goal}`;
  }

  // ----------------------------------------------------------- atmosphere
  drawDarkness() {
    const g = this.g;
    const d = this.dark;
    const { width: w, height: h } = this.scale;
    if (d.width !== w || d.height !== h) d.setSize(w, h);
    const dk = g.darkness() + g.rain * 0.12;
    d.clear();
    if (dk <= 0.03) { d.setVisible(false); return; }
    d.setVisible(true);
    const biome = BIOMES[g.biome];
    const tint = biome ? biome.tint : 0x8090b0;
    // night colour: the biome's own cast, darkened
    const night = ((tint >> 16) & 255) * 0.18 << 16 | ((tint >> 8) & 255) * 0.2 << 8 | (tint & 255) * 0.3;
    d.fill(night, Math.min(0.92, dk), 0, 0, w, h);

    const cam = this.cameras.main;
    const z = cam.zoom;
    const hole = (wx: number, wy: number, tiles: number, alpha: number) => {
      const s = toScreen(wx, wy);
      const sx = (s.x - cam.worldView.x) * z, sy = (s.y - cam.worldView.y) * z;
      if (sx < -300 || sy < -300 || sx > w + 300 || sy > h + 300) return;
      // 128px mask radius -> scale so the pool covers `tiles` tiles across
      this.lightMask.setPosition(sx, sy).setScale((tiles * 64 * z) / 256, (tiles * 40 * z) / 256).setAlpha(alpha);
      d.erase(this.lightMask);
    };
    for (const l of g.lightSources) hole(l.x, l.y, l.r, 1);
    hole(g.P.x, g.P.y, 4.5, 0.82);
  }

  drawWeather() {
    const g = this.g;
    const wg = this.weather;
    wg.clear();
    if (g.rain < 0.03) return;
    const { width: w, height: h } = this.scale;
    const n = Math.floor(g.rain * 170);
    const t = this.time.now * 0.001;
    wg.lineStyle(1, 0x9fb4cc, 0.22 + g.rain * 0.2);
    for (let i = 0; i < n; i++) {
      const sx = ((i * 97.3 + t * 340) % (w + 120)) - 60;
      const sy = ((i * 61.7 + t * 820) % (h + 120)) - 60;
      wg.lineBetween(sx, sy, sx - 5, sy + 16);
    }
  }

  drawVignette() {
    const v = this.vignette;
    v.clear();
    const { width: w, height: h } = this.scale;
    if (this.hurtAlpha > 0) {
      v.fillStyle(0x8c1a1a, this.hurtAlpha).fillRect(0, 0, w, h);
      this.hurtAlpha = Math.max(0, this.hurtAlpha - 0.02);
    }
    const hpFrac = this.g.player ? this.g.player.hp / this.g.player.maxHp : 1;
    if (hpFrac < 0.3) {
      const pulse = 0.1 + Math.sin(this.time.now * 0.005) * 0.05;
      v.fillStyle(0x6c0e0e, (0.3 - hpFrac) * pulse * 4);
      v.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 5; i++) {
      v.fillStyle(0x000000, 0.055);
      v.fillRect(-i * 14, -i * 14, w + i * 28, i * 14 + 14);
      v.fillRect(-i * 14, h - i * 14 - 14, w + i * 28, i * 14 + 14);
      v.fillRect(-i * 14, 0, i * 14 + 14, h);
      v.fillRect(w - i * 14 - 14, 0, i * 14 + 14, h);
    }
  }

  // ------------------------------------------------------------------ HUD
  drawHudBars() {
    const g = this.g, P = g.P, pl = g.player;
    if (!pl) return;
    const h = this.hud;
    h.clear();
    const x = 22, y = 22;
    const w = 300;
    bar(h, x, y, w, 15, pl.hp / pl.maxHp, C.hp, C.hpBack);
    bar(h, x, y + 23, w * 0.84, 10, P.stam / maxStam(P), C.stam, C.stamBack);
    // flasks
    for (let i = 0; i < P.flaskMax; i++) {
      h.fillStyle(i < P.flaskCur ? C.flask : 0x332a1c, 1);
      h.fillRect(x + i * 17, y + 42, 12, 15);
      h.lineStyle(1, C.edgeDim, 0.9).strokeRect(x + i * 17 - 0.5, y + 41.5, 13, 16);
    }
    if (this.bossName) {
      const { width: sw, height: sh } = this.scale;
      const bw = Math.min(760, sw - 160);
      const b = g.boss;
      if (b) {
        h.fillStyle(0x000000, 0.5).fillRect(sw / 2 - bw / 2 - 8, sh - 92, bw + 16, 34);
        bar(h, sw / 2 - bw / 2, sh - 80, bw, 14, b.hp / b.maxHp, C.boss, 0x24100f);
      }
    }
  }

  drawHud() {
    for (const t of this.hudText) t.destroy();
    this.hudText = [];
    const g = this.g, P = g.P;
    const { width: w, height: sh } = this.scale;
    this.drawHudBars();
    const add = (t: Phaser.GameObjects.Text) => { t.setDepth(21); this.hudText.push(t); return t; };

    add(txt(this, 22, 66, `RUNES  ${P.runes}`, 19, C.gold));
    add(txt(this, 22, 88, `LVL ${P.level}   ${LOAD_NAME[loadTier(P)]}  ${carried(P).toFixed(1)}/${maxLoad(P)}`, 16, C.dim));

    const wep = itemOf(P.equip.weapon);
    const off = itemOf(P.equip.offhand);
    const up = wep ? upgradeOf(P, wep.id) : 0;
    add(txt(this, 22, sh - 112, `${wep ? wep.name + (up ? ` +${up}` : '') : 'Bare hands'}${P.twoHand ? '  (two-handed)' : ''}`, 18, C.text));
    add(txt(this, 22, sh - 90, P.twoHand ? '' : off ? off.name : '—', 16, C.dim));

    const quick = g.quickSlots();
    quick.forEach((st, i) => {
      const it = ITEMS[st.id];
      add(txt(this, 300 + i * 150, sh - 92, `[${i + 1}] ${it.name}  ×${st.qty}`, 16, C.dim));
    });

    const hrs = Math.floor(g.minutes / 60), mins = Math.floor(g.minutes % 60);
    add(txt(this, w - 18, 20, `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`, 20, C.dim).setOrigin(1, 0));
    add(txt(this, w - 18, 112, this.compass(), 16, C.dim).setOrigin(1, 0));

    if (this.bossName) {
      add(txt(this, w / 2, sh - 110, this.bossTitle.toUpperCase(), 22, C.goldHi).setOrigin(0.5));
      add(txt(this, w / 2, sh - 86, this.bossName, 16, C.dim).setOrigin(0.5));
    }
  }

  compass() {
    const ch = currentChapter(this.g.P.flags);
    const site = this.g.gen.sites.find(s => s.id === ch.site);
    if (!site) return '';
    const dx = site.x - this.g.P.x, dy = site.y - this.g.P.y;
    const d = Math.round(Math.hypot(dx, dy));
    if (d < 20) return `${site.name} — here`;
    const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    // screen compass: +x is south-east on the iso grid
    const a = Math.atan2(dy - dx, -(dx + dy));
    const i = ((Math.round((a / (Math.PI * 2)) * 8) % 8) + 8) % 8;
    return `${site.name}\n${dirs[i]} · ${d} paces`;
  }

  renderLog() {
    this.logText.setText(this.logLines.map(l => l.s).join('\n'));
    this.logText.setColor(this.logLines.length ? this.logLines[this.logLines.length - 1].c : C.text);
  }

  // --------------------------------------------------------------- panels
  toggle(p: Exclude<Panel, null>) {
    if (this.g.dead) return;
    if (this.panel === p) this.close();
    else this.open(p);
  }
  open(p: Exclude<Panel, null>) {
    // a lingering banner must not sit on top of a full-screen panel
    if (p === 'ending' || p === 'death' || p === 'remnant') { this.bannerBox?.destroy(); this.bannerBox = undefined; }
    this.panel = p;
    sfx.click();
    this.setPrompt(null);
    this.rebuild();
  }
  close() {
    const was = this.panel;
    this.panel = null;
    this.clearPanel();
    if (was === 'lantern' || was === 'levelup' || was === 'travel' || was === 'smith') this.g.leaveLantern?.();
  }
  clearPanel() {
    for (const o of this.panelObjs) o.destroy();
    this.panelObjs = [];
    this.panelG.clear();
  }

  add2<T extends Phaser.GameObjects.GameObject>(o: T): T {
    (o as unknown as { setDepth?: (d: number) => void }).setDepth?.(41);
    this.panelObjs.push(o);
    return o;
  }
  addAll(list: Phaser.GameObjects.GameObject[]) { for (const o of list) this.add2(o); }

  rebuild() {
    this.clearPanel();
    if (!this.panel) return;
    const { width: w, height: h } = this.scale;
    this.panelG.fillStyle(0x05070b, 0.78).fillRect(0, 0, w, h);
    switch (this.panel) {
      case 'inventory': this.buildInventory(); break;
      case 'character': this.buildCharacter(); break;
      case 'lantern': this.buildLantern(); break;
      case 'levelup': this.buildLevelUp(); break;
      case 'travel': this.buildTravel(); break;
      case 'smith': this.buildSmith(); break;
      case 'shop': this.buildShop(); break;
      case 'dialog': this.buildDialog(); break;
      case 'map': this.buildMap(); break;
      case 'journal': this.buildJournal(); break;
      case 'pause': this.buildPause(); break;
      case 'help': this.buildHelp(); break;
      case 'death': this.buildDeath(); break;
      case 'remnant': this.buildRemnant(); break;
      case 'ending': this.buildEnding(); break;
    }
  }

  box(w: number, h: number, title: string, yOff = 0) {
    const { width: sw, height: sh } = this.scale;
    const x = Math.round((sw - w) / 2), y = Math.round((sh - h) / 2) + yOff;
    frame(this, this.panelG, x, y, w, h);
    this.add2(txt(this, x + w / 2, y + 14, title, 26, C.goldHi).setOrigin(0.5, 0));
    this.panelG.lineStyle(1, C.edge, 0.5).lineBetween(x + 22, y + 48, x + w - 22, y + 48);
    const cl = button(this, x + w - 44, y + 10, 32, 28, 'X', () => this.close());
    this.add2(cl.bg); this.add2(cl.label);
    return { x, y, w, h };
  }

  // ------------------------------------------------------------ inventory
  buildInventory() {
    const P = this.g.P;
    const b = this.box(980, 560, 'EQUIPMENT');
    const tabs: ('weapon' | 'armour' | 'items')[] = ['weapon', 'armour', 'items'];
    tabs.forEach((t, i) => {
      const btn = button(this, b.x + 24 + i * 110, b.y + 58, 104, 30, t.toUpperCase(), () => { this.invTab = t; this.rebuild(); }, true, 17);
      if (this.invTab === t) btn.label.setColor(C.goldHi);
      this.add2(btn.bg); this.add2(btn.label);
    });

    // --- character portrait: proof that worn gear is actually on the sprite
    const PW = 170, PH = 250;
    const px0 = b.x + b.w - 580, py0 = b.y + 62;
    this.panelG.fillStyle(0x090b11, 1).fillRect(px0, py0, PW, PH);
    this.panelG.lineStyle(1, C.edgeDim, 0.8).strokeRect(px0 + 0.5, py0 + 0.5, PW - 1, PH - 1);
    const bk = this.g.player?.baked;
    if (bk) {
      const fr = resolve(bk, 'idle', 0, Math.floor(this.time.now / 140) % 6);
      const img = this.add.image(px0 + PW / 2, py0 + PH - 26, bk.key, fr.name)
        .setOrigin(0.5, bk.originY).setScale(3.2).setScrollFactor(0);
      img.setFlipX(fr.flip);
      this.add2(img);
    }
    this.add2(txt(this, px0 + PW / 2, py0 + PH + 6, `Poise ${armorTotals(P).poise + 18}  ·  Def ${armorTotals(P).phys}`, 15, C.dim).setOrigin(0.5, 0));

    // --- worn slots
    const dx = b.x + b.w - 330, dy = b.y + 60;
    this.add2(txt(this, dx, dy, 'WORN', 19, C.gold));
    const slots: [keyof typeof P.equip, string][] = [
      ['helm', 'Head'], ['chest', 'Body'], ['arms', 'Arms'], ['legs', 'Legs'],
      ['weapon', 'Right hand'], ['offhand', 'Left hand'], ['talisman', 'Talisman I'], ['talisman2', 'Talisman II'],
    ];
    slots.forEach(([k, label], i) => {
      const y = dy + 26 + i * 50;
      const it = itemOf(P.equip[k]);
      const up = it ? upgradeOf(P, it.id) : 0;
      this.add2(txt(this, dx, y + 2, label, 14, C.dim));
      const row = this.add2(this.add.rectangle(dx, y + 18, 300, 26, it ? 0x1a1d16 : 0x111320)
        .setOrigin(0, 0).setStrokeStyle(1, it ? C.edge : C.edgeDim, it ? 0.7 : 0.4));
      this.add2(txt(this, dx + 8, y + 21, it ? `${it.name}${up ? ` +${up}` : ''}` : '—', 17, it ? C.text : C.dim, 286));
      if (it) {
        row.setInteractive({ useHandCursor: true });
        row.on('pointerover', () => row.setFillStyle(0x262a1c));
        row.on('pointerout', () => row.setFillStyle(0x1a1d16));
        row.on('pointerdown', () => { P.equip[k] = null; this.g.refreshAppearance(); this.rebuild(); });
      }
    });

    // --- list
    const kinds = this.invTab === 'weapon' ? ['weapon', 'offhand']
      : this.invTab === 'armour' ? ['helm', 'chest', 'arms', 'legs', 'talisman']
      : ['consumable', 'material', 'key'];
    const list = P.inv.filter(s => ITEMS[s.id] && kinds.includes(ITEMS[s.id].kind));
    const lx = b.x + 24, ly = b.y + 98;
    if (!list.length) this.add2(txt(this, lx, ly + 10, 'Nothing here.', 18, C.dim));
    list.slice(0, 9).forEach((s, i) => {
      const it = ITEMS[s.id];
      const y = ly + i * 44;
      const worn = Object.values(P.equip).includes(s.id);
      const bg = this.add2(this.add.rectangle(lx, y, 470, 40, worn ? 0x232618 : 0x14171f)
        .setOrigin(0, 0).setStrokeStyle(1, worn ? C.edge : C.edgeDim, 0.7).setInteractive({ useHandCursor: true }));
      bg.on('pointerdown', () => this.useOrEquip(it));
      bg.on('pointerover', () => { this.showTip(it, lx, y + 44); });
      const up = upgradeOf(P, it.id);
      this.add2(txt(this, lx + 10, y + 8, `${it.name}${up ? ` +${up}` : ''}${s.qty > 1 ? `  ×${s.qty}` : ''}`, 19, worn ? C.goldHi : C.text));
      this.add2(txt(this, lx + 460, y + 10, this.statLine(it), 16, C.dim).setOrigin(1, 0));
    });
    this.add2(txt(this, lx, b.y + b.h - 36, 'Click an item to equip or use. Click a worn slot to remove it.', 16, C.dim));
  }

  statLine(it: ItemDef) {
    if (it.dmg) return `ATK ${Math.round(it.dmg * upgradeMul(upgradeOf(this.g.P, it.id)))}  WT ${it.weight}`;
    if (it.phys !== undefined && it.kind !== 'offhand') return `DEF ${it.phys}  PSE ${it.poise ?? 0}  WT ${it.weight}`;
    if (it.kind === 'offhand') return `BLK ${Math.round((it.block ?? 0) * 100)}%  WT ${it.weight}`;
    if (it.heal) return `HEAL ${it.heal}`;
    if (it.throwDmg) return `THROW ${it.throwDmg}`;
    return '';
  }

  tipObjs: Phaser.GameObjects.GameObject[] = [];
  showTip(it: ItemDef, x: number, y: number) {
    for (const o of this.tipObjs) o.destroy();
    this.tipObjs = [];
    const g = this.add.graphics().setDepth(48);
    const w = 440, h = 108;
    frame(this, g, x, y, w, h);
    this.tipObjs.push(g);
    this.tipObjs.push(txt(this, x + 14, y + 12, it.desc, 17, C.dim, w - 28).setDepth(49));
    this.panelObjs.push(...this.tipObjs);
  }

  useOrEquip(it: ItemDef) {
    const P = this.g.P;
    if (it.kind === 'consumable') {
      if (it.throwDmg) { this.log('Throwables are used from the quick slots — press 1, 2 or 3.', C.dim); return; }
      if (!removeItem(P, it.id, 1)) return;
      if (it.heal) this.g.player.hp = Math.min(this.g.player.maxHp, this.g.player.hp + it.heal);
      if (it.buff) P.buffs[it.id] = { mul: it.buff.mul, until: P.playSecs + it.buff.secs };
      sfx.heal();
      this.log(`Used ${it.name}.`, C.good);
      this.refresh();
      return;
    }
    if (slotFor(it)) { equip(P, it.id); this.g.refreshAppearance(); sfx.click(); this.rebuild(); }
  }

  // ------------------------------------------------------------ character
  buildCharacter() {
    const P = this.g.P;
    const b = this.box(760, 540, 'THE TARNISHED SELF');
    const arm = armorTotals(P);
    const pw = weaponPower(P);
    const left = [
      `Level            ${P.level}`,
      `Runes            ${P.runes}`,
      `Runes to level   ${xpForLevel(P.level)}`,
      '',
      `Health           ${Math.round(this.g.player.hp)} / ${maxHp(P)}`,
      `Stamina          ${Math.round(P.stam)} / ${maxStam(P)}`,
      `Equip load       ${carried(P).toFixed(1)} / ${maxLoad(P)}  (${LOAD_NAME[loadTier(P)]})`,
      '',
      `Attack power     ${pw.dmg}${pw.holy ? ` (+${Math.round(pw.holy)} holy)` : ''}`,
      `Physical defence ${arm.phys}  (${Math.round(armorReduction(arm.phys) * 100)}%)`,
      `Arcane defence   ${arm.arc}`,
      `Fire defence     ${arm.fire}`,
      `Poise            ${arm.poise + 18}`,
      '',
      `Deaths           ${P.deaths}`,
      `Remnants found   ${P.remnants.length} / ${Object.keys(REMNANTS).length}`,
      `Lanterns lit     ${Object.keys(P.lanterns).length}`,
    ].join('\n');
    this.add2(txt(this, b.x + 30, b.y + 64, left, 18, C.text));

    const rx = b.x + 410;
    this.add2(txt(this, rx, b.y + 64, 'ATTRIBUTES', 19, C.gold));
    STATS.forEach((s, i) => {
      const y = b.y + 94 + i * 34;
      this.add2(txt(this, rx, y, STAT_NAME[s], 19, C.text));
      this.add2(txt(this, rx + 180, y, `${P.stats[s]}`, 21, C.goldHi).setOrigin(1, 0));
      this.add2(txt(this, rx, y + 20, STAT_BLURB[s], 14, C.dim));
    });
    const sets = activeSets(P);
    if (sets.length) {
      this.add2(txt(this, rx, b.y + 330, 'SET BONUS', 19, C.gold));
      this.add2(txt(this, rx, b.y + 356, sets.map(s => `${ARMOR_SETS[s].name}: ${ARMOR_SETS[s].bonus || '—'}`).join('\n'), 16, C.text, 300));
    }
    this.add2(txt(this, b.x + 30, b.y + b.h - 36, 'Level up at any lantern.', 16, C.dim));
  }

  // -------------------------------------------------------------- lantern
  buildLantern() {
    const P = this.g.P;
    const here = P.lastLantern ? P.lanterns[`${Math.floor(P.lastLantern.x)},${Math.floor(P.lastLantern.y)}`] : '';
    const b = this.box(560, 500, 'LANTERN');
    this.add2(txt(this, b.x + b.w / 2, b.y + 56, here || 'A lamp, burning', 20, C.gold).setOrigin(0.5));
    this.add2(txt(this, b.x + b.w / 2, b.y + 84, 'Your flasks are full. The dead have returned.', 16, C.dim).setOrigin(0.5));
    const atHub = !!P.lastLantern && Math.hypot(P.lastLantern.x, P.lastLantern.y) < 30;
    const items: [string, () => void, boolean][] = [];
    if (atHub && P.flags.boss_first && !P.flags.ended) {
      this.add2(txt(this, b.x + b.w / 2, b.y + 106, 'The First Lamp waits on you.', 17, C.danger).setOrigin(0.5));
      items.push(['Take up the Hollow Crown', () => this.finish('crown'), true]);
      items.push(['Put out the First Lamp', () => this.finish('dark'), true]);
      items.push(['Take the south road', () => this.finish('abandon'), true]);
    }
    items.push(
      ['Level Up', () => this.open('levelup'), true],
      ['Travel to another lantern', () => this.open('travel'), Object.keys(P.lanterns).length > 1],
      ['Reinforce weapon', () => this.open('smith'), countItem(P, 'emberglass') > 0],
      ['Equipment', () => this.open('inventory'), true],
      ['Journal', () => this.open('journal'), true],
      ['Leave', () => this.close(), true],
    );
    const top = b.y + (items.length > 6 ? 126 : 120);
    items.forEach(([label, fn, en], i) => {
      const btn = button(this, b.x + 70, top + i * 44, b.w - 140, 36, label, fn, en);
      this.add2(btn.bg); this.add2(btn.label);
    });
  }

  /** End the game on one of the three closing choices. */
  finish(id: 'crown' | 'dark' | 'abandon') {
    const P = this.g.P;
    P.flags.ended = true;
    P.ending = id;
    if (id === 'crown') for (const pc of ['crown_helm', 'crown_plate', 'crown_arms', 'crown_legs']) addItem(P, pc, 1);
    this.g.save();
    sfx.bell();
    this.showEnding(id);
  }

  buildLevelUp() {
    const P = this.g.P;
    const b = this.box(640, 520, 'LEVEL UP');
    const cost = xpForLevel(P.level);
    this.add2(txt(this, b.x + 30, b.y + 60, `Runes  ${P.runes}`, 20, C.gold));
    this.add2(txt(this, b.x + 30, b.y + 84, `Next level costs ${cost}`, 17, P.runes >= cost ? C.text : C.danger));
    STATS.forEach((s, i) => {
      const y = b.y + 120 + i * 50;
      this.add2(txt(this, b.x + 30, y + 6, `${STAT_NAME[s]}`, 20, C.text));
      this.add2(txt(this, b.x + 230, y + 4, `${P.stats[s]}`, 22, C.goldHi).setOrigin(1, 0));
      const can = P.runes >= cost;
      const btn = button(this, b.x + 260, y, 40, 32, '+', () => {
        if (P.runes < xpForLevel(P.level)) return;
        P.runes -= xpForLevel(P.level);
        P.stats[s]++;
        P.level++;
        this.g.player.maxHp = maxHp(P);
        this.g.player.hp = maxHp(P);
        P.stam = maxStam(P);
        sfx.level();
        this.rebuild();
      }, can);
      this.add2(btn.bg); this.add2(btn.label);
      this.add2(txt(this, b.x + 320, y + 8, STAT_BLURB[s], 15, C.dim, 280));
    });
    const back = button(this, b.x + b.w / 2 - 70, b.y + b.h - 54, 140, 34, 'Back', () => this.open('lantern'));
    this.add2(back.bg); this.add2(back.label);
  }

  buildTravel() {
    const P = this.g.P;
    const b = this.box(620, 520, 'TRAVEL');
    const list = Object.entries(P.lanterns);
    list.slice(0, 9).forEach(([k, name], i) => {
      const [x, y] = k.split(',').map(Number);
      const btn = button(this, b.x + 40, b.y + 70 + i * 44, b.w - 80, 36, `${name}`, () => {
        this.g.player.x = x + 0.5; this.g.player.y = y + 0.5;
        this.g.P.x = x + 0.5; this.g.P.y = y + 0.5;
        this.g.P.lastLantern = { x: x + 0.5, y: y + 0.5 };
        this.g.resetWorld();
        this.close();
        this.log(`Travelled to ${name}.`, C.gold);
      });
      this.add2(btn.bg); this.add2(btn.label);
    });
    const back = button(this, b.x + b.w / 2 - 70, b.y + b.h - 54, 140, 34, 'Back', () => this.open('lantern'));
    this.add2(back.bg); this.add2(back.label);
  }

  buildSmith() {
    const P = this.g.P;
    const b = this.box(680, 520, 'REINFORCE');
    const glass = countItem(P, 'emberglass');
    this.add2(txt(this, b.x + 30, b.y + 60, `Emberglass  ${glass}`, 20, C.gold));
    const weapons = P.inv.filter(s => ITEMS[s.id]?.kind === 'weapon');
    if (!weapons.length) this.add2(txt(this, b.x + 30, b.y + 100, 'You carry no weapon to reinforce.', 18, C.dim));
    weapons.slice(0, 8).forEach((s, i) => {
      const it = ITEMS[s.id];
      const lvl = upgradeOf(P, it.id);
      const max = it.upgradeMax ?? 10;
      const cost = UPGRADE_COST(lvl);
      const y = b.y + 96 + i * 46;
      this.add2(txt(this, b.x + 30, y + 6, `${it.name} +${lvl}`, 19, C.text));
      this.add2(txt(this, b.x + 330, y + 8, `ATK ${Math.round((it.dmg ?? 0) * upgradeMul(lvl))}`, 17, C.dim));
      const can = lvl < max && glass >= cost;
      const btn = button(this, b.x + 460, y, 170, 34, lvl >= max ? 'MAX' : `+1  (${cost} glass)`, () => {
        if (!removeItem(P, 'emberglass', cost)) return;
        P.upgrades[it.id] = lvl + 1;
        sfx.level();
        this.log(`${it.name} reinforced to +${lvl + 1}.`, C.gold);
        this.g.refreshAppearance();
        this.rebuild();
      }, can, 17);
      this.add2(btn.bg); this.add2(btn.label);
    });
    const back = button(this, b.x + b.w / 2 - 70, b.y + b.h - 54, 140, 34, 'Back', () => this.close());
    this.add2(back.bg); this.add2(back.label);
  }

  // ----------------------------------------------------------------- shop
  buildShop() {
    const P = this.g.P;
    const b = this.box(820, 540, this.shopMode === 'buy' ? 'WARES' : 'SELL');
    this.add2(txt(this, b.x + 30, b.y + 58, `Runes  ${P.runes}`, 20, C.gold));
    const modes: ('buy' | 'sell')[] = ['buy', 'sell'];
    modes.forEach((m, i) => {
      const btn = button(this, b.x + b.w - 230 + i * 100, b.y + 54, 92, 30, m.toUpperCase(), () => { this.shopMode = m; this.rebuild(); }, true, 17);
      if (this.shopMode === m) btn.label.setColor(C.goldHi);
      this.add2(btn.bg); this.add2(btn.label);
    });
    const rows = this.shopMode === 'buy'
      ? this.shopStock.map(id => ({ id, qty: 1 }))
      : P.inv.filter(s => ITEMS[s.id] && ITEMS[s.id].value > 0 && ITEMS[s.id].kind !== 'key' && !Object.values(P.equip).includes(s.id));
    if (!rows.length) this.add2(txt(this, b.x + 30, b.y + 110, 'Nothing to trade.', 18, C.dim));
    rows.slice(0, 9).forEach((s, i) => {
      const it = ITEMS[s.id];
      const y = b.y + 100 + i * 44;
      const price = this.shopMode === 'buy' ? it.value : Math.max(1, Math.round(it.value * 0.4));
      const can = this.shopMode === 'buy' ? P.runes >= price : true;
      this.add2(txt(this, b.x + 30, y + 8, `${it.name}${s.qty > 1 ? `  ×${s.qty}` : ''}`, 19, C.text));
      this.add2(txt(this, b.x + 420, y + 10, this.statLine(it), 16, C.dim));
      const btn = button(this, b.x + b.w - 190, y, 160, 34, `${this.shopMode === 'buy' ? 'Buy' : 'Sell'}  ${price}`, () => {
        if (this.shopMode === 'buy') {
          if (P.runes < price) return;
          P.runes -= price; addItem(P, it.id, 1);
          this.log(`Bought ${it.name}.`, C.good);
        } else {
          if (!removeItem(P, it.id, 1)) return;
          P.runes += price;
          this.log(`Sold ${it.name}.`, C.gold);
        }
        sfx.pickup();
        this.rebuild();
      }, can, 17);
      this.add2(btn.bg); this.add2(btn.label);
    });
  }

  // --------------------------------------------------------------- dialog
  buildDialog() {
    const a = this.dialogNpc;
    if (!a?.npc) return this.close();
    const def = NPCS[a.npc];
    const node = def.nodes[this.dialogNode] ?? def.nodes.start;
    const b = this.box(860, 440, def.name.toUpperCase(), 120);
    this.add2(txt(this, b.x + 30, b.y + 56, def.title, 17, C.gold));
    this.add2(txt(this, b.x + 30, b.y + 84, node.text, 20, C.text, b.w - 60));
    const opts = node.options ?? [{ label: 'Leave.', act: 'close' }];
    opts.forEach((o, i) => {
      const y = b.y + b.h - 40 - (opts.length - i) * 38;
      const btn = button(this, b.x + 30, y, b.w - 60, 32, `▸  ${o.label}`, () => {
        sfx.click();
        if (o.act === 'close') return this.close();
        if (o.act === 'shop') { this.shopStock = def.shop ?? []; this.shopMode = 'buy'; return this.open('shop'); }
        if (o.act === 'smith') return this.open('smith');
        if (o.act === 'chapter1') { this.g.P.flags.talked_elder = true; this.close(); return; }
        if (o.to) { this.dialogNode = o.to; this.rebuild(); }
      }, true, 18);
      btn.label.setOrigin(0, 0.5).setPosition(b.x + 46, y + 16);
      this.add2(btn.bg); this.add2(btn.label);
    });
    if (a.npc === 'elder') this.g.P.flags.talked_elder = true;
  }

  // ------------------------------------------------------------- remnant
  buildRemnant() {
    const r = this.remnant;
    if (!r) return this.close();
    const b = this.box(700, 460, 'REMNANT');
    this.add2(txt(this, b.x + b.w / 2, b.y + 58, r.title, 22, C.gold).setOrigin(0.5));
    this.add2(txt(this, b.x + 44, b.y + 100, r.text, 20, C.text, b.w - 88));
    const btn = button(this, b.x + b.w / 2 - 80, b.y + b.h - 54, 160, 34, 'Set it down', () => this.close());
    this.add2(btn.bg); this.add2(btn.label);
  }

  // -------------------------------------------------------------- journal
  buildJournal() {
    const P = this.g.P;
    const b = this.box(900, 560, 'JOURNAL');
    this.add2(txt(this, b.x + 30, b.y + 58, 'CHAPTERS', 19, C.gold));
    let y = b.y + 86;
    for (const c of CHAPTERS) {
      const done = !!P.flags[c.done];
      const cur = currentChapter(P.flags).id === c.id;
      this.add2(txt(this, b.x + 30, y, `${done ? '✦' : cur ? '▸' : '·'}  ${c.title}`, 19, done ? C.dim : cur ? C.goldHi : C.text));
      if (cur || done) this.add2(txt(this, b.x + 50, y + 22, c.brief, 15, C.dim, 380));
      y += (cur || done) ? 86 : 30;
    }
    this.add2(txt(this, b.x + 470, b.y + 58, `REMNANTS  ${P.remnants.length}/${Object.keys(REMNANTS).length}`, 19, C.gold));
    let ry = b.y + 86;
    for (const id of P.remnants.slice(-12)) {
      const r = REMNANTS[id];
      if (!r) continue;
      const t = this.add2(txt(this, b.x + 470, ry, `· ${r.title}`, 17, C.text, 400));
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.showRemnant(r));
      ry += 26;
    }
  }

  // ------------------------------------------------------------------ map
  buildMap() {
    const b = this.box(760, 640, 'THE VALLEY');
    const g = this.add.graphics().setDepth(41);
    this.panelObjs.push(g);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2 + 10;
    const span = 420, scale = 0.42;
    g.fillStyle(0x0a0d14, 1).fillRect(cx - span / 2, cy - span / 2, span, span);
    // coarse terrain sample
    const step = 6;
    for (let sy = -span / 2; sy < span / 2; sy += 3) for (let sx = -span / 2; sx < span / 2; sx += 3) {
      const wx = Math.round(this.g.P.x + sx / scale / step * 2), wy = Math.round(this.g.P.y + sy / scale / step * 2);
      const e = this.g.gen.elevation(wx, wy);
      const bi = this.g.gen.biomeAt(wx, wy);
      const col = e < 0.3 ? 0x1b2a3e : BIOMES[bi].tint & 0x5f5f5f;
      g.fillStyle(col, 0.9).fillRect(cx + sx, cy + sy, 3, 3);
    }
    for (const s of this.g.gen.sites) {
      const px = cx + (s.x - this.g.P.x) * scale / step * 2 * 1, py = cy + (s.y - this.g.P.y) * scale / step * 2;
      if (Math.abs(px - cx) > span / 2 || Math.abs(py - cy) > span / 2) continue;
      g.fillStyle(0xd8bb72, 1).fillCircle(px, py, 4);
      this.add2(txt(this, px + 8, py - 8, s.name, 14, C.gold));
    }
    for (const k of Object.keys(this.g.P.lanterns)) {
      const [lx, ly] = k.split(',').map(Number);
      const px = cx + (lx - this.g.P.x) * scale / step * 2, py = cy + (ly - this.g.P.y) * scale / step * 2;
      if (Math.abs(px - cx) > span / 2 || Math.abs(py - cy) > span / 2) continue;
      g.fillStyle(0xffb040, 1).fillCircle(px, py, 3);
    }
    g.fillStyle(0xffffff, 1).fillCircle(cx, cy, 3);
    g.lineStyle(1, C.edge, 0.7).strokeRect(cx - span / 2, cy - span / 2, span, span);
    this.add2(txt(this, b.x + b.w / 2, b.y + b.h - 42, `You are at ${Math.round(this.g.P.x)}, ${Math.round(this.g.P.y)} · ${BIOMES[this.g.biome]?.name ?? ''}`, 17, C.dim).setOrigin(0.5));
  }

  // ----------------------------------------------------------------- misc
  buildPause() {
    const b = this.box(420, 400, 'PAUSED');
    const items: [string, () => void][] = [
      ['Resume', () => this.close()],
      ['Controls', () => this.open('help')],
      ['Journal', () => this.open('journal')],
      ['Save & Quit to Title', () => this.g.quitToTitle()],
    ];
    items.forEach(([l, fn], i) => {
      const btn = button(this, b.x + 60, b.y + 90 + i * 56, b.w - 120, 42, l, fn);
      this.add2(btn.bg); this.add2(btn.label);
    });
  }

  buildHelp() {
    const b = this.box(700, 560, 'CONTROLS');
    const rows = [
      ['W A S D / Arrows', 'Move'],
      ['Shift (hold)', 'Sprint — drains stamina'],
      ['Space', 'Roll — invulnerable through the middle'],
      ['Left click', 'Light attack (chains)'],
      ['Right click', 'Heavy attack — breaks poise'],
      ['Q (hold)', 'Guard with your off-hand'],
      ['Tab', 'Lock on / off'],
      ['F', 'Two-hand your weapon'],
      ['E', 'Interact · rest at a lantern'],
      ['R', 'Drink Lantern Oil'],
      ['1 2 3', 'Quick-use a carried item'],
      ['I / C / J / M', 'Equipment · Self · Journal · Map'],
      ['Esc', 'Pause'],
      ['Mouse wheel', 'Zoom'],
    ];
    rows.forEach(([k, v], i) => {
      this.add2(txt(this, b.x + 40, b.y + 70 + i * 34, k, 19, C.goldHi));
      this.add2(txt(this, b.x + 270, b.y + 70 + i * 34, v, 19, C.text));
    });
    this.add2(txt(this, b.x + 40, b.y + b.h - 54, 'Attacks that flash before they land cannot be blocked. Roll those.', 17, C.dim, b.w - 80));
  }

  buildDeath() {
    const { width: w, height: h } = this.scale;
    this.panelG.fillStyle(0x16060a, 0.86).fillRect(0, 0, w, h);
    this.add2(txt(this, w / 2, h / 2 - 70, 'YOU DIED', 72, '#a82b2b').setOrigin(0.5));
    const P = this.g.P;
    const sub = P.bloodstain ? `${P.bloodstain.runes} runes left behind.` : 'Nothing left to lose.';
    this.add2(txt(this, w / 2, h / 2 + 10, sub, 20, C.dim).setOrigin(0.5));
    const btn = button(this, w / 2 - 120, h / 2 + 60, 240, 44, 'Return to the lantern', () => {
      this.close();
      this.g.respawn();
    });
    this.add2(btn.bg); this.add2(btn.label);
  }

  buildEnding() {
    const e = ENDINGS[(this.endingId ?? 'dark') as keyof typeof ENDINGS];
    const { width: w, height: h } = this.scale;
    this.panelG.fillStyle(0x05070b, 0.96).fillRect(0, 0, w, h);
    this.add2(txt(this, w / 2, h * 0.18, e.title, 48, C.goldHi).setOrigin(0.5));
    this.add2(txt(this, w / 2, h * 0.3, e.text, 21, C.text, Math.min(760, w - 120)).setOrigin(0.5, 0));
    const btn = button(this, w / 2 - 120, h - 110, 240, 44, 'Return to the title', () => this.g.newGamePlus());
    this.add2(btn.bg); this.add2(btn.label);
  }
}

export { FONT };
