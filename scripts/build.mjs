// Build the extension twice, for Chrome and for Firefox, into dist/<browser>.
import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
// The public half of the key Chrome derives this extension's id from, so an
// unpacked build has the same id everywhere and the native host can name it.
const chromeKey = readFileSync("keys/chrome-public.b64", "utf8").trim();

const base = {
  manifest_version: 3,
  name: "hbs2-hub",
  version: pkg.version,
  description: pkg.description,
  permissions: ["nativeMessaging", "storage"],
  host_permissions: ["https://github.com/*", "https://raw.githubusercontent.com/*"],
  icons: { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" },
  action: { default_title: "hbs2-hub", default_icon: { 16: "icons/icon-16.png", 32: "icons/icon-32.png" } },
  options_ui: { page: "pages/options.html", open_in_tab: true },
  content_scripts: [{ matches: ["https://github.com/*"], js: ["content.js"], css: ["content.css", "thread.css"], run_at: "document_idle" }],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'none'" },
};

const targets = {
  chrome: { ...base, key: chromeKey, background: { service_worker: "background.js" }, minimum_chrome_version: "120" },
  firefox: {
    ...base,
    background: { scripts: ["background.js"] },
    // Nothing leaves the machine but to the user's own hbs2-hub host, so the
    // answer Mozilla asks every new extension for is "none".
    browser_specific_settings: { gecko: { id: "hbs2-hub@hbs2.app", strict_min_version: "128.0",
                                          data_collection_permissions: { required: ["none"] } } },
  },
};

for (const [name, manifest] of Object.entries(targets)) {
  const out = `dist/${name}`;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(`${out}/pages`, { recursive: true });
  await build({
    entryPoints: {
      background: "src/background.ts",
      content: "src/content.ts",
      "pages/repo": "src/pages/repo.ts",
      "pages/thread": "src/pages/thread.ts",
      "pages/options": "src/pages/options.ts",
      "pages/compose": "src/pages/compose.ts",
      "pages/inbox": "src/pages/inbox.ts",
      "pages/maintainers": "src/pages/maintainers.ts",
    },
    bundle: true,
    format: "iife",
    target: name === "chrome" ? "chrome120" : "firefox128",
    outdir: out,
    logLevel: "warning",
  });
  for (const f of ["repo.html", "thread.html", "options.html", "compose.html", "inbox.html", "maintainers.html", "style.css", "compose.css"]) cpSync(`src/pages/${f}`, `${out}/pages/${f}`);
  cpSync("icons", `${out}/icons`, { recursive: true, filter: (f) => !f.endsWith(".svg") });
  cpSync("src/content.css", `${out}/content.css`);
  cpSync("src/thread.css", `${out}/thread.css`);
  writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`built ${out}`);
}
