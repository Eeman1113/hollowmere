// Bakes a quadruped look into the same atlas format humanoids use, so actors
// do not need to know which rig they are driving.

import * as Phaser from 'phaser';
import { Px } from './raster';
import { BASE_Y, SPR_H, SPR_W, frameName, registerBaked, writeAtlas, type Baked, type ClipInfo } from './bake';
import { dirYaw } from './rig';
import { BEAST_CLIPS, faceBeast, paintBeast, solveBeast, type BeastClipName, type BeastLook } from './beast';
import type { ClipName } from './anim';

const GROUNDED = new Set<BeastClipName>(['idle', 'walk', 'run', 'attack1', 'hurt']);

export interface BeastSpec {
  key: string;
  look: BeastLook;
  clips?: BeastClipName[];
  mirror?: boolean;
  scale?: number;
  box?: number;
}

export function bakeBeast(scene: Phaser.Scene, spec: BeastSpec): Baked {
  const clips = spec.clips ?? (Object.keys(BEAST_CLIPS) as BeastClipName[]);
  const k = spec.box ?? 1;
  const W = Math.ceil(SPR_W * k), H = Math.ceil(SPR_H * k), BY = Math.round(BASE_Y * k);
  const dirs = spec.mirror === false ? 8 : 5;
  const frames: { name: string; buf: Px }[] = [];
  const info: Record<string, ClipInfo> = {};
  for (const cn of clips) {
    const clip = BEAST_CLIPS[cn];
    info[cn] = { n: clip.frames.length, fps: clip.fps, loop: clip.loop };
    for (let d = 0; d < dirs; d++) {
      const yaw = dirYaw(d);
      for (let f = 0; f < clip.frames.length; f++) {
        const sk = faceBeast(solveBeast(clip.frames[f], spec.look.build), yaw);
        const px = new Px(W, H);
        paintBeast(px, sk, spec.look, W / 2, BY, { ground: GROUNDED.has(cn), yaw });
        px.topLight(0.22, 0.24);
        px.outline(spec.look.ink ?? [12, 9, 14], spec.look.ghost ? 0.5 : 1);
        frames.push({ name: frameName(cn, d, f), buf: px });
      }
    }
  }
  const idx = writeAtlas(scene, spec.key, frames, W, H);
  return registerBaked({
    key: spec.key,
    clips: new Set(clips as unknown as ClipName[]),
    info,
    mirror: spec.mirror !== false,
    scale: spec.scale ?? 1,
    frames: idx,
    w: W, h: H, originY: BY / H,
  });
}
