// Chunk streaming. Ground goes into one Blitter (cheap for thousands of tiles)
// and props are individual depth-sorted images so the player can walk behind
// a cathedral buttress correctly.

import * as Phaser from 'phaser';
import { toScreen, depthOf } from '../core';
import { TH } from '../art/iso';
import { TILE_W, tileKey } from '../art/tiles';
import { propAnchor, propTexture } from '../art/props';
import { CHUNK, type Chunk, type WorldGen } from './gen';
import { O, TALL, type T } from './types';
import type { Marker } from './structures';

export interface LiveProp {
  img: Phaser.GameObjects.Image;
  x: number; y: number;
  o: O;
  tall: boolean;
  faded: boolean;
  glow?: Phaser.GameObjects.Image;
}

interface LiveChunk {
  cx: number; cy: number;
  bobs: Phaser.GameObjects.Bob[];
  props: LiveProp[];
  markers: Marker[];
  spawned: boolean;
}

export class Streamer {
  live = new Map<string, LiveChunk>();
  blitter!: Phaser.GameObjects.Blitter;
  /** Every loaded prop, for interaction and fade checks. */
  props = new Map<number, LiveProp>();
  /** Radius in chunks to keep loaded. */
  radius = 2;

  constructor(public scene: Phaser.Scene, public gen: WorldGen, public onChunk: (c: Chunk, markers: Marker[]) => void) {
    // World depths are (x+y)*100 and go negative west/north of the origin,
    // so the ground layer has to sit below any reachable value.
    this.blitter = scene.add.blitter(0, 0, 'tiles').setDepth(-1e9);
  }

  key = (cx: number, cy: number) => `${cx},${cy}`;
  propKeyAt = (x: number, y: number) => (x + 0x40000) * 0x80000 + (y + 0x40000);

  /** Load/unload around a world position. */
  update(px: number, py: number) {
    const ccx = Math.floor(px / CHUNK), ccy = Math.floor(py / CHUNK);
    for (let dy = -this.radius; dy <= this.radius; dy++) for (let dx = -this.radius; dx <= this.radius; dx++) {
      const k = this.key(ccx + dx, ccy + dy);
      if (!this.live.has(k)) this.load(ccx + dx, ccy + dy);
    }
    for (const [k, c] of [...this.live]) {
      if (Math.abs(c.cx - ccx) > this.radius + 1 || Math.abs(c.cy - ccy) > this.radius + 1) this.unload(k);
    }
  }

  private load(cx: number, cy: number) {
    const ch = this.gen.get(cx, cy);
    const lc: LiveChunk = { cx, cy, bobs: [], props: [], markers: ch.markers, spawned: false };
    const ox = cx * CHUNK, oy = cy * CHUNK;
    for (let j = 0; j < CHUNK; j++) for (let i = 0; i < CHUNK; i++) {
      const idx = j * CHUNK + i;
      const wx = ox + i, wy = oy + j;
      const s = toScreen(wx + 0.5, wy + 0.5);
      const t = ch.ground[idx] as T;
      const v = ch.variant[idx];
      const bob = this.blitter.create(Math.round(s.x - TILE_W / 2), Math.round(s.y - TH / 2 - 1), tileKey(t, v));
      lc.bobs.push(bob);
      const o = ch.obj[idx] as O;
      if (o) lc.props.push(this.addProp(wx, wy, o, ch.ov[idx], ch.oh[idx]));
    }
    this.live.set(this.key(cx, cy), lc);
    this.onChunk(ch, ch.markers);
  }

  addProp(wx: number, wy: number, o: O, v: number, h: number): LiveProp {
    const key = propTexture(this.scene, o, v, h);
    const a = propAnchor(o, h);
    const s = toScreen(wx + 0.5, wy + 0.5);
    const img = this.scene.add.image(Math.round(s.x), Math.round(s.y + TH / 2), key)
      .setOrigin(0.5, a.oy)
      .setDepth(depthOf(wx + 0.5, wy + 0.5) + 4);
    const lp: LiveProp = { img, x: wx, y: wy, o, tall: TALL.has(o), faded: false };
    this.props.set(this.propKeyAt(wx, wy), lp);
    return lp;
  }

  removeProp(wx: number, wy: number) {
    const k = this.propKeyAt(wx, wy);
    const lp = this.props.get(k);
    if (!lp) return;
    lp.img.destroy();
    lp.glow?.destroy();
    this.props.delete(k);
    for (const c of this.live.values()) {
      const i = c.props.indexOf(lp);
      if (i >= 0) { c.props.splice(i, 1); break; }
    }
  }

  /** Replace a prop in place (harvesting a bush, opening a chest). */
  swapProp(wx: number, wy: number, o: O, v = 0, h = 1) {
    this.removeProp(wx, wy);
    this.gen.setObj(wx, wy, o, h);
    if (o !== O.NONE) {
      const lp = this.addProp(wx, wy, o, v, h);
      const k = this.key(Math.floor(wx / CHUNK), Math.floor(wy / CHUNK));
      this.live.get(k)?.props.push(lp);
    }
  }

  propAt(wx: number, wy: number) { return this.props.get(this.propKeyAt(wx, wy)); }

  private unload(k: string) {
    const c = this.live.get(k);
    if (!c) return;
    for (const b of c.bobs) b.destroy();
    for (const p of c.props) { p.img.destroy(); p.glow?.destroy(); this.props.delete(this.propKeyAt(p.x, p.y)); }
    this.live.delete(k);
  }

  clear() { for (const k of [...this.live.keys()]) this.unload(k); }

  /** Fade tall props the player is standing behind. */
  fadeAround(px: number, py: number) {
    for (const p of this.props.values()) {
      if (!p.tall) continue;
      const behind = p.y <= py && p.x <= px && Math.abs(p.x - px) < 2.6 && Math.abs(p.y - py) < 2.6 && (px - p.x) + (py - p.y) < 3.2;
      if (behind !== p.faded) {
        p.faded = behind;
        this.scene.tweens.add({ targets: p.img, alpha: behind ? 0.32 : 1, duration: 160 });
      }
    }
  }

  markersOf(cx: number, cy: number) { return this.live.get(this.key(cx, cy))?.markers ?? []; }
  chunkSpawned(cx: number, cy: number) {
    const c = this.live.get(this.key(cx, cy));
    if (!c || c.spawned) return false;
    c.spawned = true;
    return true;
  }
}
