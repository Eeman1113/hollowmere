# Hollowmere

An infinite, seed-generated isometric soulslike. **Nothing in this repository is
an image file.** Characters are ChatGPT-drawn sprite sheets converted to
indexed pixel data in `.ts` files; the world, buildings, items and every sound
are generated in code at runtime. The playable build is under two megabytes.

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
- **An economy with opinions.** Six merchants holding real stock that depletes
  and restocks, prices that climb as a shelf thins, and traders who each pay a
  premium for a different kind of goods — so *where* you sell a wolf pelt
  matters as much as whether you found one. A notice board posts rotating
  contracts to put runes back into circulation.
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

## The economy

Runes are both currency and experience, so every purchase is a level you did
not take. What you do with them is the game's only real resource decision.

**Merchants hold stock.** Each line has a quantity and a restock rate. Tonics
and knives come back as the days turn; a one-off piece of armour says *last
one* and means it. Prices scale with scarcity — the last bandage on the shelf
costs noticeably more than the first, and selling into a shop pads its shelf
and softens the price next time.

**Traders want different things.** Every trade good carries a category — beast,
relic, occult, metal, herb, common, arms — and every merchant pays a premium
for some and refuses others outright:

| | pays well for | will not take |
|---|---|---|
| Tobin the trader | relic, common, occult | — |
| Ilsa the hunter | **beast**, herb, arms | relic |
| Wren the herbalist | **herb**, occult, beast | arms |
| Roderic, last Lanternsworn | arms, metal, relic | — |
| Hasket the smith | **metal**, arms | herb |
| The Bellkeeper | **occult**, relic | beast, common |

A wolf pelt fetches 57 runes at Ilsa's camp and 29 at the forge. A silver
reliquary is 202 from the Bellkeeper, 105 from Hasket, and Ilsa will not touch
it. Carrying loot to the right counter is worth the walk.

**Trade goods** exist purely to be sold — pelts, hides, drowned coin, grave
wax, hollow teeth, reliquaries, choir handbells. A *Sell all trade goods*
button clears the lot at the current counter's rates.

**The notice board** at Lanternhold posts three contracts at a time, reposted
as the days turn: slay so many of a thing, or deliver so many of a good. They
pay runes and often an item, and they are the main faucet putting currency back
into the world.

---

## How the art works

This is the part worth reading if you are extending the project.

### Characters are drawn sheets, expanded to eight facings

Every character in the game — the player in all six armour sets, eighteen
enemies, seven townsfolk and four bosses, thirty-four sheets in all — is a
sprite sheet generated in ChatGPT and converted to code by
`scripts/sprite2code.mjs`, following `.claude/skills/asset-generation/SKILL.md`.
A sheet is three or four rows of four frames: walking toward the viewer, away,
to the right, and (for anything that fights) an attack row.

`art/codedbake.ts` expands those three views across the eight isometric facings
the game uses and hands the result to the same `Baked` atlas the engine already
drives. Side views are drawn facing right, so the three leftward facings reuse
them mirrored. The facing itself is derived from the movement vector, never
from the animation state, so what a character faces and where it travels cannot
disagree — which is what stops the sliding and the moonwalking that a naive
sheet-swap produces.

`scripts/grab-sheet.sh` wraps the convert-and-register step. Two things in it
are load-bearing: it cuts sheets on the even grid (`--grid`) rather than by blob
detection, because a halberd or scythe reaching out of its frame merges blobs
across cells and silently shifts every frame after it; and it only touches a PNG
downloaded in the last five minutes, parking the source in the scratchpad rather
than deleting it, so a bad conversion can be retried with different flags.

### Two things that are not obvious

**Idle poses are inferred.** A walk sheet contains no neutral frame, so naively
using frame 0 for idle leaves every character standing permanently mid-stride
with one leg forward. `codedbake` measures the horizontal spread of the feet in
the bottom of each frame and takes the narrowest — legs together — as the
standing pose, per row, so every facing gets its own.

**The gait is driven by distance, not time.** A cycle running at a fixed fps
cannot match the ground at every speed, and the mismatch reads as skating.
Actors advance their walk cycle by how far they actually travelled this frame.

### The rig is still there, as the fallback

Anything without a drawn sheet falls back to a procedural skeleton that poses in
3D and projects isometrically — humanoid or quadruped. Nothing uses it now, but
it means a missing or broken sheet degrades instead of crashing, and the item
icons are still drawn by its weapon and armour painters.

It works like this:

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
   atlas per appearance, so an actor costs a single texture bind.

`art/beast.ts` is the same idea for quadrupeds, with a diagonal-pair gait and
front legs that bend the opposite way to the hind legs.

Item icons come from the same painters: a weapon's inventory icon is drawn by
the exact routine that draws it in the character's hand, so the icon is
literally the thing you will be holding. Armour icons are built from the same
`ArmorVis` description the rig reads.

### The world is drawn in code

`art/raster.ts` is a small software rasteriser (tapered capsules, convex
polygons, ellipses, outline and top-light passes). `art/propdraw.ts` paints all
seventy-odd world objects with it — gothic walls with lancet windows, flying
buttresses, spires, portcullis gates, gargoyles, gibbets, chandeliers — and
`art/tiles.ts` paints the ground. `sfx.ts` synthesises every sound with
WebAudio oscillators and filtered noise.

### Looking at the art without running the game

The rasteriser is deliberately free of Phaser imports so it can run under Node:

```bash
# convert a freshly downloaded ChatGPT sheet and register it
./scripts/grab-sheet.sh <name> "front:4,back:4,side:4,attack:4" <height>

npm run preview:rig   -- /tmp/rig.png walk,attack1 player 4 0,2,4
npm run preview:beast -- /tmp/deer.png walk deer
npm run preview:gear  -- /tmp/gear.png idle 2      # every armour set, worn
npm run preview:icons -- /tmp/icons.png            # every item icon, labelled
npm run preview:props -- /tmp/props.png
npm run preview:world -- /tmp/world.png 1337 360
```

Each writes a contact sheet you can open directly. This is the fastest way to
iterate on a pose or a building without a browser in the loop.

## Layout

```
src/game/
  art/        rasteriser, rig, animation clips, painters, bakers, palette
  sprites/    ChatGPT-derived sheets as indexed pixel data (generated)
  world/      tile and prop tables, biomes, chunk generator, structures, streaming
  content/    items, enemies, bosses, shops, contracts, lore, chapter spine
  scenes/     title, game, UI
  ui/         shared panel widgets
  actor.ts    one class for the player, enemies, bosses and NPCs
  combat.ts   damage, cones, roll timings, attack selection
  state.ts    player stats, equipment, derived values, saving
scripts/      preview tools, headless playtest, itch.io packaging
```

## Deploying

- **Play it now:** <https://eeman1113.github.io/hollowmere/>
- **GitHub Pages** — the workflow in `.github/workflows/deploy.yml` builds with
  `NEXT_PUBLIC_BASE_PATH=/<repo>` and publishes `out/` on every push to `main`.
- **itch.io** — `npm run itch` produces `dist/hollowmere-itch.zip` with
  document-relative asset paths (itch serves from an opaque subdirectory, which
  breaks root-relative URLs). Upload it, tick *"This file will be played in the
  browser"*, and set the viewport to 1280×720 with the fullscreen button on.

## Built with

Next.js 16 (static export), Phaser 4, TypeScript. No art assets, no audio
assets, no runtime network requests.
