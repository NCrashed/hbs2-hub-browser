// The files a release ships, from the builds in dist/, into dist/release/:
//
//   hbs2-hub-<v>-chrome.zip        unpack and "Load unpacked": the manifest keeps
//                                  its key, so the id is the one the native host
//                                  lets in (llmffghhboheiadaadikapcdifeolepc)
//   hbs2-hub-<v>-chrome-store.zip  for the Chrome Web Store, which refuses a
//                                  manifest with a key in it
//   hbs2-hub-<v>-firefox.zip       for addons.mozilla.org, to be signed there
//   hbs2-hub-<v>-source.zip        the sources, which AMO asks for because the
//                                  code is bundled; built with npm ci && npm run build
//
// Needs zip and git on PATH. Run through `npm run package`, which checks first.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const out = "dist/release";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const zip = (dir, name) => {
  execFileSync("zip", ["-q", "-r", "-X", `../../${out}/${name}`, "."], { cwd: dir, stdio: "inherit" });
  console.log(`${out}/${name}`);
};

zip("dist/chrome", `hbs2-hub-${version}-chrome.zip`);

// The store build: the same files, the manifest without its key.
const store = "dist/chrome-store";
rmSync(store, { recursive: true, force: true });
cpSync("dist/chrome", store, { recursive: true });
const manifest = JSON.parse(readFileSync(`${store}/manifest.json`, "utf8"));
delete manifest.key;
writeFileSync(`${store}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
zip(store, `hbs2-hub-${version}-chrome-store.zip`);

zip("dist/firefox", `hbs2-hub-${version}-firefox.zip`);

execFileSync("git", ["archive", "--format=zip", `--prefix=hbs2-hub-browser-${version}/`,
                     "-o", `${out}/hbs2-hub-${version}-source.zip`, "HEAD"], { stdio: "inherit" });
console.log(`${out}/hbs2-hub-${version}-source.zip`);
