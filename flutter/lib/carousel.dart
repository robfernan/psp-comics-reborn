import 'dart:typed_data';
import 'dart:io';
import 'dart:ui';
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import 'cbz.dart';
import 'reader_page.dart';

class CarouselPage extends StatefulWidget {
  final List<Comic> comics;

  const CarouselPage({super.key, required this.comics});

  @override
  State<CarouselPage> createState() => _CarouselPageState();
}

class _CarouselPageState extends State<CarouselPage> {
  int activeIndex = 0;

  void _prev() {
    setState(() => activeIndex = (activeIndex - 1 + widget.comics.length) % widget.comics.length);
  }

  void _next() {
    setState(() => activeIndex = (activeIndex + 1) % widget.comics.length);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('All Comics')),
      body: RawKeyboardListener(
        focusNode: FocusNode()..requestFocus(),
        onKey: (evt) {
          if (evt is RawKeyDownEvent) {
            if (evt.logicalKey == LogicalKeyboardKey.arrowLeft) _prev();
            if (evt.logicalKey == LogicalKeyboardKey.arrowRight) _next();
            if (evt.logicalKey == LogicalKeyboardKey.enter) {
              final comic = widget.comics[activeIndex];
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReaderPage(cbzPath: comic.path, title: comic.title)));
            }
            if (evt.logicalKey == LogicalKeyboardKey.escape) Navigator.of(context).pop();
          }
        },
        child: LayoutBuilder(builder: (context, constraints) {
          final centerX = constraints.maxWidth / 2;
          final centerY = constraints.maxHeight / 2;

          return Stack(
            alignment: Alignment.center,
            children: widget.comics.asMap().entries.map((entry) {
              final idx = entry.key;
              final comic = entry.value;
              final distance = idx - activeIndex;
              final absDistance = distance.abs();
              final isActive = distance == 0;

              final scale = isActive ? 1.1 : (absDistance == 1 ? 0.9 : 0.75);
              final xOffset = distance * 240.0; // spacing

              return AnimatedPositioned(
                duration: const Duration(milliseconds: 300),
                left: centerX - 160 + xOffset,
                top: centerY - 220,
                width: 320,
                height: 480,
                child: Transform.scale(
                  scale: scale,
                  child: GestureDetector(
                    onTap: () {
                      setState(() => activeIndex = idx);
                      final comic = widget.comics[idx];
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReaderPage(cbzPath: comic.path, title: comic.title)));
                    },
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: isActive ? Colors.orangeAccent : Colors.white24),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.6), blurRadius: 30, offset: const Offset(0, 20))],
                        color: Colors.grey[900],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(18),
                        child: Builder(builder: (context) {
                          // prefer workspace thumb
                          try {
                            final abs = '/home/rf80678/Documents/Digital Comics/public/thumbs/${_slugFor(comic.path)}.jpg';
                            final f2 = File(abs);
                            if (f2.existsSync()) return Image.file(f2, fit: BoxFit.cover);
                          } catch (_) {}

                          if (comic.thumbAsset != null) {
                            try {
                              final f = File(comic.thumbAsset!);
                              if (f.existsSync()) return Image.file(f, fit: BoxFit.cover);
                            } catch (_) {}
                          }

                          return FutureBuilder<Uint8List?>(
                            future: extractCbzCover(comic.path),
                            builder: (context, snap) {
                              if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
                              if (snap.data != null) return Image.memory(snap.data!, fit: BoxFit.cover);
                              return Center(child: Text(comic.title, style: const TextStyle(color: Colors.white)));
                            },
                          );
                        }),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          );
        }),
      ),
    );
  }

  String _slugFor(String path) {
    final fileName = path.split('/').last;
    final slug = fileName.replaceAll(RegExp(r"\.cbz", caseSensitive: false), '').replaceAll(RegExp(r"[^a-z0-9]+", caseSensitive: false), '-').replaceAll(RegExp(r"^-+|-+"), '').toLowerCase();
    return slug;
  }
}
