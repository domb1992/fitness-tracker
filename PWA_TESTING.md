# FitTrack PWA — Testing Guide

## Architecture Overview

| File | Purpose |
|------|---------|
| `frontend/vite.config.ts` | VitePWA plugin: manifest, Workbox config, caching rules |
| `frontend/pwa-assets.config.ts` | `@vite-pwa/assets-generator` — creates all PNG icons from `favicon.svg` |
| `frontend/public/manifest.webmanifest` | *Generated at build time by VitePWA* |
| `frontend/public/sw.js` | *Generated at build time by Workbox* |
| `frontend/src/components/PWAUpdatePrompt.tsx` | In-app "UPDATE AVAILABLE — RELOAD" banner |
| `netlify.toml` | Netlify build command + `no-cache` headers for SW/manifest |

---

## Testing Locally

Service workers are disabled in `vite dev` to avoid HMR conflicts.  
**Always test PWA features against a production build:**

```bash
cd frontend
npm run build      # TypeScript check + Vite build + SW/manifest generation
npm run preview    # Serves dist/ at http://localhost:4173
```

Open **http://localhost:4173** in Chrome.

### 1 — Verify the Service Worker

1. DevTools → **Application** → **Service Workers**
2. Status should be **"activated and running"**
3. Click **Inspect** to open the SW's DevTools console

### 2 — Verify the Manifest

1. DevTools → **Application** → **Manifest**
2. Check that all fields parse: name, icons (4 entries), theme_color, display

### 3 — Verify Installability (Chrome desktop)

1. After the SW is registered, an **install icon (⊕)** appears in the address bar
2. Click it → "Install FitTrack" dialog appears
3. After install, the app opens in its own window (no address bar)

### 4 — Lighthouse PWA Audit (local)

1. DevTools → **Lighthouse** → tick **Progressive Web App** → Analyze
2. Expected: all PWA checks green (installable, SW registered, manifest valid)

### 5 — Test Offline Fallback

1. DevTools → **Network** tab → throttling dropdown → **Offline**
2. Reload — the app shell should load from SW cache
3. In-app data (Supabase) will fail gracefully (NetworkOnly rule)

### 6 — Test Update Flow (local)

1. Run `npm run build && npm run preview` (first version)
2. Open http://localhost:4173 — SW registers
3. Make any change to a source file, rebuild: `npm run build`
4. Keep the first tab open and reload — SW detects the new version
5. The **"UPDATE AVAILABLE — RELOAD"** banner should appear at the bottom
6. Click **RELOAD** — app refreshes with the new version

### 7 — iOS Safari (local, via LAN)

1. Find your machine's LAN IP: `ipconfig` → IPv4 address (e.g. `192.168.1.42`)
2. Run `npm run preview -- --host` to expose on the network
3. On iPhone, open `http://192.168.1.42:4173`
4. Tap the Share icon → **"Add to Home Screen"** → Add
5. Open from Home Screen — verify standalone mode (no Safari address bar)
6. Check the icon matches the FitTrack logo

---

## After Netlify Deployment

Push to main — Netlify runs `npm install && npm run pwa-gen && npm run build`.

### Android Chrome

1. Open the Netlify URL in Chrome
2. Install banner / address-bar ⊕ icon should appear after ~30 seconds
3. Tap **Install** → app opens in standalone mode
4. Go offline → app shell still loads; network-dependent data shows appropriate empty states

### Desktop Chrome / Edge

1. Address-bar install icon (⊕) appears
2. Install → opens in its own app window

### iOS Safari

1. Open the Netlify URL in Safari
2. Tap **Share** → **Add to Home Screen** → **Add**
3. Opens in standalone mode (black translucent status bar, no address bar)
4. The `apple-touch-icon-180x180.png` is used as the home-screen icon

### Lighthouse on Deployed URL

Run from Chrome DevTools on the Netlify URL — all PWA checks should be green:
- ✅ Installable
- ✅ Service worker registered
- ✅ Works offline
- ✅ Manifest is valid
- ✅ `apple-touch-icon` present

---

## Supabase Auth — Why It Still Works Offline

All `*.supabase.co` and `*.supabase.in` URLs use **NetworkOnly** in the SW.  
This means:

- Auth login/logout always hits the real server — no stale tokens served from cache
- Database reads/writes go directly to Supabase — no risk of serving stale data
- If offline, the request fails normally and the app handles it via Zustand offline state

---

## Regenerating Icons

If you update `public/favicon.svg`:

```bash
cd frontend
npm run pwa-gen   # regenerates all PNGs in public/
npm run build     # rebuilds with fresh icons
```

Commit the updated PNG files.

---

## Common Issues

| Symptom | Fix |
|---------|-----|
| Install prompt never appears | Ensure HTTPS (Netlify provides this automatically) |
| SW not updating after deploy | Check `Cache-Control: no-cache` on `sw.js` in Netlify headers |
| iOS shows Safari chrome in standalone mode | Verify `apple-mobile-web-app-capable` meta tag in `index.html` |
| Icons missing or wrong size | Re-run `npm run pwa-gen` and rebuild |
| Auth broken after install | Confirm `NetworkOnly` rule covers your Supabase project URL |
