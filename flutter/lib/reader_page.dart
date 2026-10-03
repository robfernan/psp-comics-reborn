import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'cbz.dart';

class ReaderPage extends StatefulWidget {
  final String cbzPath;
  final String title;

  const ReaderPage({super.key, required this.cbzPath, required this.title});

  @override
  State<ReaderPage> createState() => _ReaderPageState();
}

class _ReaderPageState extends State<ReaderPage> {
  List<Uint8List> pages = [];
  int pageIndex = 0;
  double scale = 1.0;
  Offset pan = Offset.zero;
  bool loading = true;
  bool showPageCounter = true;
  String readingDirection = 'ltr';
  String fitMode = 'contain';

  @override
  void initState() {
    super.initState();
    _loadOptions();
    _loadPages();
  }

  Future<void> _loadOptions() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      showPageCounter = prefs.getBool('reader.showPageCounter') ?? true;
      readingDirection = prefs.getString('reader.readingDirection') ?? 'ltr';
      fitMode = prefs.getString('reader.fitMode') ?? 'contain';
    });
  }

  Future<void> _loadPages() async {
    setState(() { loading = true; });
    final result = await extractCbzPages(widget.cbzPath);
    setState(() {
      pages = result;
      loading = false;
      pageIndex = 0;
    });
  }

  void _advance(int delta) {
    if (pages.isEmpty) return;
    setState(() {
      final maxIndex = pages.length - 1;
      // RTL reading direction reverses navigation
      final effectiveDelta = readingDirection == 'rtl' ? -delta : delta;
      pageIndex = (pageIndex + effectiveDelta).clamp(0, maxIndex);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isSpread = MediaQuery.of(context).size.width >= 1024 && pages.length > 1;

    // If there are no pages, show a friendly message instead of crashing.
    if (!loading && pages.isEmpty) {
      return Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(title: Text(widget.title)),
        body: Center(child: Text('No pages available.', style: TextStyle(color: Colors.white60))),
      );
    }

    final visiblePages = <Uint8List>[];
    if (isSpread) {
      if (pageIndex < pages.length) visiblePages.add(pages[pageIndex]);
      if (pageIndex + 1 < pages.length) visiblePages.add(pages[pageIndex + 1]);
    } else {
      if (pageIndex < pages.length) visiblePages.add(pages[pageIndex]);
    }

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          if (showPageCounter)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12.0),
              child: Center(child: Text('${pageIndex + 1} / ${pages.length}')),
            ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: Center(
                    child: InteractiveViewer(
                      transformationController: TransformationController(),
                      panEnabled: true,
                      scaleEnabled: true,
                      child: isSpread
                          ? Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: visiblePages.map((p) => Flexible(child: Image.memory(p, fit: fitMode == 'cover' ? BoxFit.cover : BoxFit.contain))).toList(),
                            )
                          : (visiblePages.isNotEmpty ? Image.memory(visiblePages.first, fit: fitMode == 'cover' ? BoxFit.cover : BoxFit.contain) : const SizedBox.shrink()),
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  color: Colors.black54,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ElevatedButton(onPressed: () => _advance(-1), child: const Text('Prev')),
                      const SizedBox(width: 8),
                      ElevatedButton(onPressed: () => setState(() => scale = 1.0), child: const Text('Reset')),
                      const SizedBox(width: 8),
                      ElevatedButton(onPressed: () => _advance(1), child: const Text('Next')),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
