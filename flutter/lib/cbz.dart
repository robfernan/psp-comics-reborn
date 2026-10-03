import 'dart:io';
import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:flutter/services.dart' show rootBundle;

class Comic {
  final String path; // relative path like assets/name.cbz
  final String title;
  final String? thumbAsset; // path to thumbnail asset if available

  Comic({required this.path, required this.title, this.thumbAsset});
}

final Map<String, List<Uint8List>> _pagesCache = {};
final Map<String, Uint8List?> _coverCache = {};

String titleFromPath(String path) {
  final fileName = path.split('/').last;
  return fileName.replaceAll(RegExp(r"\.cbz", caseSensitive: false), '').replaceAll(RegExp(r"\.[^.]+"), '').trim();
}

Future<Uint8List?> _loadBytesForPath(String path) async {
  // Try reading from local file system first
  try {
    // Try path as provided (relative to flutter/), then try common locations
    final candidates = <String>[];
    candidates.add(path);

    // If path looks like assets/... try assets/raw/... (we symlinked originals to flutter/assets/raw)
    final parts = path.split('/');
    final base = parts.isNotEmpty ? parts.last : path;
    if (path.startsWith('assets/')) {
      candidates.add('assets/raw/$base');
      candidates.add('../assets/$base');
    }

    // Absolute workspace path (adjusted for this workspace)
    candidates.add('/home/rf80678/Documents/Digital Comics/${path.replaceAll(RegExp(r"^/+"), '')}');

    for (final cand in candidates) {
      try {
        final file = File(cand);
        if (await file.exists()) {
          // Debug: print which candidate we loaded
          print('CBZ: loading from file: $cand');
          return await file.readAsBytes();
        }
      } catch (_) {}
    }
  } catch (_) {}
  // Try package assets
  try {
    final data = await rootBundle.load(path);
    return data.buffer.asUint8List();
  } catch (_) {}

  print('CBZ: failed to find file for path: $path (checked candidates)');

  return null;
}

Future<List<Uint8List>> extractCbzPages(String assetPath) async {
  final cached = _pagesCache[assetPath];
  if (cached != null) return cached;

  final bytes = await _loadBytesForPath(assetPath);
  if (bytes == null) return [];

  try {
    final archive = ZipDecoder().decodeBytes(bytes);
    print('CBZ: archive entries count=${archive.length}');
    final images = <ArchiveFile>[];
    for (final file in archive) {
      try { print('CBZ: entry -> ${file.name} (isFile=${file.isFile})'); } catch (_) {}
      if (!file.isFile) continue;
      final name = file.name.toLowerCase();
      if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp')) {
        images.add(file);
      }
    }
    images.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));

    final pages = <Uint8List>[];
    for (final img in images) {
      pages.add(Uint8List.fromList(img.content as List<int>));
    }

    _pagesCache[assetPath] = pages;
    return pages;
  } catch (e) {
    print('CBZ: extract pages failed: $e');
    return [];
  }
}

Future<Uint8List?> extractCbzCover(String assetPath) async {
  if (_coverCache.containsKey(assetPath)) return _coverCache[assetPath];

  final bytes = await _loadBytesForPath(assetPath);
  if (bytes == null) return null;

  try {
    final archive = ZipDecoder().decodeBytes(bytes);
    final images = archive.where((f) {
      try { print('CBZ: cover entry -> ${f.name} (isFile=${f.isFile})'); } catch (_) {}
      if (!f.isFile) return false;
      final name = f.name.toLowerCase();
      return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
    }).toList();

    if (images.isEmpty) {
      _coverCache[assetPath] = null;
      return null;
    }

    images.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    final first = images.first;
    final data = Uint8List.fromList(first.content as List<int>);
    _coverCache[assetPath] = data;
    return data;
  } catch (_) {
    _coverCache[assetPath] = null;
    return null;
  }
}
