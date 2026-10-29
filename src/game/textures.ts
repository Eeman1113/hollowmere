import type Phaser from 'phaser';
import { TW, TH, WALL_H, mulberry32 } from './core';
import { ITEMS, T } from './data';

type Ctx = CanvasRenderingContext2D;

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const c = tex.getContext();
  c.imageSmoothingEnabled = false;
  draw(c);
  tex.refresh();
}

const rgb = (n: number, k = 1) => {
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * k)) | 0;
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) * k)) | 0;
  const b = Math.min(255, Math.max(0, (n & 255) * k)) | 0;
  return `rgb(${r},${g},${b})`;
};

function poly(c: Ctx, pts: number[], fill: string, stroke?: string) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
}

/** Isometric box: footprint half-width a (px), height h, bottom vertex at (cx, by). */
function isoBox(c: Ctx, cx: number, by: number, a: number, h: number, col: number, outline = true) {
  const b = a / 2;
  const top = [cx, by - 2 * b - h, cx + a, by - b - h, cx, by - h, cx - a, by - b - h];
  poly(c, [cx - a, by - b - h, cx, by - h, cx, by, cx - a, by - b], rgb(col, 0.72));
  poly(c, [cx, by - h, cx + a, by - b - h, cx + a, by - b, cx, by], rgb(col, 0.88));
  poly(c, top, rgb(col, 1.08));
  if (outline) {
    c.strokeStyle = 'rgba(20,16,12,0.7)';
    c.beginPath();
    c.moveTo(cx - a, by - b - h); c.lineTo(cx, by - 2 * b - h); c.lineTo(cx + a, by - b - h);
    c.lineTo(cx + a, by - b); c.lineTo(cx, by); c.lineTo(cx - a, by - b); c.closePath();
    c.moveTo(cx - a, by - b - h); c.lineTo(cx, by - h); c.lineTo(cx + a, by - b - h);
    c.moveTo(cx, by - h); c.lineTo(cx, by);
    c.stroke();
  }
}

const GROUND_COLORS: Record<number, [number, number]> = {
  [T.GRASS]: [0x5d7a3a, 0x6b8a44], [T.GRASS2]: [0x56723a, 0x4d6833], [T.GRASS3]: [0x66803f, 0x7a8f4a],
  [T.DIRT]: [0x7a6448, 0x6a5640], [T.WATER]: [0x2f5a78, 0x3a6a8a], [T.DEEP]: [0x1f4060, 0x284c6c],
  [T.SAND]: [0xb8a578, 0xa8956a], [T.FLOOR]: [0x7a5a3a, 0x6a4c30], [T.STONE]: [0x7a7a74, 0x6a6a64],
  [T.FARM]: [0x5a4430, 0x4a3828],
};

