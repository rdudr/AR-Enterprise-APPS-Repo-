// Adds one built APK to this page: copies it to apps/<code>/, updates apps.json, and removes old
// files beyond the last KEEP per app (their entries stay in the history, marked as not hosted).
// The caller commits and pushes. Running it twice with the same APK changes nothing.
//
//   node tools/publish.mjs --apk <file.apk> --code pump --name "Pump Testing" --version 0.1.7
//        [--tagline "..."] [--app-config <app>/lib/ares/app-config.ts] [--icon <png>] [--commit abc1234]
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { buildPage } from "./build-page.mjs";

const PAGE_URL = (process.env.APK_PAGE_URL || "https://ops.arenergyservices.in/apps").replace(/\/$/, "");
const KEEP = 3; // APK files kept per app; older versions stay listed but are not downloadable
const HISTORY = 25; // versions listed per app
// The order apps appear on the page (any other app goes after these).
const ORDER = ["survey", "textile", "pump", "air", "heat", "cool"];

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const need = (name) => { const v = opt(name); if (!v) throw new Error(`--${name} is required`); return v; };

const src = path.resolve(need("apk"));
const code = need("code");
const name = need("name");
const version = need("version");
if (!/^[a-z][a-z0-9-]*$/.test(code)) throw new Error(`Bad app code: ${code}`);
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Bad version: ${version}`);
if (!fs.existsSync(src)) throw new Error(`APK not found: ${src}`);
let tagline = opt("tagline") || "";
if (!tagline && opt("app-config")) {
  const m = fs.readFileSync(opt("app-config"), "utf8").match(/tagline:\s*("(?:[^"\\]|\\.)*")/);
  if (m) tagline = JSON.parse(m[1]);
}

const newer = (a, b) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i];
  return false;
};

const root = process.cwd();
const indexPath = path.join(root, "apps.json");
const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : { apps: {} };
const prev = index.apps[code];

const bytes = fs.readFileSync(src);
const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
const file = path.basename(src);

if (prev && prev.version === version) {
  if (prev.sha256 === sha256) { console.log(`${name} v${version} is already published.`); process.exit(0); }
  throw new Error(`${name} v${version} is already published with a different file. Bump the version.`);
}
if (prev && !newer(version, prev.version)) throw new Error(`${name} v${version} is older than the published v${prev.version}.`);

const dir = path.join(root, "apps", code);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, file), bytes);
const icon = opt("icon");
if (icon && fs.existsSync(icon)) fs.copyFileSync(icon, path.join(dir, "icon.png"));

const release = {
  version,
  file,
  apk_url: `${PAGE_URL}/apps/${code}/${encodeURIComponent(file)}`,
  size: bytes.length,
  sha256,
  released_at: new Date().toISOString(),
  ...(opt("commit") ? { commit: opt("commit") } : {}),
};
const history = [{ ...release, hosted: true }, ...(prev?.history ?? [])].slice(0, HISTORY);

// Keep only the newest KEEP files on disk.
history.forEach((h, i) => {
  if (i < KEEP) return;
  if (h.hosted) fs.rmSync(path.join(dir, h.file), { force: true });
  h.hosted = false;
});
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith(".apk") && !history.some((h) => h.hosted && h.file === f)) fs.rmSync(path.join(dir, f));
}

index.apps[code] = {
  name,
  tagline: tagline || prev?.tagline || "",
  icon: fs.existsSync(path.join(dir, "icon.png")) ? `apps/${code}/icon.png` : prev?.icon ?? null,
  ...release,
  history,
};
const rank = (c) => (ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);
index.apps = Object.fromEntries(Object.entries(index.apps).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)));
index.updated_at = release.released_at;
index.$comment = "Written by tools/publish.mjs. Installed AR apps read apps[<code>].version and apk_url to offer updates.";
fs.writeFileSync(indexPath, JSON.stringify({ $comment: index.$comment, updated_at: index.updated_at, apps: index.apps }, null, 2) + "\n");
buildPage(root);
console.log(`Published ${name} v${version} -> apps/${code}/${file} (${(bytes.length / 1e6).toFixed(1)} MB)`);
