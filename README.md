# AR Enterprise Apps

Download page for the AR Energy Services Android field apps:
**https://ops.arenergyservices.in/apps/**

- `index.html` — the download page, **one standalone file**: the app list, icons and logo are embedded and it
  loads nothing from other sites, so it can also be opened or shared on its own. Every app is listed with its
  newest version first; the Download buttons link to the APK files here.
- `apps.json` — one entry per app: current version, download link, size, SHA-256 and history. Installed
  apps read it to offer updates, so its shape (`apps.<code>.version`, `apps.<code>.apk_url`) must stay.
- `apps/<code>/` — the APK files (the last 3 versions of each app) and the app icon.
- `tools/publish.mjs` — adds a built APK, updates `apps.json` and rewrites the list inside `index.html`
  (`tools/build-page.mjs`).

Nothing here is edited by hand. Each app repo has a GitHub Actions workflow (`android-apk.yml`) that,
on every change to its `main` branch, builds a signed APK and publishes it here with `tools/publish.mjs`.
A build can also be published from a laptop:

```bash
node scripts/android-apk.mjs --publish ../AR-Enterprise-APPS-Repo-
```

All apps are signed with the one AR Enterprise key, so an update installs over the old version and
keeps the data saved on the phone. The key is kept outside every repository.
