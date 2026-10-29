// Lets the preview scripts import the game's extensionless TS modules directly.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as join } from 'node:path';

export async function resolve(spec, ctx, next) {
  if (spec.startsWith('.') && !/\.(ts|tsx|mjs|js|json)$/.test(spec) && ctx.parentURL?.startsWith('file:')) {
    const dir = dirname(fileURLToPath(ctx.parentURL));
    for (const cand of [`${spec}.ts`, `${spec}/index.ts`]) {
      const p = join(dir, cand);
      if (existsSync(p)) return next(pathToFileURL(p).href, ctx);
    }
  }
  return next(spec, ctx);
}
