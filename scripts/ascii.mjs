// Source is ASCII. A bidi override or an invisible character in code is the
// Trojan Source class of bug, and none of these files needs anything else.
import { readdirSync, readFileSync, statSync } from "node:fs";
let bad = 0;
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = `${d}/${f}`;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|mjs|html|css|json|md)$/.test(p)) {
      readFileSync(p, "utf8").split("\n").forEach((l, i) => {
        if (/[^\x00-\x7f]/.test(l)) { console.error(`${p}:${i + 1}: not ASCII`); bad++; }
      });
    }
  }
};
for (const d of ["src", "test", "scripts"]) walk(d);
process.exit(bad ? 1 : 0);
