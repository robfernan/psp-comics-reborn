import 'dart:math' as math;
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'cbz.dart';
import 'dart:io';
import 'carousel.dart';
import 'reader_page.dart';

/// Animated red smoky plasma background using layered sine wave CustomPainter.
/// Creates the organic, flowing PSP atmospheric effect with procedural animation.
class AtmosphericWisps extends StatefulWidget {
  const AtmosphericWisps({super.key});

  @override
  State<AtmosphericWisps> createState() => _AtmosphericWispsState();
}

class _AtmosphericWispsState extends State<AtmosphericWisps>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    // Slow animation controller for the breathing/plasma effect
    _controller = AnimationController(
      duration: const Duration(seconds: 8),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return CustomPaint(
          painter: FlameRibbonPainter(animationValue: _controller.value),
        );
      },
    );
  }
}

/// CustomPainter that draws multiple intersecting wave layers to create
/// the organic red/orange plasma/smoke effect seen on PSP screens.
class FlameRibbonPainter extends CustomPainter {
  final double animationValue;

  FlameRibbonPainter({required this.animationValue});

  @override
  void paint(Canvas canvas, Size size) {
    // Base layer: subtle radial glow to frame the scene
    final center = Offset(size.width / 2, size.height / 2);
    final glowPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          Colors.red.withOpacity(0.15),
          Colors.deepOrange.withOpacity(0.04),
          Colors.transparent,
        ],
      ).createShader(Rect.fromCircle(center: center, radius: size.width * 0.8));
    canvas.drawRect(Offset.zero & size, glowPaint);

    // Main plasma layers — stacked semi-transparent waves with different frequencies
    _drawWaveLayer(canvas, size, 5, 0.12, 0.04, Colors.red);
    _drawWaveLayer(canvas, size, 7, 0.18, 0.06, Colors.deepOrange);
    _drawWaveLayer(canvas, size, 10, 0.08, 0.08, Colors.redAccent);
  }

  void _drawWaveLayer(Canvas canvas, Size size, int waveCount,
      double amplitude, double speedMultiplier, Color color) {
    final paint = Paint()
      ..color = color.withOpacity(0.2)
      ..style = PaintingStyle.fill;

    final path = Path();
    path.moveTo(0, size.height);

    // Calculate phase offset based on animation controller value
    final timeOffset = animationValue * math.pi * 2 * speedMultiplier;

    for (double i = 0; i <= size.width; i++) {
      // Create organic multi-layered wave math using combined sine/cosine waves
      final double wave1 =
          math.sin((i / size.width * waveCount * math.pi) + timeOffset);
      final double wave2 = math.sin(
          (i / size.width * waveCount * 1.5 * math.pi) + timeOffset * 2);
      final double wave3 = math.cos(
          (i / size.width * waveCount * 0.5 * math.pi) - timeOffset * 1.5);

      // Combine waves and apply vertical amplitude modulation
      double y = size.height * 0.5 +
          (size.height * amplitude * wave1 * wave2 * wave3);

      path.lineTo(i, y);
    }

    path.lineTo(size.width, size.height);
    path.close();

    // Apply blur mask filter to soften edges into smoky ribbons
    canvas.drawPath(path,
        paint..maskFilter = const MaskFilter.blur(BlurStyle.normal, 15));
  }

  @override
  bool shouldRepaint(covariant FlameRibbonPainter oldDelegate) {
    return oldDelegate.animationValue != animationValue;
  }
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Force landscape orientation for PSP-like experience (wrapped in try-catch for Linux compatibility)
  try {
    SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
  } catch (_) {
    // setPreferredOrientations not supported on all platforms (e.g., Flutter Linux desktop)
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PSP Digital Comics',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: Colors.black,
        primaryColor: const Color(0xFFd94a17),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent,
          elevation: 0,
          titleTextStyle: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
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

class _HomePageState extends State<HomePage> with SingleTickerProviderStateMixin {
  late final List<Comic> comics;
  int selectedMenuIndex = 0;
  int activeComicIndex = 2; // Batman Beyond - Return of the Joker (matches screenshot)
  bool menuOpen = true;

  // Bookmarks and read tracking
  Set<String> bookmarkedIds = {};
  Set<String> readIds = {};
  SharedPreferences? prefs;

  static const menuItems = [
    'Browse Collection',
    'Recently Added',
    'Unread',
    'Bookmarks',
    'Options',
  ];

  @override
  void initState() {
    super.initState();
    comics = COMIC_PATHS.map((p) => Comic(path: p, title: titleFromPath(p), thumbAsset: _thumbForPath(p))).toList();
    _loadPreferences();
  }



  Future<void> _loadPreferences() async {
    prefs = await SharedPreferences.getInstance();
    setState(() {
      bookmarkedIds = Set.from(prefs!.getStringList('bookmarks') ?? []);
      readIds = Set.from(prefs!.getStringList('read') ?? []);
    });
  }

  Future<void> _saveBookmarks() async {
    await prefs?.setStringList('bookmarks', bookmarkedIds.toList());
  }

  Future<void> _saveReadStatus() async {
    await prefs?.setStringList('read', readIds.toList());
  }

  void toggleBookmark(String comicId) {
    setState(() {
      if (bookmarkedIds.contains(comicId)) {
        bookmarkedIds.remove(comicId);
      } else {
        bookmarkedIds.add(comicId);
      }
    });
    _saveBookmarks();
  }

  void markAsRead(String comicId) {
    setState(() {
      readIds.add(comicId);
    });
    _saveReadStatus();
  }

  Future<void> _showOptionsDialog(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    bool showPageCounter = prefs.getBool('reader.showPageCounter') ?? true;
    String readingDirection = prefs.getString('reader.readingDirection') ?? 'ltr';
    String fitMode = prefs.getString('reader.fitMode') ?? 'contain';

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1a1a1a),
          title: const Text('Options', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SwitchListTile(
                title: const Text('Page Counter', style: TextStyle(color: Colors.white)),
                value: showPageCounter,
                onChanged: (value) => setState(() => showPageCounter = value),
              ),
              ListTile(
                title: const Text('Reading Direction', style: TextStyle(color: Colors.white)),
                trailing: DropdownButton<String>(
                  value: readingDirection,
                  items: ['ltr', 'rtl'].map((dir) => DropdownMenuItem(value: dir, child: Text(dir.toUpperCase()))).toList(),
                  onChanged: (value) => setState(() => readingDirection = value!),
                ),
              ),
              ListTile(
                title: const Text('Page Fit', style: TextStyle(color: Colors.white)),
                trailing: DropdownButton<String>(
                  value: fitMode,
                  items: ['contain', 'cover'].map((fit) => DropdownMenuItem(value: fit, child: Text(fit.toUpperCase()))).toList(),
                  onChanged: (value) => setState(() => fitMode = value!),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                prefs.setBool('reader.showPageCounter', showPageCounter);
                prefs.setString('reader.readingDirection', readingDirection);
                prefs.setString('reader.fitMode', fitMode);
                Navigator.of(context).pop();
              },
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final selectedComic = comics.isNotEmpty ? comics[activeComicIndex] : null;
    final totalComics = comics.length.toString().padLeft(2, '0');

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Atmospheric side wisps — layered radial gradients for reliable rendering
          const AtmosphericWisps(),

          // Main content overlay
          Column(
            children: [
              // Top header bar
              _buildHeaderBar('All Comics'),

              // Center carousel area
              Expanded(
                child: Row(
                  children: [
                    // Left menu panel
                    Container(
                      width: 360,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        border: Border(right: BorderSide(color: Colors.white12)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // PSP-style logo header
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
                                child: const Text('DIGITAL', style: TextStyle(color: Colors.black, fontWeight: FontWeight.w900, letterSpacing: 3, fontSize: 15)),
                              ),
                              const SizedBox(width: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                                decoration: BoxDecoration(color: const Color(0xFFd83a1b), borderRadius: BorderRadius.circular(6)),
                                child: const Text('COMICS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, letterSpacing: 2, fontStyle: FontStyle.italic, fontSize: 15)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 18),

                          // XMB Menu List with glossy gradients and counter badges
                          Expanded(
                            child: ListView.builder(
                              itemCount: menuItems.length,
                              itemBuilder: (context, i) {
                                final label = menuItems[i];
                                final isActive = i == selectedMenuIndex;
                                String counter;
                                if (i == 0 || i == 1) {
                                  counter = totalComics;
                                } else if (i == 2) {
                                  final unreadCount = comics.where((c) => !readIds.contains(c.path)).length;
                                  counter = unreadCount.toString().padLeft(2, '0');
                                } else if (i == 3) {
                                  counter = bookmarkedIds.length.toString().padLeft(2, '0');
                                } else {
                                  counter = '03';
                                }

                                return GestureDetector(
                                  onTap: () {
                                    setState(() => selectedMenuIndex = i);
                                    if (i == 0) {
                                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => CarouselPage(comics: comics)));
                                    } else if (i == 1) {
                                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => CarouselPage(comics: comics)));
                                    } else if (i == 2) {
                                      final unreadComics = comics.where((c) => !readIds.contains(c.path)).toList();
                                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => CarouselPage(comics: unreadComics)));
                                    } else if (i == 3) {
                                      final bookmarkedComics = comics.where((c) => bookmarkedIds.contains(c.path)).toList();
                                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => CarouselPage(comics: bookmarkedComics)));
                                    } else if (i == 4) {
                                      _showOptionsDialog(context);
                                    }
                                  },
                                  child: Container(
                                    margin: const EdgeInsets.symmetric(vertical: 6),
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(24),
                                      // Active state: vibrant red/orange gradient with glow
                                      gradient: isActive
                                          ? LinearGradient(
                                              colors: [const Color(0xFFd94a17), const Color(0xFFf58b1f)],
                                              begin: Alignment.centerLeft,
                                              end: Alignment.centerRight,
                                            )
                                          : null,
                                      // Inactive state: subtle dark background with border
                                      color: isActive ? null : Colors.black.withOpacity(0.6),
                                      border: Border.all(color: isActive ? Colors.transparent : Colors.white24),
                                      boxShadow: isActive
                                          ? [BoxShadow(color: const Color(0xFFd94a17).withOpacity(0.5), blurRadius: 18, offset: Offset(0, 6))]
                                          : null,
                                    ),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white, fontSize: 15)),
                                        // Counter badge on right
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(999),
                                            color: isActive ? Colors.white.withOpacity(0.2) : Colors.black.withOpacity(0.4),
                                          ),
                                          child: Text(counter, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
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

                    // Center preview area with comic cover
                    Expanded(
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 260,
                              height: 390,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(22),
                                boxShadow: [BoxShadow(color: Colors.black54, blurRadius: 30, offset: Offset(0, 20))],
                                border: Border.all(color: Colors.white12),
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(18),
                                child: selectedComic == null
                                    ? Container(color: Colors.grey[900])
                                    : Builder(builder: (context) {
                                        try {
                                          final abs = _workspaceThumbAbsolute(selectedComic.path);
                                          final f2 = File(abs);
                                          if (f2.existsSync()) return Image.file(f2, fit: BoxFit.cover);
                                        } catch (_) {}

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
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.black.withOpacity(0.6),
                                padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                                side: BorderSide(color: Colors.white24),
                              ),
                              child: const Text('(Triangle) Resume', style: TextStyle(color: Color(0xfff5e7d8), fontWeight: FontWeight.w600, letterSpacing: 1)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Bottom metadata bar with red progress line
              _buildBottomBar(selectedComic?.title ?? ''),
            ],
          ),
        ],
      ),
    );
  }



  /// Top header bar with thin bottom border
  Widget _buildHeaderBar(String title) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.7),
        border: Border(bottom: BorderSide(color: Colors.white12)),
      ),
      child: Center(
        child: Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1)),
      ),
    );
  }

  /// Bottom metadata bar with red progress line
  Widget _buildBottomBar(String title) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.7),
        border: Border(top: BorderSide(color: Colors.white12)),
      ),
      child: Column(
        children: [
          Text(title, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          // Red progress indicator line
          Container(
            height: 2,
            width: double.infinity,
            color: Colors.redAccent.withOpacity(0.8),
          ),
        ],
      ),
    );
  }

  String? _thumbForPath(String path) {
    final fileName = path.split('/').last;
    final slug = fileName.replaceAll(RegExp(r"\.cbz", caseSensitive: false), '').replaceAll(RegExp(r"[^a-z0-9]+", caseSensitive: false), '-').replaceAll(RegExp(r"^-+|-+"), '').toLowerCase();
    return 'assets/thumbs/$slug.jpg';
  }

  String _workspaceThumbAbsolute(String path) {
    final fileName = path.split('/').last;
    final slug = fileName.replaceAll(RegExp(r"\.cbz", caseSensitive: false), '').replaceAll(RegExp(r"[^a-z0-9]+", caseSensitive: false), '-').replaceAll(RegExp(r"^-+|-+"), '').toLowerCase();
    return '/home/rf80678/Documents/Projects/Web Development/Digital Comics/public/thumbs/$slug.jpg';
  }
}