export function makeGroundAtlas(scene: Phaser.Scene) {
  const variants = 4;
  const kinds = Object.keys(GROUND_COLORS).map(Number);
  const W = TW * variants, H = (TH + 2) * kinds.length;
  canvas(scene, 'ground', W, H, c => {
    kinds.forEach((k, row) => {
      const [base, alt] = GROUND_COLORS[k];
      for (let v = 0; v < variants; v++) {
        const ox = v * TW, oy = row * (TH + 2) + 1;
        const r = mulberry32(k * 100 + v);
        c.save();
        c.beginPath();
        c.moveTo(ox + TW / 2, oy - 0.6); c.lineTo(ox + TW + 0.6, oy + TH / 2);
        c.lineTo(ox + TW / 2, oy + TH + 0.6); c.lineTo(ox - 0.6, oy + TH / 2); c.closePath();
        c.clip();
        c.fillStyle = rgb(base);
        c.fillRect(ox, oy - 1, TW, TH + 2);
        if (k === T.FLOOR) {
          c.strokeStyle = rgb(base, 0.75);
          for (let i = -4; i < 8; i++) { c.beginPath(); c.moveTo(ox + i * 10, oy); c.lineTo(ox + i * 10 + 64, oy + 32); c.stroke(); }
          for (let i = 0; i < 6; i++) { c.fillStyle = rgb(alt, 0.9 + r() * 0.3); c.fillRect(ox + r() * TW, oy + r() * TH, 3, 1); }
        } else if (k === T.STONE) {
          for (let i = 0; i < 14; i++) {
            c.fillStyle = rgb(r() > 0.5 ? base : alt, 0.85 + r() * 0.3);
            const x = ox + r() * TW, y = oy + r() * TH;
            c.fillRect(x, y, 8 + r() * 6, 4 + r() * 2);
            c.fillStyle = 'rgba(30,30,30,0.35)';
            c.fillRect(x, y + 4, 9, 1);
          }
        } else if (k === T.FARM) {
          for (let i = -4; i < 8; i++) {
            c.strokeStyle = rgb(alt, 0.8); c.lineWidth = 3;
            c.beginPath(); c.moveTo(ox + i * 12, oy + 32); c.lineTo(ox + i * 12 + 64, oy); c.stroke();
            c.strokeStyle = 'rgba(110,150,60,0.8)'; c.lineWidth = 1;
            for (let j = 0; j < 4; j++) { const t = r(); c.fillStyle = '#6a9a3a'; c.fillRect(ox + i * 12 + t * 64, oy + 32 - t * 32 - 3, 2, 3); }
          }
          c.lineWidth = 1;
        } else if (k === T.WATER || k === T.DEEP) {
          for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(200,230,255,0.18)'; c.fillRect(ox + r() * TW, oy + r() * TH, 6 + r() * 6, 1); }
        } else {
          const n = k === T.SAND || k === T.DIRT ? 30 : 46;
          for (let i = 0; i < n; i++) {
            c.fillStyle = rgb(r() > 0.5 ? alt : base, 0.8 + r() * 0.4);
            if (k === T.DIRT || k === T.SAND) c.fillRect(ox + r() * TW, oy + r() * TH, 2, 1);
            else c.fillRect(ox + r() * TW, oy + r() * TH, 1, 2 + r() * 2);
          }
          if (k !== T.DIRT && k !== T.SAND && r() > 0.5) {
            for (let i = 0; i < 3; i++) { c.fillStyle = ['#d8d070', '#c87878', '#e8e8e0'][i]; c.fillRect(ox + 10 + r() * 44, oy + 6 + r() * 20, 2, 2); }
          }
        }
        c.restore();
      }
    });
  });
  const tex = scene.textures.get('ground');
  kinds.forEach((k, row) => { for (let v = 0; v < variants; v++) tex.add(`${k}_${v}`, 0, v * TW, row * (TH + 2), TW, TH + 2); });
}

