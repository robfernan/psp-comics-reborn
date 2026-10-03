import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'cbz.dart';
import 'dart:io';
import 'carousel.dart';
import 'reader_page.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Digital Comics (Flutter)',
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: Colors.black,
        primaryColor: Colors.orangeAccent,
      ),
      home: const HomePage(),
    );
  }
}

const COMIC_PATHS = [
  'assets/1 Scott Pilgrim\'s Precious Little Life.cbz',
  'assets/Absolute Batman 020 (2026) (Digital) (Pyrate-DCP).cbz',
  'assets/Batman Beyond - Return of the Joker (2001 comic adaptation).cbz',
  'assets/Official U.S. PlayStation Magazine Issue 01 (October 1997).cbz',
];

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final List<Comic> comics;
  int selectedMenuIndex = 0;
  int activeComicIndex = 0;
  bool menuOpen = true;

  static const menuItems = [
    'Browse Collection',
    'Recently Added',
    'Unread',
    'Bookmarks',
    'Options',
  ];

  @override
  Widget build(BuildContext context) {
    final selectedComic = comics.isNotEmpty ? comics[activeComicIndex] : null;
    final totalComics = comics.length.toString().padLeft(2, '0');

    return Scaffold(
      appBar: AppBar(title: const Text('Digital Comics')),
      body: Row(
        children: [
          // Left menu
          Container(
            width: 360,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(border: Border(right: BorderSide(color: Colors.white12))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4)),
                      child: const Text('DIGITAL', style: TextStyle(color: Colors.black, fontWeight: FontWeight.w900, letterSpacing: 2)),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(color: Color(0xffd83a1b), borderRadius: BorderRadius.circular(4)),
                      child: const Text('COMICS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, letterSpacing: 2, fontStyle: FontStyle.italic)),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Expanded(
                  child: ListView.builder(
                    itemCount: menuItems.length,
                    itemBuilder: (context, i) {
                      final label = menuItems[i];
                      final isActive = i == selectedMenuIndex;
                      final counter = i == 0 || i == 1 ? totalComics : i == 2 ? '00' : i == 3 ? '00' : '03';

                      return GestureDetector(
                        onTap: () {
                          setState(() => selectedMenuIndex = i);
                          if (i == 0) {
                            // open collection
                            Navigator.of(context).push(MaterialPageRoute(builder: (_) => CarouselPage(comics: comics)));
                          }
                        },
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            color: isActive ? Colors.orangeAccent.withOpacity(0.15) : Colors.white10,
                            border: Border.all(color: isActive ? Colors.transparent : Colors.white24),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), color: isActive ? Colors.white24 : Colors.black26),
                                child: Text(counter, style: const TextStyle(fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),

          // Center preview
          Expanded(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 260,
                    height: 390,
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(22), boxShadow: [BoxShadow(color: Colors.black54, blurRadius: 30, offset: Offset(0,20))], border: Border.all(color: Colors.white12)),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: selectedComic == null
                            ? Container(color: Colors.grey[900])
                          : Builder(builder: (context) {
                              // prefer workspace thumbs
                              try {
                                final abs = _workspaceThumbAbsolute(selectedComic.path);
                                final f2 = File(abs);
                                if (f2.existsSync()) return Image.file(f2, fit: BoxFit.cover);
                              } catch (_) {}

                              // try file thumbnail inside flutter/assets
                              if (selectedComic.thumbAsset != null) {
                                try {
                                  final f = File(selectedComic.thumbAsset!);
                                  if (f.existsSync()) return Image.file(f, fit: BoxFit.cover);
                                } catch (_) {}
                              }

                              return FutureBuilder<Uint8List?>(
                                future: extractCbzCover(selectedComic.path),
                                builder: (context, snap) {
                                  if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
                                  if (snap.data != null) return Image.memory(snap.data!, fit: BoxFit.cover);
                                  return Container(color: Colors.grey[850], child: Center(child: Text(selectedComic.title, style: const TextStyle(color: Colors.white))));
                                },
                              );
                            }),
                    ),
                  ),
                  const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: selectedComic == null ? null : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReaderPage(cbzPath: selectedComic.path, title: selectedComic.title))),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.white10, padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999))),
                    child: const Text('(Triangle) Resume', style: TextStyle(color: Color(0xfff5e7d8), fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    comics = COMIC_PATHS.map((p) => Comic(path: p, title: titleFromPath(p), thumbAsset: _thumbForPath(p))).toList();
  }


String? _thumbForPath(String path) {
  final fileName = path.split('/').last;
  final slug = fileName.replaceAll(RegExp(r"\.cbz", caseSensitive: false), '').replaceAll(RegExp(r"[^a-z0-9]+", caseSensitive: false), '-').replaceAll(RegExp(r"^-+|-+"), '').toLowerCase();
  final candidate = 'assets/thumbs/$slug.jpg';
  // We rely on Flutter asset bundling; existence will be checked at runtime by asset loader.
  return candidate;
}

String _workspaceThumbAbsolute(String path) {
  // Absolute path to the workspace thumbs folder (your workspace)
  // Adjust if your workspace is at a different location.
  final fileName = path.split('/').last;
  final slug = fileName.replaceAll(RegExp(r"\.cbz", caseSensitive: false), '').replaceAll(RegExp(r"[^a-z0-9]+", caseSensitive: false), '-').replaceAll(RegExp(r"^-+|-+"), '').toLowerCase();
  return '/home/rf80678/Documents/Digital Comics/public/thumbs/$slug.jpg';
}

}

