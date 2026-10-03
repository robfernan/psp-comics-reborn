Digital Comics — Flutter scaffold
===============================

What this is
- A minimal Flutter project scaffold placed in `flutter/` to let you compare Flutter to your existing web/Wails/Capacitor approaches.

What I created
- `pubspec.yaml` — basic dependencies
- `lib/main.dart` — minimal app shell
- `README.md` — this file

Notes and next steps
- I did not modify any existing web files; the scaffold is isolated under `flutter/`.
- To include your existing `assets/` (CBZ, images) either copy them into `flutter/assets/` or create a symbolic link there. Then add the `assets:` section in `pubspec.yaml`.
- Suggested next work: implement a CBZ viewer in Flutter (use `archive` + `photo_view` or `flutter_archive`) and wire up thumbnails from `public/thumbs/`.

Quick run (requires Flutter SDK installed)
```bash
cd flutter
./setup_assets.sh   # creates symlinks to ../public/thumbs and ../assets
flutter pub get
flutter run
```

Short comparison notes
- Web (current project): fast iteration, single codebase for browser, easy to reuse service workers and PWAs.
- Wails: great for Go-based desktop apps with web UI; preserves web code and offers native packaging.
- Capacitor: good for mobile + web with existing web app; reuses web code with native plugins.
- Flutter: native UI, high-performance cross-platform apps for mobile/desktop; requires re-implementation of UI and some platform-specific handling but provides a single Dart codebase.
