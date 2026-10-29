// Phaser glue: cache one texture per prop configuration.
import * as Phaser from 'phaser';
import { Px, upload } from './raster';
import { mulberry32 } from '../core';
import { paintProp, boxFor, grime, NO_OUTLINE } from './propdraw';

const propKey = (o: number, v: number, h: number) => `p${o}_${v}_${h}`;
const made = new Set<string>();

/** Build (and cache) the texture for one prop configuration. */
export function propTexture(scene: Phaser.Scene, o: number, v = 0, h = 1) {
  const key = propKey(o, v, h);
  if (made.has(key)) return key;
  const box = boxFor(o, h);
  const px = new Px(box.w, box.h);
  const cx = box.w / 2, by = box.h - 8;
  paintProp(o, { px, cx, by, r: mulberry32(o * 7717 + v * 131 + h * 17), v, h });
  px.topLight(0.1, 0.12, 1);
  if (!NO_OUTLINE.has(o)) px.outline([10, 8, 12], 0.85);
  grime(px, o * 31 + v);
  upload(scene, key, px);
  made.add(key);
  return key;
}
/** Base Y offset so a prop's foot lands on the tile's bottom corner. */
export function propAnchor(o: number, h = 1) {
  const box = boxFor(o, h);
  return { w: box.w, h: box.h, oy: (box.h - 8) / box.h };
}
export function resetProps() { made.clear(); }

/** Exposed for scripts/preview-props.mjs. */

