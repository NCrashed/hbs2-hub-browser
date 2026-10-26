// A small picture for a key, so a thread reads like GitHub's, where every
// comment has a face. hbs2 keys have no avatars; this draws the same 5x5
// symmetric pattern and colour for the same key, every time, everywhere.

/** FNV-1a over the key's characters: a spread, not a secret. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Which of the 5x5 cells are filled, mirrored left to right, and the hue. */
export function identicon(key: string): { cells: boolean[][]; hue: number } {
  const h = hash(key);
  const h2 = hash(key + "/hue");
  const cells: boolean[][] = [];
  for (let y = 0; y < 5; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < 3; x++) row.push(((h >>> (y * 3 + x)) & 1) === 1);
    cells.push([row[0]!, row[1]!, row[2]!, row[1]!, row[0]!]);
  }
  return { cells, hue: h2 % 360 };
}

/** The picture, as an SVG built with the DOM API. */
export function identiconEl(key: string, size = 40): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const { cells, hue } = identicon(key);
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 5 5");
  s.setAttribute("width", String(size));
  s.setAttribute("height", String(size));
  s.setAttribute("class", "hbs2-avatar");
  s.setAttribute("aria-hidden", "true");
  const bg = document.createElementNS(ns, "rect");
  bg.setAttribute("width", "5");
  bg.setAttribute("height", "5");
  bg.setAttribute("fill", `hsl(${hue} 30% 92%)`);
  s.append(bg);
  cells.forEach((row, y) => row.forEach((on, x) => {
    if (!on) return;
    const r = document.createElementNS(ns, "rect");
    r.setAttribute("x", String(x));
    r.setAttribute("y", String(y));
    r.setAttribute("width", "1");
    r.setAttribute("height", "1");
    r.setAttribute("fill", `hsl(${hue} 55% 45%)`);
    s.append(r);
  }));
  return s;
}
