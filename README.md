# PSP Digital Comics Reborn

![PSP Digital Comics Animation](PSP%20Digital%20Comics.gif)

A faithful recreation and modern evolution of the classic PlayStation Portable (PSP) Digital Comics reader. Built with **React 19**, **TypeScript**, and **Bun**, this application pairs the nostalgic XMB-era interface and authentic firmware sprite assets with a modern reading engine supporting Western comics, Manga, and vertical Manhwa/Webtoons.

Bring your own `.cbz` and `.zip` archives or image folders — all stored locally and securely in your browser using IndexedDB.

---

## 📺 Video Demo & Walkthrough

[![Watch the PSP Digital Comics Reborn Demo](https://img.youtube.com/vi/PD-8Q7aSv90/maxresdefault.jpg)](https://youtu.be/PD-8Q7aSv90)

> 🎥 **[Watch the full walkthrough on YouTube](https://youtu.be/PD-8Q7aSv90)** to see the 3D carousel, XMB-style menus, and multi-format reader in action.

---

## ✨ Features

- **Authentic PSP UI & Firmware Textures** — Built using genuine extracted PSP sprites: 9-slice menu bars (`menuitem_sel/unsel`), top bar chrome, controller button prompts (○, ✕, △, □), busy spinner, and the iconic animated wave ribbon background (`bg_wave.png`).
- **Evolved Reading Modes**:
  - **Western Comics (Paged LTR)** — Traditional left-to-right reading with optional 2-page spread on wide screens.
  - **Manga (Paged RTL)** — Authentic right-to-left page turning.
  - **Manhwa / Webtoons (Continuous Vertical Scroll)** — Seamless gapless vertical ribbon scroll for modern digital manhwa.
- **Smart Format Detection** — Automatically detects webtoon proportions and parses `ComicInfo.xml` (ComicRack / Komga standard) for titles, issue numbers, and reading direction.
- **Persistent Local Library** — Stored in browser IndexedDB. Archives are unpacked lazily with page caching and prefetching so even massive files open instantly.
- **Clean Slate Privacy** — No bundled comics or third-party tracking; starts clean and only holds what you import.
- **3D Cover Carousel** — Browse your library in a smooth, interactive 3D perspective carousel or a list view.
- **Gamepad & Controller Support** — Full Web Gamepad API integration for PlayStation, Xbox, and standard controllers, alongside keyboard controls.
- **Bookmark & Progress Tracking** — Tracks unread status and saves your exact page position so you can resume anytime.

---

## 🎮 Controls Reference

| Action | Controller (Gamepad) | Keyboard |
|---|---|---|
| **Navigate / Move** | D-Pad / Left Stick | Arrow Keys / W, A, S, D |
| **Confirm / Next Page** | ○ (Circle / A) | Enter / Space / → |
| **Back / Exit** | ✕ (Cross / B) | Escape / Backspace |
| **Resume / Bookmark / Prev Page** | △ (Triangle / Y) | I / ← |
| **Options / Bookmark Toggle** | □ (Square / X) | B |
| **Page Up / Page Down** | L / R Shoulder Bumpers | Q / E or PageUp / PageDown |
| **Pause / Return to Home** | START / SELECT | O / V |

---

## 🚀 Quick Start

Ensure you have [Bun](https://bun.sh) installed.

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

## 📂 Project Structure

```
├── public/
│   ├── psp-assets/
│   │   ├── textures/       # Authentic PSP firmware UI sprites (9-slice items, top bar, buttons, logos)
│   │   └── fonts/          # Firmware bitmap font sheets (kept for reference)
│   ├── favicon.svg         # PSP-styled favicon
│   └── sw.js               # Service Worker for offline capability
├── src/
│   ├── lib/
│   │   ├── archive.ts      # CBZ/ZIP extraction, ComicInfo.xml parser, lazy page loader
│   │   ├── db.ts           # IndexedDB persistence (comics metadata & files)
│   │   ├── input.ts        # Unified Gamepad & Keyboard controller layer
│   │   └── types.ts        # Comic, Settings, and ReadingMode definitions
│   ├── App.tsx             # Main application shell (Main Menu, Carousel, Recent, Reader, Settings)
│   ├── index.css           # Global resets & Tailwind base
│   ├── main.tsx            # React application entry point
│   └── psp-theme.css       # PSP wave ribbon animations and 9-slice sprite styling
├── package.json            # Managed with Bun
├── tsconfig.json           # Application TypeScript config
├── tsconfig.node.json      # Vite Node TypeScript config
└── vite.config.ts          # Vite build config
```

---

## 📱 Desktop & Mobile Packaging

- **Desktop (Windows, macOS, Linux):** [Tauri](https://tauri.app/) is recommended for native builds with minimal footprint and memory usage.
- **Mobile (Android, iOS):** [Capacitor](https://capacitorjs.com/) wraps the web build directly into native mobile applications.

---

## 📜 Attribution & License

- **License:** MIT
- **PSP Assets:** Sprites extracted from Sony PlayStation Portable system firmware for educational and non-commercial personal homage.