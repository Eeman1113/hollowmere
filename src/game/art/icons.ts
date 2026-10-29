// Phaser glue for the item icon atlas.
import * as Phaser from 'phaser';
import { ITEMS } from '../content/items';
import { drawIcon, ICON, iconKey } from './icondraw';

/** One atlas holding every item icon, built once at boot. */
export function makeIconAtlas(scene: Phaser.Scene) {
  const ids = Object.keys(ITEMS);
  const cols = 16;
  const rows = Math.ceil(ids.length / cols);
  if (scene.textures.exists('icons')) scene.textures.remove('icons');
  const tex = scene.textures.createCanvas('icons', cols * ICON, rows * ICON);
  if (!tex) return;
  const ctx = tex.getContext();
  ids.forEach((id, i) => {
    const buf = drawIcon(ITEMS[id]);
    const x = (i % cols) * ICON, y = Math.floor(i / cols) * ICON;
    const img = ctx.createImageData(ICON, ICON);
    img.data.set(buf.d);
    ctx.putImageData(img, x, y);
    tex.add(iconKey(id), 0, x, y, ICON, ICON);
  });
  // a rune glyph for currency readouts
  tex.refresh();
}


export { drawIcon, ICON, iconKey };
