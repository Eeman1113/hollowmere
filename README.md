# Hollowmere

An infinite, seed-generated isometric soulslike. Every sprite, tile, building,
animation and sound effect in the game is **produced in code at runtime** — the
repository contains no image or audio files, and the playable build is under a
megabyte.

> *The lamps are going out, one valley-arm at a time.*

---

## What it is

You wake on the stones of Lanternhold with no memory of lying down, and a lamp
burning with your name folded into the wick. While it burns, Hollowmere cannot
keep you — so you get up, and you go and look at why the dark is spreading.

- **Infinite world.** Chunked, deterministic generation from a single seed:
  eight biomes, a road network, and thirteen kinds of hand-authored set-piece
  (cathedrals, ruined keeps, catacombs, aqueducts, hanging roads, forges,
  hamlets) placed on a region grid. Walk in any direction forever; walk back and
  it is exactly as you left it.
- **Souls combat.** Stamina, poise and stagger, directional rolls with real
  i-frames, guard and guard-break, two-handing, lock-on, backstab criticals,
  and enemy attacks with explicit windup / active / recovery windows. Attacks
  that flash before they land cannot be blocked.
- **Four bosses**, each with scripted phase transitions that change the move
  pool, add a mechanic and shift the fight's rhythm.
- **Gear that you can see.** Six armour sets across four slots and twenty
  weapons, each carrying a visual description the sprite baker reads. Equipping
  a halberd and a great helm re-bakes the character and the character is now
  holding a halberd and wearing a great helm.
- **Deep lore, told sideways.** Twenty-eight findable remnants, item
  descriptions that carry most of the story, seven speaking characters, five
  chapters and three endings.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # static export to out/
npm run itch       # dist/hollowmere-itch.zip, ready to upload
npm run playtest   # headless Chrome run: screenshots + console errors
```

## Controls

| | |
|---|---|
| `W` `A` `S` `D` | Move |
| `Shift` (hold) | Sprint |
| `Space` | Roll — invulnerable through the middle, not the end |
| Left click | Light attack (chains) |
| Right click | Heavy attack — breaks poise |
| `Q` (hold) | Guard with your off-hand |
| `Tab` | Lock on / off |
| `F` | Two-hand your weapon |
| `E` | Interact · rest at a lantern |
| `R` | Drink Lantern Oil |
| `1` `2` `3` | Quick-use a carried item |
| `I` `C` `J` `M` | Equipment · Self · Journal · Map |
| `Esc` | Pause |

Lanterns are the grace sites: resting refills your flasks, restores the dead,
and opens level-up, fast travel and the reinforcement bench.

---

## How the art works

This is the part worth reading if you are extending the project.

### Characters are a 3D rig, not a sprite sheet

Hand-drawn or AI-generated walk cycles cannot stay coherent across eight
isometric facings — you get sliding feet, legs that do not move, and characters
that moonwalk because the drawn facing and the travel direction disagree.

So characters are not drawn. They are **posed**.

1. `art/rig.ts` — a skeleton with forward kinematics. A pose is a set of joint
   angles (hip swing, knee bend, shoulder, elbow, torso lean and twist), solved
   into 3D joint positions in the character's own local space.
2. `art/anim.ts` — clips. The walk and run cycles come from real gait
   relationships: the knee bends on the recovery half so the trailing foot lifts
   clear, the pelvis dips twice per cycle at each mid-stance, the arms
   counter-swing. Thirteen clips, including a tucked dodge roll that rotates a
   full turn and a death that falls.
3. The solved skeleton is **rotated to the facing yaw**, then projected. One
   pose definition yields all eight directions, and the facing is derived from
   the movement vector (`yawFor`), so the direction a character faces and the
   direction it travels can never disagree. That is the whole moonwalk fix.
4. `art/paint.ts` — rasterises the skeleton into a pixel buffer with the limbs
   depth-sorted, so the far arm goes behind the torso and the near one in front.
   Armour, helms, capes, weapons and shields are drawn in the same pass from
   the `Look` description.
5. `art/bake.ts` — bakes every clip × direction × frame into **one** canvas
   atlas per appearance, so an actor costs a single texture bind. Changing gear
   re-bakes the player's atlas; enemies bake once per type and mirror three of
   their eight facings.

`art/beast.ts` is the same idea for quadrupeds, with a diagonal-pair gait and
front legs that bend the opposite way to the hind legs.

### Everything else is drawn the same way

`art/raster.ts` is a small software rasteriser (tapered capsules, convex
polygons, ellipses, outline and top-light passes). `art/propdraw.ts` paints all
seventy-odd world objects with it — gothic walls with lancet windows, flying
buttresses, spires, portcullis gates, gargoyles, gibbets, chandeliers — and
`art/tiles.ts` paints the ground. `sfx.ts` synthesises every sound with
WebAudio oscillators and filtered noise.

### Looking at the art without running the game

The rasteriser is deliberately free of Phaser imports so it can run under Node:

```bash
npm run preview:rig   -- /tmp/rig.png walk,attack1 player 4 0,2,4
npm run preview:beast -- /tmp/deer.png walk deer
npm run preview:props -- /tmp/props.png
npm run preview:world -- /tmp/world.png 1337 360
```

Each writes a contact sheet you can open directly. This is the fastest way to
iterate on a pose or a building without a browser in the loop.

## Layout

```
src/game/
  art/        rasteriser, rig, animation clips, painters, bakers, palette
  world/      tile and prop tables, biomes, chunk generator, structures, streaming
  content/    items, enemies, bosses, lore and dialogue, chapter spine
  scenes/     title, game, UI
  ui/         shared panel widgets
  actor.ts    one class for the player, enemies, bosses and NPCs
  combat.ts   damage, cones, roll timings, attack selection
  state.ts    player stats, equipment, derived values, saving
scripts/      preview tools, headless playtest, itch.io packaging
```

## Deploying

- **GitHub Pages** — the workflow in `.github/workflows/deploy.yml` builds with
  `NEXT_PUBLIC_BASE_PATH=/<repo>` and publishes `out/`.
- **itch.io** — `npm run itch` produces `dist/hollowmere-itch.zip` with
  document-relative asset paths (itch serves from an opaque subdirectory, which
  breaks root-relative URLs). Upload it, tick *"This file will be played in the
  browser"*, and set the viewport to 1280×720 with the fullscreen button on.

## Built with

Next.js 16 (static export), Phaser 4, TypeScript. No art assets, no audio
assets, no runtime network requests.
