// Shared UI drawing helpers. One gothic panel style used everywhere.

import * as Phaser from 'phaser';
import { FONT } from '../font';

export const C = {
  bg: 0x0b0d13,
  panel: 0x14161f,
  panelDeep: 0x0d0f16,
  edge: 0x8a7a4a,
  edgeDim: 0x3e3a2c,
  text: '#cfc9b8',
  dim: '#8b8676',
  gold: '#d8bb72',
  goldHi: '#f0dba0',
  hp: 0x9c2b2b,
  hpBack: 0x2a1414,
  stam: 0x7a8c4a,
  stamBack: 0x1e2414,
  flask: 0xd8a040,
  rune: 0xe8c070,
  danger: '#d06a5a',
  good: '#8fc08a',
  boss: 0xa02828,
};

export const txt = (
  s: Phaser.Scene, x: number, y: number, str: string, size = 18,
  color = C.text, wrap?: number,
) => s.add.text(x, y, str, {
  fontFamily: FONT, fontSize: `${size}px`, color,
  wordWrap: wrap ? { width: wrap } : undefined,
  lineSpacing: Math.round(size * 0.22),
}).setScrollFactor(0);

/** Panel frame: deep fill, gold hairline, corner ticks. */
export function frame(s: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, solid = true) {
  if (solid) {
    g.fillStyle(C.panelDeep, 0.97).fillRect(x, y, w, h);
    g.fillStyle(C.panel, 0.9).fillRect(x + 2, y + 2, w - 4, h - 4);
  }
  g.lineStyle(1, C.edgeDim, 0.9).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.lineStyle(1, C.edge, 0.55).strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  const t = 10;
  g.lineStyle(2, C.edge, 0.9);
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
    g.beginPath(); g.moveTo(cx + sx * 2, cy + sy * t); g.lineTo(cx + sx * 2, cy + sy * 2); g.lineTo(cx + sx * t, cy + sy * 2); g.strokePath();
  }
  void s;
}

/** A labelled stat/resource bar with a notched back plate. */
export function bar(
  g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number,
  frac: number, fill: number, back: number, ghost = -1,
) {
  g.fillStyle(0x000000, 0.72).fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle(back, 1).fillRect(x, y, w, h);
  if (ghost >= 0 && ghost > frac) { g.fillStyle(0xd0b080, 0.35).fillRect(x, y, w * ghost, h); }
  g.fillStyle(fill, 1).fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  g.fillStyle(0xffffff, 0.12).fillRect(x, y, w * Math.max(0, Math.min(1, frac)), Math.max(1, h * 0.3));
  g.lineStyle(1, C.edgeDim, 0.9).strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
}

export interface Btn { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }

export function button(
  s: Phaser.Scene, x: number, y: number, w: number, h: number, label: string,
  onClick: () => void, enabled = true, size = 18,
): Btn {
  const bg = s.add.rectangle(x, y, w, h, enabled ? 0x1d2029 : 0x15171d)
    .setOrigin(0, 0).setStrokeStyle(1, enabled ? C.edge : C.edgeDim, enabled ? 0.8 : 0.4).setScrollFactor(0);
  const t = txt(s, x + w / 2, y + h / 2, label, size, enabled ? C.text : C.dim).setOrigin(0.5);
  if (enabled) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { bg.setFillStyle(0x2a2e3a); t.setColor(C.goldHi); });
    bg.on('pointerout', () => { bg.setFillStyle(0x1d2029); t.setColor(C.text); });
    bg.on('pointerdown', onClick);
  }
  return { bg, label: t };
}

/** Item slot with a letter glyph stand-in and optional count. */
export function slot(
  s: Phaser.Scene, x: number, y: number, size: number, name: string | null,
  qty: number, onClick?: () => void, highlight = false, sub?: string,
) {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const bg = s.add.rectangle(x, y, size, size, highlight ? 0x2a2a1e : 0x121520)
    .setOrigin(0, 0).setStrokeStyle(1, highlight ? C.edge : C.edgeDim, highlight ? 1 : 0.6).setScrollFactor(0);
  objs.push(bg);
  if (name) {
    const t = txt(s, x + 6, y + 4, name, Math.round(size * 0.3), highlight ? C.goldHi : C.text, size - 12);
    objs.push(t);
    if (qty > 1) objs.push(txt(s, x + size - 6, y + size - 20, `×${qty}`, 16, C.dim).setOrigin(1, 0));
    if (sub) objs.push(txt(s, x + 6, y + size - 20, sub, 15, C.gold));
  }
  if (onClick) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x23263a));
    bg.on('pointerout', () => bg.setFillStyle(highlight ? 0x2a2a1e : 0x121520));
    bg.on('pointerdown', onClick);
  }
  return objs;
}
