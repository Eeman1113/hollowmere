#!/usr/bin/env bash
# Convert a freshly downloaded ChatGPT sheet into a coded sprite and register it.
# usage: scripts/grab-sheet.sh <name> <layout> <height> [extra sprite2code args...]
#
# Only ever touches a PNG downloaded in the last 5 minutes — otherwise it would
# happily consume and delete whatever else happens to be in ~/Downloads.
set -euo pipefail
name="$1"; layout="$2"; height="$3"; shift 3
SCRATCH="${SCRATCH:-/private/tmp/claude-501/-Users-eemanmajumder-code-shit-hollowmere/b634939b-1763-4b76-9865-14ae4dbc9762/scratchpad}"

src=$(find "$HOME/Downloads" -maxdepth 1 -name '*.png' -mmin -5 -print0 2>/dev/null \
      | xargs -0 ls -t 2>/dev/null | head -1 || true)
if [ -z "$src" ]; then
  echo "no PNG downloaded in the last 5 minutes — the download did not land" >&2
  exit 1
fi
echo "source: $src"

# ChatGPT lays these out on an even grid, and blob detection breaks as soon as a
# long weapon from one frame reaches into the next. Cutting the sheet on the grid
# is reliable where blob grouping is not.
rows=$(awk -F, '{print NF}' <<< "$layout")
cols=$(sed -E 's/.*:([0-9]+).*/\1/' <<< "${layout%%,*}")
node scripts/sprite2code.mjs "$src" --name "$name" --layout "$layout" --h "$height" \
  --colors 32 --grid "${cols}x${rows}" --preview "$SCRATCH/${name}_preview.png" "$@"

idx=src/game/sprites/index.ts
if ! grep -q "import $name from './$name';" "$idx"; then
  python3 - "$name" <<'PY'
import sys
name = sys.argv[1]
p = 'src/game/sprites/index.ts'
s = open(p).read()
s = s.replace("// --- generated sprite imports end ---",
              f"import {name} from './{name}';\n// --- generated sprite imports end ---")
s = s.replace("  // --- generated sprite list end ---",
              f"  {name},\n  // --- generated sprite list end ---")
open(p, 'w').write(s)
PY
  echo "registered $name"
fi
# Move rather than delete: the sheet leaves ~/Downloads as the skill requires,
# but stays retryable if the blob detection needs different flags.
mkdir -p "$SCRATCH/sheets"
mv -f "$src" "$SCRATCH/sheets/${name}.png"
echo "source parked at $SCRATCH/sheets/${name}.png (retry with different --gap/--minarea)"
echo "preview: $SCRATCH/${name}_preview.png"
