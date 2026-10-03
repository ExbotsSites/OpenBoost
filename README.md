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
