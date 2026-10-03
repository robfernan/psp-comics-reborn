Digital Comics — Flutter PSP-Style Comic Reader
==============================================

A faithful recreation of the classic PlayStation Portable (PSP) Digital Comics app, built with Flutter. Features an animated red smoky plasma background using layered sine wave CustomPainter, XMB-style menu navigation, and full CBZ comic book support.

Features
--------
- **Animated Plasma Background**: Organic flowing red/orange atmospheric wisps created with procedural sine wave animation (no heavy image filters)
- **PSP XMB Menu System**: Authentic cross-media bar interface with Browse Collection, Recently Added, Unread, Bookmarks, and Options
- **CBZ Comic Support**: Full comic book archive reading with cover extraction and page navigation
- **Bookmarks & Read Tracking**: Persistent bookmarking and read status using SharedPreferences
- **Landscape Orientation**: Forced landscape layout matching PSP's 16:9 aspect ratio
- **Cross-Platform**: Runs on Linux, macOS, Windows, Android, and iOS

Architecture
------------
```
lib/
├── main.dart           # App shell, HomePage with XMB menu, AtmosphericWisps background
├── carousel.dart       # Comic cover carousel for browsing collections
├── reader_page.dart    # Full-screen comic reader with page navigation
├── cbz.dart            # CBZ archive parsing and image extraction utilities
└── ribbon_background.dart  # Alternative animated background implementation
```

Key Technical Details
---------------------
**Animated Plasma Background (`AtmosphericWisps`)**: Uses a `CustomPainter` that draws three stacked semi-transparent wave layers with different frequencies, amplitudes, and speeds. Each layer combines sine and cosine waves to create organic motion, then applies a Gaussian blur mask filter for the smoky appearance. An 8-second repeating AnimationController drives the phase offset animation.

**Menu Styling**: Active menu items use vibrant red/orange linear gradients with glow shadows; inactive items have subtle dark backgrounds with white borders — matching the PSP's glossy XMB aesthetic.

Quick Run
---------
```bash
cd flutter
./setup_assets.sh   # creates symlinks to ../public/thumbs and ../assets
flutter pub get
flutter run -d linux    # or android, ios, macos, windows
```

Dependencies
------------
- `archive` — CBZ file parsing and extraction
- `shared_preferences` — persistent bookmarks and read tracking
- `vector_math` — vector calculations for wave animation (included in Flutter SDK)

Comparison Notes
----------------
- **Web (current project)**: Fast iteration, single codebase for browser, easy PWA deployment.
- **Wails**: Great for Go-based desktop apps with web UI; preserves web code.
- **Capacitor**: Good for mobile + web with existing web app; reuses web code.
- **Flutter (this project)**: Native UI performance, single Dart codebase across all platforms, authentic PSP feel with custom rendering.
