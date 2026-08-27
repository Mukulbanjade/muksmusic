// Post-export fix: Expo puts vector-icon fonts under assets/node_modules/...,
// but Vercel strips any `node_modules` path from deployments. Relocate the fonts
// to assets/fonts/ and rewrite the references so they load on static hosts.
import { readdirSync, statSync, renameSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const FONT_SRC = join(DIST, 'assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts');
const FONT_DST = join(DIST, 'assets/fonts');
const OLD_REF = 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts';
const NEW_REF = 'fonts';

if (!existsSync(FONT_SRC)) { console.log('no vendored fonts dir; nothing to fix'); process.exit(0); }
mkdirSync(FONT_DST, { recursive: true });
let moved = 0;
for (const f of readdirSync(FONT_SRC)) {
  renameSync(join(FONT_SRC, f), join(FONT_DST, f));
  moved++;
}

// Rewrite the path reference in every text file under dist (_expo js + index.html)
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(js|html|json)$/.test(e)) {
      const before = readFileSync(p, 'utf8');
      if (before.includes(OLD_REF)) {
        writeFileSync(p, before.split(OLD_REF).join(NEW_REF));
      }
    }
  }
}
walk(DIST);
console.log(`relocated ${moved} fonts -> assets/fonts and rewrote references`);
