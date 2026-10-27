// Writes the app list (from apps.json, with icons and logo inlined) into index.html, so the page is
// one standalone file: it opens with no other files and loads nothing from other sites. The APK
// links stay absolute, so they work wherever the file is opened. publish.mjs runs this on every release.
//
//   node tools/build-page.mjs
import fs from "fs";
import path from "path";

const START = "<!--APPS-DATA-->";
const END = "<!--/APPS-DATA-->";

const dataUri = (file, type = "image/png") =>
  fs.existsSync(file) ? `data:${type};base64,${fs.readFileSync(file).toString("base64")}` : null;

export function buildPage(root = process.cwd()) {
  const pagePath = path.join(root, "index.html");
  const index = JSON.parse(fs.readFileSync(path.join(root, "apps.json"), "utf8"));
  const apps = {};
  for (const [code, a] of Object.entries(index.apps || {})) {
    apps[code] = { ...a, icon: a.icon ? dataUri(path.join(root, a.icon)) : null };
  }
  const data = { updated_at: index.updated_at, logo: dataUri(path.join(root, "logo-mark.png")), apps };
  // "<" escaped so nothing in the data can close the script tag.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const block = `${START}<script id="apps-data" type="application/json">${json}</script>${END}`;
  const page = fs.readFileSync(pagePath, "utf8");
  const i = page.indexOf(START), j = page.indexOf(END);
  if (i < 0 || j < 0) throw new Error(`index.html needs the ${START} … ${END} markers`);
  fs.writeFileSync(pagePath, page.slice(0, i) + block + page.slice(j + END.length));
  console.log(`index.html updated: ${Object.keys(apps).length} apps, ${(fs.statSync(pagePath).size / 1e3).toFixed(0)} kB`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"))) {
  buildPage();
}
