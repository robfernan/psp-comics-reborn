# PSP Digital Comics Reborn

<div align="center">

[![Bun](https://img.shields.io/badge/Bun-v1.4.3-black?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![React 19](https://img.shields.io/badge/React-v19.0-20232a?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-v6.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Web Audio](https://img.shields.io/badge/Web_Audio-Procedural_SFX-8b5cf6?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Storage](https://img.shields.io/badge/Storage-IndexedDB_Local--First-ea580c?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
[![License](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](LICENSE)

<br/>

![PSP Digital Comics Animation](PSP%20Digital%20Comics.gif)

<p align="center">
  <b>A faithful homage and modern evolution of Sony's legendary PlayStation Portable (PSP) Digital Comics reader.</b>
  <br/>
  Featuring the authentic XMB-era interface, original firmware sprite assets, wave ribbon background, procedural retro sound effects, and an evolved reading engine supporting modern Western Comics, Manga, and vertical Manhwa/Webtoons.
</p>

</div>

---

## 📺 Video Demo & Walkthrough

[![Watch the PSP Digital Comics Reborn Demo](https://img.youtube.com/vi/PD-8Q7aSv90/maxresdefault.jpg)](https://youtu.be/PD-8Q7aSv90)

> 🎥 **[Watch the full walkthrough on YouTube](https://youtu.be/PD-8Q7aSv90)** to see the 3D cover carousel, 9-slice XMB menus, audio SFX, and multi-format reader in action.

---

## ✨ Key Features

### 🎮 Authentic Sony PSP Aesthetics
- **Original Firmware Textures** — Extracted from PSP firmware: 9-slice menu bars (`menuitem_sel/unsel`), top bar chrome, controller button prompts (○, ✕, △, □), busy spinner, and the iconic animated wave ribbon (`bg_wave.png`).
- **3D Cover Flow Carousel** — Dynamic 3D perspective carousel with real-time floor reflection (`-webkit-box-reflect`) recreating the original PSP cover browser.
- **Unified Gamepad & Keyboard Controls** — Native PlayStation, Xbox, and standard game controller support via Web Gamepad API alongside intuitive keyboard shortcuts.

### 🎨 12 PSP Monthly Firmware Themes + Special Themes
Accurately matched to Sony PSP System Software 3.70+ monthly calendar themes:
- **January** — Platinum Frost (`#94a3b8`)
- **February** — Canary Yellow (`#eab308`)
- **March** — Spring Sprout (`#84cc16`)
- **April** — Sakura Blossom Pink (`#f472b6`)
- **May** — Emerald Forest (`#22c55e`)
- **June** — Summer Sky (`#38bdf8`)
- **July** — Ocean Cyan (`#06b6d4`)
- **August** — Midnight Cobalt (`#3b82f6`)
- **September** — Royal Amethyst (`#a855f7`)
- **October** — Autumn Gold (`#f59e0b`)
- **November** — Warm Amber (`#ea580c`)
- **December** — Deep Crimson Ruby (`#e11d48`)
- **Classic Crimson** — Original PSP Digital Comics Red (`#ff4535`)
- **Monolith Noir** — OLED Minimal Pure Grayscale (`#ffffff`)
- **Cyberpunk Neon** — Electric Teal & Violet (`#00f0ff`)
- **Auto-Sync Mode** — Automatically syncs the theme to the current calendar month just like a genuine PSP!

### 🔊 Procedural Web Audio SFX
- **Zero Asset Bloat** — Pure procedural synthesizer using Web Audio API (no external sound files required, zero latency).
- **PSP Mechanical Cursor Tick** — Subtle high-frequency mechanical click on every navigation step.
- **PSP Confirm Chime (○ button)** — Ascending two-tone chime.
- **PSP Cancel Tone (✕ button)** — Descending soft tone.
- **Page Flip Audio** — Crisp tactile page turn sound.
- **Mute / Enable Toggle** — Full sound toggle in the Settings modal.

### 📖 Evolved Multi-Format Reader
- **Western Comics (Paged LTR)** — Traditional left-to-right reading with optional 2-page spread on desktop monitors.
- **Manga (Paged RTL)** — Authentic right-to-left page turning with reverse arrow mapping.
- **Manhwa / Webtoons (Continuous Vertical Scroll)** — Seamless gapless vertical ribbon scroll for modern digital manhwa.
- **Smart Auto-Detection** — Automatically identifies webtoon aspect ratios and parses `ComicInfo.xml` (ComicRack / Komga standard) for metadata and reading direction.
- **Display Fit Modes** — Fit to Screen (Contain), Fit Width, and Fit Height with Fullscreen toggle (F11).

### 🔒 Privacy & Performance
- **Zero Preloaded Comics** — Starts with a clean slate; your library only contains the comics you add.
- **Local-First Storage** — Comics and files are stored client-side in browser IndexedDB. No external servers or telemetry.
- **Instant Lazy Loading** — Large CBZ/ZIP archives are extracted on demand with memory-efficient prefetching and page disposal.

---

## 🎮 Controls Reference

| Action | Controller (Gamepad) | Keyboard |
|---|---|---|
| **Navigate / Move Cursor** | D-Pad / Left Stick | Arrow Keys / W, A, S, D |
| **Confirm / Open / Next Page** | ○ (Circle / A) | Enter / Space / → |
| **Back / Exit / Cancel** | ✕ (Cross / B) | Escape / Backspace |
| **Resume Reading / Bookmark** | △ (Triangle / Y) | I / ← |
| **Options / Settings** | □ (Square / X) | B |
| **Scroll / Page Flip** | L / R Bumpers | Q / E or PageUp / PageDown |
| **Pause / Return to Home** | START / SELECT | O / V |
| **Fullscreen** | — | F11 |

---

## 🚀 Quick Start

Built and optimized for **[Bun](https://bun.sh)**.

### 1. Install Dependencies
```bash
bun install
```

### 2. Start Development Server
```bash
bun run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### 3. Type-check & Production Build
```bash
bun run build
```

### 4. Preview Production Build
```bash
bun run preview
```

---

## 🎨 Adding Custom Themes in the Future

PSP Comics Reborn is designed to make adding new themes effortless:

1. **Add your theme ID & metadata in [`src/lib/types.ts`](src/lib/types.ts):**
   ```typescript
   export type ThemeColor = ... | 'my-custom-theme';

   export const THEME_CONFIGS: ThemeConfig[] = [
     ...,
     { id: 'my-custom-theme', label: 'Custom Vaporwave', accent: '#ec4899', previewBg: '#8b5cf6' }
   ];
   ```

2. **Add CSS hue-rotation & accent in [`src/psp-theme.css`](src/psp-theme.css):**
   ```css
   [data-theme="my-custom-theme"] {
     --psp-accent: #ec4899;
     --psp-accent-dark: #8b5cf6;
   }
   [data-theme="my-custom-theme"] .psp-wave-ribbon {
     filter: hue-rotate(290deg) saturate(1.4) contrast(1.1);
   }
   [data-theme="my-custom-theme"] .psp-read-btn {
     border-color: #ec4899;
     background: linear-gradient(#ec4899, #8b5cf6);
   }
   ```
The theme will automatically appear in the Options modal palette and apply to the background ribbon and UI accents.

---

## 🗺️ Roadmap & Future Evolutions

- [x] **Zero Initial Comics** — Clean slate local storage with instant `.cbz` / `.zip` import
- [x] **Web Audio SFX** — Procedural PSP mechanical tick, confirm, cancel, and page turn chimes
- [x] **12-Month Calendar Themes** — All Sony PSP firmware monthly color schemes + auto-calendar sync
- [x] **3D Cover Flow Floor Reflection** — Authentic reflective floor under carousel cards
- [x] **Continuous Webtoon Scroll** — Smooth vertical scrolling with auto-detection for Korean manhwa
- [ ] **Guided Panel-by-Panel View** — Homage to PSP Digital Comics SensMe / AutoFlow panel extraction
- [ ] **OPDS Remote Library Connect** — Stream comics directly from self-hosted Komga, Kavita, or Calibre servers
- [ ] **Custom XMB Wallpaper Import** — Allow setting custom background image under the wave ribbon
- [ ] **PWA & Offline Packaging** — Native installation via Tauri (Desktop) and Capacitor (Mobile)

---

## 📂 Project Structure

```
├── public/
│   ├── psp-assets/
│   │   ├── textures/       # Authentic PSP firmware UI sprites (9-slice items, top bar, buttons, logos)
│   │   └── fonts/          # Firmware bitmap font sheets (reference)
│   ├── favicon.svg         # PSP-styled vector favicon
│   └── sw.js               # Service Worker
├── src/
│   ├── lib/
│   │   ├── archive.ts      # CBZ/ZIP extraction, ComicInfo.xml parser, lazy page loader
│   │   ├── audio.ts        # Procedural Web Audio API sound synthesizer
│   │   ├── db.ts           # IndexedDB persistence (comics metadata & files)
│   │   ├── input.ts        # Unified Gamepad & Keyboard controller layer
│   │   └── types.ts        # Comic, Settings, Theme, and ReadingMode definitions
│   ├── App.tsx             # Main application shell (Main Menu, Carousel, Recent, Reader, Settings)
│   ├── index.css           # Global resets & Tailwind base
│   ├── main.tsx            # React application entry point
│   └── psp-theme.css       # Authentic PSP wave ribbon, monthly themes & 9-slice styling
├── package.json            # Managed with Bun
├── tsconfig.json           # Application TypeScript config
├── tsconfig.node.json      # Vite Node TypeScript config
└── vite.config.ts          # Vite build config
```

---

## 📜 Attribution & License

- **License:** MIT
- **Homage Notice:** PlayStation Portable, PSP, and related marks are trademarks of Sony Interactive Entertainment Inc. All extracted texture assets are utilized for non-commercial educational and preservation homage.