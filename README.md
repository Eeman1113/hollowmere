# Hollowmere

An isometric survival RPG in the spirit of Project Zomboid — but with no zombies. A blight called
**the Hollow** has crept into a quiet valley: wolves have gone mad, bandits raid the roads and
wraiths walk at night. Survive, level up, help the villagers and destroy the Hollow Knight.

Built with **Phaser 4** + **Next.js 16** (App Router). The game has **no image or audio files**:
- Characters and creatures are generated with ChatGPT, then converted into palette-indexed
  pixel strings in TypeScript (`src/game/sprites/*.ts`) by `scripts/sprite2code.mjs`.
- The terrain, props, icons and lighting are drawn in code (`src/game/textures.ts`).
- Sound effects come from a small WebAudio synth (`src/game/sfx.ts`).

## Run

```bash
npm install
npm run dev     # http://localhost:3000
```

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move (Shift to sprint) |
| Left click / Space | Attack toward cursor / facing |
| E | Interact — talk, loot, chop, gather, drink, sleep, cook |
| I / Tab | Inventory & character sheet |
| C | Crafting |
| J | Quest journal |
| M | Map |
| Mouse wheel | Zoom |
| Esc | Menu (save, sound, quit) |

## Features

- A 100×100 procedurally generated valley: village, farms, lakes, forests, a bandit camp, a ruined chapel.
- Zomboid-style survival: hunger, thirst, fatigue, bleeding, carry weight, and moodles.
- Day/night cycle with real-time lighting (lanterns, lamps, campfires), plus rain.
- See-through walls and roofs that lift off when you walk inside a house.
- Melee combat with weapon reach and cooldowns, crits, knockback, and pack aggro.
- Creatures: wolves, boars, deer, bandits, night wraiths, and a boss.
- Five quests from five NPCs, a merchant, ten crafting recipes, four skills, and levelling.
- Looting containers, chopping trees, foraging berries and herbs, regrowth over time.
- Autosave to localStorage, plus death and victory screens.

## Tooling

- `scripts/sprite2code.mjs` turns a sprite sheet image into coded pixels (see `.claude/skills/asset-generation/SKILL.md`).
- `scripts/playtest.mjs` plays the game headlessly in Chrome and saves screenshots plus console errors.
