# OpenBoost

Open-source Windows tweaks for higher FPS, lower input delay and less bloat.
Every tweak lives in `tweaks.js`, shows exactly what it changes, and (apart from app removal) can be undone from the original values OpenBoost saved first.

## Run
```
npm install
npm start        # run from an administrator terminal for system-level tweaks
npm run dist     # build a Windows installer (asks for admin on launch)
```

## Pages
- **Home**: live CPU and memory, system scan, findings.
- **Benchmark**: run once before tweaking and once after. Also flags RAM speed, refresh rate, startup apps and processes as Good or Change now.
- **Tweaks**: Performance, Input, Network, Debloat. Risk is Zero, Low, Medium or Extreme; "Select up to" picks everything at or below a level.
- **BIOS guide**: firmware settings worth changing, safest first.
- **Tools**: live overlay, disk cleanup, and a graphics and driver helper.
- **Settings**: dark, midnight or light theme, any accent color, and five languages (English, Italiano, Español, Français, Deutsch).

## Tools
- **Live overlay**: a click-through window with CPU, memory and GPU load. Toggle it with Ctrl+Alt+O. It shows over windowed and borderless games, not exclusive fullscreen. GPU load comes from the Windows GPU Engine counters (3D engine).
- **Disk cleanup**: empties a fixed list of temp and cache folders (user temp, Windows temp, thumbnails, shader caches, Windows Update downloads, crash dumps, Recycle Bin). It never touches documents, games or saves, and skips files that are in use. Windows temp and Update downloads need administrator.
- **Graphics and drivers**: shows your GPU, driver version and age, hardware GPU scheduling status, and links to the vendor's official driver page, Graphics settings, Game Mode and Device Manager. OpenBoost does not download or install drivers itself.
- **Share card**: on the Benchmark page, save your before and after result as a 1200x630 JPG (Midnight, Paper or Accent style) or copy it to the clipboard.

## Translate
All interface text lives in `renderer/i18n.js`. Copy the `en` block, translate it, and add the language code to `LANG_NAMES` there and to `LANGS` in `settings.js`. Missing keys fall back to English.

## Add a tweak
Add a `T(id, cat, risk, name, desc, actions, extra)` entry to `tweaks.js`. Risk is 1 zero, 2 low, 3 medium, 4 extreme. Actions: `dw`/`sz` (registry), `svc` (service set to disabled), `{ t: 'power' }`, `appx` (remove apps).

Pull request rules: it must be reversible (or say why not), and include a source or a benchmark showing it does something.

## Network tools
- **DNS Jumper**: downloads the zip from sordum.org (other hosts are blocked), extracts it to a temp folder and opens it. The SHA-256 and Authenticode status are shown so you can check what ran.
- **Speed test**: pings every server in LibreSpeed's public network plus Cloudflare, picks the nearest automatically, or lets you choose any server (search by city or country). Location comes from your IP address.
- **Home** also lists the processes using the most memory.

## Icon
Put your `icon.jpg` next to `package.json` (a square image, 512x512 or larger, works best), then run `npm install` and `npm run icon`.
That makes the in-app logo, the window and taskbar icon, and `build/icon.ico` for the installer and `OpenBoost.exe`. `npm run dist` regenerates them automatically.
Build from an administrator terminal, or turn on Developer Mode in Windows, or electron-builder can fail with a symbolic link error.
