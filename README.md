# PSP Digital Comics Reborn

<div align="center">

![PSP Digital Comics Animation](PSP%20Digital%20Comics.gif)

**A faithful PSP Digital Comics reader recreation for CBZ — React, TypeScript, Vite.**

XMB-style menus, firmware sprites, a wave ribbon, and procedural sound. Bring your own `.cbz` archives; they stay in the browser.

<br/>

[![Star this repo](https://img.shields.io/badge/%E2%98%85-Star%20this%20repo-f5c518?style=for-the-badge&logo=github&logoColor=white)](https://github.com/robfernan/psp-comics-reborn)

<br/>

[![Watch the PSP Digital Comics Reborn Demo](https://img.youtube.com/vi/PD-8Q7aSv90/maxresdefault.jpg)](https://youtu.be/PD-8Q7aSv90)

[Watch the walkthrough on YouTube](https://youtu.be/PD-8Q7aSv90) — cover carousel, XMB menus, audio, and the reader.

<br/>

[![Bun](https://img.shields.io/badge/Bun-1.4.3-000000?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![React](https://img.shields.io/badge/React-19-20232a?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-10b981?style=flat-square)](LICENSE)

</div>

---

## Features

- **PSP interface** — Firmware sprites (9-slice menus, top bar, face buttons, busy spinner) and the animated wave ribbon (`bg_wave.png`).
- **Cover carousel** — 3D cover flow with a floor reflection.
- **Browser controls** — Keyboard shortcuts and standard gamepads through the Web Gamepad API.
- **Themes** — Twelve monthly PSP firmware colors, Classic Crimson, Monolith Noir, and Cyberpunk Neon, plus calendar auto-sync.
- **Sound** — Procedural Web Audio ticks, confirm and cancel chimes, and page turns. No sound files. Mute lives in Options.
- **CBZ reader** — Left-to-right comics, right-to-left manga, and vertical manhwa/webtoon scroll. `ComicInfo.xml` and tall-page detection pick a mode. Fit to screen, width, or height, with an optional two-page spread on wide windows and fullscreen (F11).
- **Local library** — Empty until you import `.cbz` or `.zip`. Files live in IndexedDB. Pages load on demand.

## Controls

| Action | Gamepad | Keyboard |
|---|---|---|
| Navigate | D-pad / left stick | Arrow keys / W A S D |
| Confirm / open / next page | South button (○ in the PSP UI) | Enter / Space |
| Back / cancel | East button (✕ in the PSP UI) | Escape / Backspace |
| Bookmark | North button (△) | I |
| Options | West button (□) | B |
| Page flip | L / R | Q / E or Page Up / Page Down |
| Home | Start / Select | O / V |
| Fullscreen | — | F11 |

On-screen prompts use PSP button art. Gamepads use the standard mapping in the browser.

## Quick start

Requires [Bun](https://bun.sh) 1.4.3.

```bash
bun install
bun run dev      # http://localhost:5173
bun run build    # typecheck + production build
bun run preview
```

## Adding a theme

1. Add an id to `ThemeColor` and `THEME_CONFIGS` in [`src/lib/types.ts`](src/lib/types.ts).
2. Set `--psp-accent` and the wave-ribbon `hue-rotate` under `[data-theme="…"]` in [`src/psp-theme.css`](src/psp-theme.css).

The new swatch shows up in Options.

## Roadmap

- [x] Local `.cbz` / `.zip` import with an empty starting library
- [x] Procedural Web Audio
- [x] Monthly firmware themes and calendar sync
- [x] Cover-flow floor reflection
- [x] Vertical webtoon scroll
- [ ] Panel-by-panel view
- [ ] OPDS libraries (Komga, Kavita, Calibre)
- [ ] Custom wallpaper under the wave ribbon

## Project structure

```
public/psp-assets/     firmware sprites and font sheets
public/sw.js           service worker
src/lib/archive.ts     CBZ/ZIP, ComicInfo.xml, lazy pages
src/lib/audio.ts       Web Audio synthesizer
src/lib/db.ts          IndexedDB
src/lib/input.ts       keyboard and gamepad
src/lib/types.ts       comics, settings, themes, reading modes
src/App.tsx            menu, carousel, reader, options
src/psp-theme.css      wave ribbon, themes, 9-slice chrome
```

## License

MIT. PlayStation, PSP, and related marks are trademarks of Sony Interactive Entertainment Inc. Firmware textures are included as a non-commercial educational and preservation homage. See [`public/psp-assets/LICENSE-NOTES.md`](public/psp-assets/LICENSE-NOTES.md).