export function makeObjectTextures(scene: Phaser.Scene) {
  // Wall cube (plaster + timber)
  canvas(scene, 'wall', TW, TH + WALL_H, c => {
    isoBox(c, 32, TH + WALL_H, 32, WALL_H, 0xc8b898);
    c.fillStyle = 'rgba(80,55,35,0.9)';
    c.fillRect(0, 16, 3, WALL_H); c.fillRect(30, 32, 4, WALL_H); c.fillRect(61, 16, 3, WALL_H);
    c.strokeStyle = 'rgba(80,55,35,0.9)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 16 + WALL_H / 2); c.lineTo(32, 32 + WALL_H / 2); c.lineTo(64, 16 + WALL_H / 2); c.stroke();
    c.lineWidth = 1;
  });
  canvas(scene, 'ruin', TW, TH + WALL_H, c => {
    isoBox(c, 32, TH + WALL_H, 32, WALL_H - 10, 0x8a8a84);
    const r = mulberry32(7);
    for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(40,40,40,${0.2 + r() * 0.3})`; c.fillRect(r() * 64, 30 + r() * 40, 8, 1); }
    c.fillStyle = 'rgba(60,90,50,0.7)';
    for (let i = 0; i < 12; i++) c.fillRect(r() * 64, 24 + r() * 50, 2, 3);
  });
  canvas(scene, 'fence', TW, 60, c => {
    c.strokeStyle = '#5a4028'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(4, 30); c.lineTo(60, 58 - 30); c.stroke();
    for (const [x, y] of [[6, 44], [32, 46], [58, 44]]) { c.fillStyle = '#6a4a2a'; c.fillRect(x - 2, y - 26, 4, 26); c.fillStyle = '#3a2818'; c.fillRect(x - 2, y - 26, 1, 26); }
    c.strokeStyle = '#7a5838'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(4, 26); c.lineTo(60, 26); c.moveTo(4, 36); c.lineTo(60, 36); c.stroke();
  });
  canvas(scene, 'tree', 88, 120, c => {
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(44, 112, 26, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4a3420'; c.fillRect(40, 70, 9, 44); c.fillStyle = '#3a2618'; c.fillRect(40, 70, 3, 44);
    const r = mulberry32(3);
    const blobs: [number, number, number, string][] = [];
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = r() * 26;
      blobs.push([44 + Math.cos(a) * d, 46 + Math.sin(a) * d * 0.8, 10 + r() * 8, ['#2f4a22', '#3a5a2a', '#466a30', '#527638'][Math.floor(r() * 4)]]);
    }
    blobs.sort((p, q) => p[1] - q[1]);
    for (const [x, y, s, col] of blobs) { c.fillStyle = col; c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill(); }
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(140,170,80,0.35)'; c.fillRect(24 + r() * 40, 20 + r() * 30, 2, 2); }
  });
  canvas(scene, 'pine', 70, 132, c => {
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(35, 125, 20, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3e2a1a'; c.fillRect(32, 100, 7, 27);
    const layers = [[35, 6, 14, 40], [35, 26, 20, 64], [35, 46, 27, 88], [35, 66, 33, 108]];
    layers.forEach(([x, top, hw, bottom], i) => {
      poly(c, [x, top, x + hw, bottom, x - hw, bottom], ['#1f3a2a', '#244232', '#2a4a36', '#2e503a'][i]);
      poly(c, [x, top, x + hw, bottom, x + 2, bottom - 4], 'rgba(0,0,0,0.18)');
    });
  });
  canvas(scene, 'stump', 40, 28, c => {
    c.fillStyle = '#4a3420'; c.fillRect(13, 10, 14, 12);
    c.fillStyle = '#8a6a44'; c.beginPath(); c.ellipse(20, 10, 7, 4, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#5a4028'; c.beginPath(); c.ellipse(20, 10, 4, 2, 0, 0, Math.PI * 2); c.stroke();
  });
  const bush = (key: string, berries: boolean) => canvas(scene, key, 48, 40, c => {
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(24, 34, 18, 6, 0, 0, Math.PI * 2); c.fill();
    const r = mulberry32(berries ? 11 : 12);
    for (let i = 0; i < 14; i++) { c.fillStyle = ['#2f4a22', '#3a5a2a', '#466a30'][i % 3]; c.beginPath(); c.arc(12 + r() * 24, 14 + r() * 16, 6 + r() * 4, 0, Math.PI * 2); c.fill(); }
    if (berries) for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#b02838' : '#d84050'; c.fillRect(12 + r() * 24, 10 + r() * 18, 3, 3); }
  });
  bush('bush', true); bush('bush_empty', false);
  canvas(scene, 'herb', 36, 28, c => {
    const r = mulberry32(21);
    for (let i = 0; i < 9; i++) {
      const x = 8 + r() * 20; c.strokeStyle = '#4a7a3a'; c.beginPath(); c.moveTo(x, 26); c.lineTo(x + r() * 4 - 2, 12 + r() * 6); c.stroke();
      c.fillStyle = i % 2 ? '#9a6ac8' : '#c88ae8'; c.fillRect(x - 1, 10 + r() * 6, 3, 3);
    }
  });
  canvas(scene, 'rock', 48, 34, c => {
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(24, 28, 18, 6, 0, 0, Math.PI * 2); c.fill();
    poly(c, [8, 26, 12, 12, 22, 6, 34, 8, 42, 18, 40, 28, 24, 31], '#7a7a74', '#3a3a36');
    poly(c, [12, 12, 22, 6, 34, 8, 28, 16, 16, 17], '#9a9a92');
    c.fillStyle = 'rgba(80,110,60,0.6)'; c.fillRect(30, 10, 4, 2);
  });
  canvas(scene, 'crate', 48, 48, c => {
    isoBox(c, 24, 44, 18, 20, 0x8a6a3a);
    c.strokeStyle = 'rgba(60,40,20,0.8)';
    c.beginPath(); c.moveTo(6, 15); c.lineTo(24, 44); c.moveTo(24, 24); c.lineTo(42, 35); c.stroke();
  });
  canvas(scene, 'chest', 48, 44, c => {
    isoBox(c, 24, 40, 17, 14, 0x6a4424);
    c.fillStyle = '#c8a040'; c.fillRect(22, 26, 4, 5);
    c.strokeStyle = '#3a2a1a'; c.beginPath(); c.moveTo(7, 22); c.lineTo(24, 31); c.lineTo(41, 22); c.stroke();
  });
  canvas(scene, 'barrel', 36, 48, c => {
    c.fillStyle = '#6a4a2a'; c.fillRect(6, 10, 24, 34);
    c.fillStyle = '#7a5a34'; c.beginPath(); c.ellipse(18, 10, 12, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4a4a4a'; c.fillRect(6, 16, 24, 3); c.fillRect(6, 34, 24, 3);
    c.fillStyle = '#5a3a1a'; c.beginPath(); c.ellipse(18, 44, 12, 4, 0, 0, Math.PI); c.fill();
  });
  canvas(scene, 'cupboard', 48, 76, c => {
    isoBox(c, 24, 72, 18, 50, 0x6a4c30);
    c.strokeStyle = 'rgba(30,20,10,0.8)';
    c.beginPath(); c.moveTo(14, 40); c.lineTo(14, 66); c.moveTo(34, 40); c.lineTo(34, 66); c.stroke();
    c.fillStyle = '#c8a050'; c.fillRect(17, 50, 2, 3); c.fillRect(29, 50, 2, 3);
  });
  canvas(scene, 'bed', 64, 48, c => {
    isoBox(c, 32, 44, 26, 10, 0x6a4c30);
    poly(c, [8, 21, 32, 9, 56, 21, 32, 33], '#8a3a3a');
    poly(c, [8, 21, 20, 15, 30, 20, 18, 26], '#e8e0d0');
  });
  canvas(scene, 'table', 56, 44, c => {
    c.fillStyle = '#4a3420'; c.fillRect(10, 22, 3, 16); c.fillRect(43, 22, 3, 16); c.fillRect(27, 30, 3, 12);
    isoBox(c, 28, 30, 22, 4, 0x8a6a44);
    c.fillStyle = '#d8d0c0'; c.fillRect(24, 14, 6, 3);
  });
  canvas(scene, 'well', 64, 80, c => {
    c.fillStyle = '#5a4028'; c.fillRect(10, 18, 4, 46); c.fillRect(50, 18, 4, 46);
    poly(c, [4, 22, 32, 4, 60, 22, 32, 30], '#6a3a2a', '#2a1a10');
    c.fillStyle = '#7a7a74'; c.beginPath(); c.ellipse(32, 62, 22, 11, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a5a54'; c.fillRect(10, 62, 44, 10);
    c.fillStyle = '#6a6a64'; c.beginPath(); c.ellipse(32, 72, 22, 8, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#1a2a3a'; c.beginPath(); c.ellipse(32, 62, 16, 7, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3a2a1a'; c.beginPath(); c.moveTo(32, 26); c.lineTo(32, 56); c.stroke();
  });
  canvas(scene, 'campfire', 48, 44, c => {
    c.fillStyle = '#5a5a54';
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; c.beginPath(); c.arc(24 + Math.cos(a) * 14, 34 + Math.sin(a) * 6, 3.5, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#4a3020'; c.save(); c.translate(24, 33); c.rotate(0.4); c.fillRect(-12, -2, 24, 4); c.rotate(-0.8); c.fillRect(-12, -2, 24, 4); c.restore();
  });
  canvas(scene, 'flame', 24, 30, c => {
    poly(c, [12, 0, 22, 20, 18, 28, 6, 28, 2, 20], '#e85820');
    poly(c, [12, 8, 18, 22, 14, 28, 9, 28, 6, 22], '#f8b030');
    poly(c, [12, 16, 15, 24, 12, 28, 9, 24], '#fff0a0');
  });
  canvas(scene, 'lamp', 24, 80, c => {
    c.fillStyle = '#2a2a2a'; c.fillRect(10, 14, 4, 64); c.fillRect(6, 74, 12, 4);
    c.fillStyle = '#3a3a3a'; c.fillRect(5, 6, 14, 12);
    c.fillStyle = '#f8d880'; c.fillRect(7, 8, 10, 8);
  });
  canvas(scene, 'tent', 80, 64, c => {
    poly(c, [6, 44, 34, 8, 42, 58], '#6a5a3a', '#2a2010');
    poly(c, [34, 8, 74, 30, 42, 58], '#8a7a4a', '#2a2010');
    poly(c, [34, 8, 30, 58, 42, 58], '#3a2a1a');
  });
  canvas(scene, 'grave', 32, 44, c => {
    c.fillStyle = 'rgba(70,55,40,0.8)'; c.beginPath(); c.ellipse(16, 38, 13, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a7a78'; c.fillRect(9, 12, 14, 26); c.beginPath(); c.arc(16, 12, 7, Math.PI, 0); c.fill();
    c.fillStyle = '#5a5a58'; c.fillRect(15, 14, 2, 10); c.fillRect(12, 17, 8, 2);
  });
  canvas(scene, 'altar', 64, 64, c => {
    isoBox(c, 32, 60, 24, 18, 0x4a4a54);
    c.fillStyle = '#40e0c0'; c.beginPath(); c.arc(32, 22, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(64,224,192,0.3)'; c.beginPath(); c.arc(32, 22, 12, 0, Math.PI * 2); c.fill();
  });

  // Lighting + misc
  canvas(scene, 'light', 256, 256, c => {
    const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  });
  canvas(scene, 'glow', 128, 128, c => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,170,80,0.55)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });
  canvas(scene, 'shadow', 32, 12, c => { c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(16, 6, 15, 5.5, 0, 0, Math.PI * 2); c.fill(); });
  canvas(scene, 'px', 2, 2, c => { c.fillStyle = '#fff'; c.fillRect(0, 0, 2, 2); });
  canvas(scene, 'select', TW, TH, c => {
    c.strokeStyle = 'rgba(255,240,180,0.9)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(32, 1); c.lineTo(63, 16); c.lineTo(32, 31); c.lineTo(1, 16); c.closePath(); c.stroke();
  });
  canvas(scene, 'vignette', 512, 512, c => {
    const g = c.createRadialGradient(256, 256, 120, 256, 256, 362);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
    c.fillStyle = g; c.fillRect(0, 0, 512, 512);
  });
}

// ---------- fallback characters (replaced by ChatGPT-derived coded sprites when present) ----------

interface Look { skin: number; hair: number; shirt: number; pants: number; hood?: number; mask?: number; robe?: boolean; helmet?: boolean }
const LOOKS: Record<string, Look> = {
  player: { skin: 0xe0b090, hair: 0x5a3a1a, shirt: 0x4a6a3a, pants: 0x3a3028, hood: 0x6a4a2a },
  bandit: { skin: 0xd0a080, hair: 0x2a2018, shirt: 0x3a2a20, pants: 0x2a2420, mask: 0xa02020 },
  elder: { skin: 0xd8b8a0, hair: 0xd8d8d8, shirt: 0x6a5a7a, pants: 0x5a4a6a, robe: true },
  captain: { skin: 0xd0a080, hair: 0x4a3a2a, shirt: 0x3a5a8a, pants: 0x5a5a60, helmet: true },
  merchant: { skin: 0xe0b090, hair: 0x2a2a2a, shirt: 0x7a5a3a, pants: 0x3a3028 },
  hunter: { skin: 0xe0b898, hair: 0xa05a2a, shirt: 0x4a6a3a, pants: 0x4a3a28 },
  herbalist: { skin: 0xf0c8a8, hair: 0x6a3a1a, shirt: 0xc8b870, pants: 0xc8b870, robe: true },
  villager: { skin: 0xd8a888, hair: 0x5a4a3a, shirt: 0xb8a888, pants: 0x5a4430 },
};

function drawHuman(c: Ctx, L: Look, view: 'front' | 'back' | 'side', f: number) {
  const step = [0, 2, 0, -2][f];
  c.fillStyle = rgb(L.pants, 0.8);
  if (view === 'side') { c.fillRect(11 + step, 34, 4, 12); c.fillRect(13 - step, 34, 4, 12); }
  else { c.fillRect(9, 34, 4, 12 - Math.max(0, step)); c.fillRect(15, 34, 4, 12 - Math.max(0, -step)); }
  c.fillStyle = '#2a2018'; c.fillRect(view === 'side' ? 11 + step : 9, 45, 5, 3); c.fillRect(view === 'side' ? 13 - step : 15, 45, 5, 3);
  c.fillStyle = rgb(L.shirt);
  if (L.robe) c.fillRect(7, 18, 14, 26); else c.fillRect(7, 18, 14, 17);
  c.fillStyle = rgb(L.shirt, 0.75); c.fillRect(7, 18, 3, L.robe ? 26 : 17);
  if (view === 'side') { c.fillStyle = rgb(L.shirt, 0.85); c.fillRect(12 - step, 20, 4, 12); c.fillStyle = rgb(L.skin); c.fillRect(12 - step, 31, 4, 3); }
  else { c.fillStyle = rgb(L.shirt, 0.85); c.fillRect(4, 19, 3, 12); c.fillRect(21, 19, 3, 12); c.fillStyle = rgb(L.skin); c.fillRect(4, 31, 3, 3); c.fillRect(21, 31, 3, 3); }
  c.fillStyle = rgb(L.skin); c.fillRect(9, 6, 10, 11);
  c.fillStyle = rgb(L.hair);
  if (view === 'back') c.fillRect(8, 4, 12, 12);
  else if (view === 'side') { c.fillRect(8, 4, 11, 4); c.fillRect(8, 4, 4, 10); }
  else c.fillRect(8, 4, 12, 4);
  if (L.hood !== undefined) { c.fillStyle = rgb(L.hood); c.fillRect(7, 3, 14, 5); c.fillRect(7, 3, 3, 14); c.fillRect(18, 3, 3, view === 'back' ? 14 : 6); if (view === 'back') c.fillRect(7, 3, 14, 15); }
  if (L.helmet) { c.fillStyle = '#8a8a90'; c.fillRect(8, 2, 12, 6); c.fillStyle = '#6a6a70'; c.fillRect(8, 7, 12, 1); }
  if (view !== 'back') {
    c.fillStyle = '#1a1410';
    if (view === 'side') c.fillRect(16, 10, 2, 2); else { c.fillRect(11, 10, 2, 2); c.fillRect(15, 10, 2, 2); }
    if (L.mask !== undefined) { c.fillStyle = rgb(L.mask); c.fillRect(view === 'side' ? 12 : 9, 12, view === 'side' ? 7 : 10, 5); }
  }
  c.strokeStyle = 'rgba(15,10,8,0.55)'; c.strokeRect(7.5, 18.5, 13, L.robe ? 25 : 16);
}

function drawBeast(c: Ctx, kind: string, f: number, w: number, h: number) {
  const step = [0, 2, 0, -2][f];
  const col = kind === 'wolf' ? 0x7a7a7a : kind === 'boar' ? 0x5a4030 : 0x9a7048;
  const by = h - 2;
  c.fillStyle = rgb(col, 0.7);
  for (const lx of [8, 14, w - 16, w - 10]) c.fillRect(lx + (lx < w / 2 ? step : -step), by - 10, 3, 10);
  c.fillStyle = rgb(col);
  c.beginPath(); c.ellipse(w / 2 - 2, by - 14, w / 2 - 6, kind === 'boar' ? 8 : 6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = rgb(col, 1.1);
  if (kind === 'deer') { c.fillRect(w - 12, by - 30, 5, 14); c.fillRect(w - 13, by - 32, 9, 6); c.fillStyle = '#4a3020'; c.fillRect(w - 11, by - 38, 1, 6); c.fillRect(w - 7, by - 38, 1, 6); }
  else { c.beginPath(); c.ellipse(w - 9, by - 16, 7, 5, 0, 0, Math.PI * 2); c.fill(); c.fillRect(w - 6, by - 16, 6, 4); }
  if (kind === 'wolf') { c.fillStyle = rgb(col, 0.8); c.fillRect(w - 12, by - 23, 3, 4); c.fillRect(3, by - 18, 6, 3); }
  if (kind === 'boar') { c.fillStyle = '#e8e0c8'; c.fillRect(w - 3, by - 14, 2, 3); }
  c.fillStyle = '#100808'; c.fillRect(w - 8, by - 18, 2, 2);
}

function drawWraith(c: Ctx, f: number) {
  const off = [0, 1, 2, 1][f];
  const g = c.createLinearGradient(0, 0, 0, 50);
  g.addColorStop(0, 'rgba(120,220,210,0.95)'); g.addColorStop(1, 'rgba(60,120,130,0)');
  poly(c, [18, 2 + off, 30, 14 + off, 32, 48, 26, 42, 20, 50, 14, 42, 6, 48, 6, 14 + off], 'rgba(40,60,70,0.9)');
  c.fillStyle = g; c.fillRect(6, 8, 26, 42);
  c.fillStyle = '#0a1418'; c.beginPath(); c.ellipse(18, 14 + off, 6, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#80fff0'; c.fillRect(14, 13 + off, 2, 2); c.fillRect(20, 13 + off, 2, 2);
}

function drawKnight(c: Ctx, view: string, f: number) {
  const s = [0, 3, 0, -3][f];
  c.fillStyle = '#1a1a22'; c.fillRect(16 + s, 48, 8, 24); c.fillRect(28 - s, 48, 8, 24);
  c.fillStyle = '#2a2a36'; c.fillRect(10, 20, 32, 32);
  c.fillStyle = '#3a3a4a'; c.fillRect(6, 18, 10, 10); c.fillRect(36, 18, 10, 10);
  c.fillStyle = '#22222c'; c.fillRect(16, 4, 20, 18);
  if (view !== 'back') { c.fillStyle = '#40ffe0'; c.fillRect(20, 11, 4, 2); c.fillRect(28, 11, 4, 2); }
  c.fillStyle = '#8a9aa0'; c.fillRect(view === 'side' ? 40 : 44, 10, 4, 44); c.fillStyle = '#4a3a2a'; c.fillRect(view === 'side' ? 38 : 42, 52, 8, 4);
  c.fillStyle = 'rgba(64,255,224,0.25)'; c.fillRect(10, 30, 32, 2);
}

export function makeFallbackCharacters(scene: Phaser.Scene) {
  const views = ['front', 'back', 'side'] as const;
  for (const [name, look] of Object.entries(LOOKS)) {
    for (const v of views) for (let f = 0; f < 4; f++) {
      const key = `${name}_${v}_${f}`;
      if (!scene.textures.exists(key)) canvas(scene, key, 28, 48, c => drawHuman(c, look, v, f));
    }
  }
  const beasts: [string, number, number][] = [['wolf', 44, 30], ['boar', 44, 30], ['deer', 44, 42]];
  for (const [k, w, h] of beasts) for (let f = 0; f < 4; f++) {
    const key = `${k}_side_${f}`;
    if (!scene.textures.exists(key)) canvas(scene, key, w, h, c => drawBeast(c, k, f, w, h));
  }
  for (let f = 0; f < 4; f++) {
    if (!scene.textures.exists(`wraith_side_${f}`)) canvas(scene, `wraith_side_${f}`, 38, 52, c => drawWraith(c, f));
    for (const v of views) if (!scene.textures.exists(`knight_${v}_${f}`)) canvas(scene, `knight_${v}_${f}`, 52, 74, c => drawKnight(c, v, f));
  }
}

// ---------- item icons ----------
export function makeItemIcons(scene: Phaser.Scene) {
  const S = 32;
  for (const id of Object.keys(ITEMS)) {
    canvas(scene, `icon_${id}`, S, S, c => drawIcon(c, id));
  }
  canvas(scene, 'icon_campfire', S, S, c => { drawIcon(c, 'wood'); poly(c, [16, 4, 22, 16, 10, 16], '#f08030'); });
  canvas(scene, 'icon_gold', S, S, c => coin(c));
}

function coin(c: Ctx) {
  c.fillStyle = '#a07818'; c.beginPath(); c.arc(16, 17, 9, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e8c048'; c.beginPath(); c.arc(16, 16, 9, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#c89828'; c.fillRect(14, 11, 4, 10);
}

function drawIcon(c: Ctx, id: string) {
  const O = 'rgba(20,14,10,0.9)';
  const circ = (x: number, y: number, r: number, col: string) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const blade = (len: number, col: string, hilt = '#6a4a2a') => {
    c.save(); c.translate(16, 16); c.rotate(-Math.PI / 4);
    c.fillStyle = col; c.fillRect(-2, -len / 2 - 4, 4, len); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(-2, -len / 2 - 4, 1, len);
    c.fillStyle = '#5a5a5a'; c.fillRect(-6, len / 2 - 4, 12, 3); c.fillStyle = hilt; c.fillRect(-1.5, len / 2 - 1, 3, 8);
    c.restore();
  };
  switch (id) {
    case 'berries': for (const [x, y] of [[12, 18], [18, 16], [15, 22], [20, 22], [10, 24]]) circ(x, y, 4, '#b02838'); c.fillStyle = '#4a7a3a'; c.fillRect(14, 8, 6, 4); break;
    case 'apple': circ(16, 18, 9, '#b83030'); circ(13, 15, 3, 'rgba(255,255,255,0.3)'); c.fillStyle = '#4a3020'; c.fillRect(15, 5, 2, 6); c.fillStyle = '#4a8a3a'; c.fillRect(17, 6, 5, 3); break;
    case 'bread': c.fillStyle = '#a06830'; c.beginPath(); c.ellipse(16, 18, 12, 8, -0.3, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#e8b870'; c.beginPath(); c.moveTo(9, 18); c.lineTo(13, 13); c.moveTo(14, 21); c.lineTo(18, 15); c.moveTo(19, 23); c.lineTo(23, 17); c.stroke(); break;
    case 'raw_meat': case 'cooked_meat': c.fillStyle = id === 'raw_meat' ? '#c04850' : '#8a4a28'; c.beginPath(); c.ellipse(14, 17, 10, 8, 0.4, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f0e8d8'; c.fillRect(21, 21, 8, 3); circ(28, 21, 2.5, '#f0e8d8'); break;
    case 'stew': c.fillStyle = '#5a3a20'; c.beginPath(); c.ellipse(16, 20, 12, 7, 0, 0, Math.PI); c.fill(); c.fillStyle = '#a06030'; c.beginPath(); c.ellipse(16, 18, 12, 4, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(12, 6, 2, 6); c.fillRect(18, 4, 2, 7); break;
    case 'water': case 'bottle': case 'tonic': case 'ale': case 'coffee': {
      if (id === 'ale') { c.fillStyle = '#7a5a34'; c.fillRect(8, 8, 14, 18); c.fillStyle = '#e8b040'; c.fillRect(10, 11, 10, 13); c.fillStyle = '#f8f0e0'; c.fillRect(8, 6, 14, 4); c.strokeStyle = '#7a5a34'; c.lineWidth = 2; c.strokeRect(22, 12, 4, 8); c.lineWidth = 1; break; }
      if (id === 'coffee') { c.fillStyle = '#d8d0c0'; c.fillRect(8, 12, 14, 14); c.fillStyle = '#5a3a20'; c.fillRect(9, 13, 12, 3); c.strokeStyle = '#d8d0c0'; c.lineWidth = 2; c.strokeRect(22, 15, 4, 6); c.lineWidth = 1; break; }
      c.fillStyle = 'rgba(200,220,230,0.5)'; c.fillRect(10, 10, 12, 18); c.fillRect(13, 4, 6, 7);
      c.fillStyle = '#6a4a2a'; c.fillRect(13, 2, 6, 3);
      if (id !== 'bottle') { c.fillStyle = id === 'water' ? '#4a8ac8' : '#a040c0'; c.fillRect(11, 15, 10, 12); }
      c.strokeStyle = O; c.strokeRect(10.5, 10.5, 11, 17); break;
    }
    case 'bandage': c.fillStyle = '#e8e0d0'; c.beginPath(); c.ellipse(16, 16, 10, 7, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#c8c0b0'; c.beginPath(); c.ellipse(16, 16, 4, 3, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#c03030'; c.fillRect(22, 10, 3, 8); c.fillRect(20, 12, 7, 3); break;
    case 'cloth': poly(c, [6, 10, 24, 6, 26, 22, 14, 26, 8, 22], '#a89a80', O); c.strokeStyle = '#887a60'; c.beginPath(); c.moveTo(10, 14); c.lineTo(22, 12); c.stroke(); break;
    case 'wood': c.fillStyle = '#6a4a2a'; c.save(); c.translate(16, 16); c.rotate(-0.5); c.fillRect(-12, -5, 24, 10); c.fillStyle = '#b8905a'; c.beginPath(); c.ellipse(12, 0, 3, 5, 0, 0, Math.PI * 2); c.fill(); c.restore(); break;
    case 'stone': poly(c, [7, 22, 10, 12, 18, 8, 25, 12, 26, 22, 16, 26], '#8a8a84', O); break;
    case 'herb': for (let i = 0; i < 5; i++) { c.strokeStyle = '#4a8a3a'; c.beginPath(); c.moveTo(16, 28); c.lineTo(8 + i * 4, 10 + (i % 2) * 4); c.stroke(); circ(8 + i * 4, 9 + (i % 2) * 4, 2.5, '#a070d0'); } break;
    case 'pelt': case 'hide': poly(c, [8, 6, 24, 6, 28, 14, 24, 28, 8, 28, 4, 14], id === 'pelt' ? '#8a8a88' : '#9a6a40', O); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(12, 10, 8, 14); break;
    case 'ecto': circ(16, 16, 9, 'rgba(80,240,210,0.4)'); circ(16, 16, 5, '#80fff0'); break;
    case 'token': circ(16, 16, 10, '#5a1a1a'); c.fillStyle = '#d83030'; c.fillRect(11, 10, 10, 12); c.fillStyle = '#5a1a1a'; c.fillRect(14, 10, 1, 7); c.fillRect(17, 10, 1, 7); break;
    case 'relic': circ(16, 16, 11, 'rgba(64,255,224,0.25)'); poly(c, [16, 26, 6, 14, 10, 7, 16, 11, 22, 7, 26, 14], '#3a3a4a', '#40ffe0'); circ(16, 15, 3, '#40ffe0'); break;
    case 'knife': blade(14, '#c8c8d0'); break;
    case 'sword': blade(22, '#d0d0e0', '#3a2a5a'); break;
    case 'hollowblade': blade(24, '#60f0e0', '#1a1a2a'); break;
    case 'club': c.save(); c.translate(16, 16); c.rotate(-Math.PI / 4); c.fillStyle = '#6a4a2a'; c.fillRect(-2, -4, 4, 18); c.fillStyle = '#7a5a34'; c.fillRect(-4.5, -14, 9, 12); c.restore(); break;
    case 'spear': c.save(); c.translate(16, 16); c.rotate(-Math.PI / 4); c.fillStyle = '#8a6a44'; c.fillRect(-1, -10, 2, 26); poly(c, [0, -16, 3, -9, -3, -9], '#c8c8d0'); c.restore(); break;
    case 'axe': c.save(); c.translate(16, 16); c.rotate(-Math.PI / 4); c.fillStyle = '#7a5a34'; c.fillRect(-1.5, -12, 3, 26); poly(c, [1, -12, 9, -14, 9, -2, 1, -5], '#b8b8c0', O); c.restore(); break;
    case 'leather': case 'furcoat': case 'chain': {
      const col = id === 'leather' ? '#8a5a30' : id === 'furcoat' ? '#9a9a96' : '#9aa0a8';
      poly(c, [10, 5, 22, 5, 28, 10, 25, 14, 23, 12, 23, 27, 9, 27, 9, 12, 7, 14, 4, 10], col, O);
      if (id === 'chain') { c.fillStyle = 'rgba(40,40,50,0.4)'; for (let y = 8; y < 26; y += 3) for (let x = 10; x < 23; x += 3) c.fillRect(x, y, 1, 1); }
      break;
    }
    default: circ(16, 16, 8, '#888');
  }
}
