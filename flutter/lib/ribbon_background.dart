import 'dart:math';
import 'package:flutter/material.dart';

class RibbonBackground extends StatefulWidget {
  const RibbonBackground({super.key});

  @override
  State<RibbonBackground> createState() => _RibbonBackgroundState();
}

class _RibbonBackgroundState extends State<RibbonBackground> with SingleTickerProviderStateMixin {
  late AnimationController controller;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 6),
    )..repeat();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        return CustomPaint(
          painter: RibbonPainter(t: controller.value),
          size: Size.infinite,
        );
      },
    );
  }
}

class RibbonPainter extends CustomPainter {
  final double t;

  RibbonPainter({required this.t});

  @override
  void paint(Canvas canvas, Size size) {
    // Dark base — mostly black like the real PSP
    canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xFF0a0a0a));

    // Draw subtle ribbon waves only in corners/edges (like real PSP)
    final speed = t * 2 * pi;

    // Top-left corner ribbon
    _drawCornerRibbon(canvas, size, Alignment.topLeft, speed);
    // Top-right corner ribbon
    _drawCornerRibbon(canvas, size, Alignment.topRight, -speed);
    // Bottom-left corner ribbon
    _drawCornerRibbon(canvas, size, Alignment.bottomLeft, -speed * 0.8);
    // Bottom-right corner ribbon
    _drawCornerRibbon(canvas, size, Alignment.bottomRight, speed * 0.9);
  }

  void _drawCornerRibbon(Canvas canvas, Size size, Alignment alignment, double phase) {
    final isTop = alignment.y < 0;
    final isLeft = alignment.x < 0;

    // Ribbon parameters — subtle and soft like PSP
    final amplitude = 25.0;
    final frequency = 0.015;
    final ribbonLength = size.width * 0.4;

    // Calculate starting position based on corner
    double startX, startY;
    if (isLeft) {
      startX = 0;
    } else {
      startX = size.width - ribbonLength;
    }
    if (isTop) {
      startY = 0;
    } else {
      startY = size.height - 60;
    }

    // Create path for the ribbon wave
    Path path = Path();
    path.moveTo(startX, startY + 30);

    for (double x = 0; x <= ribbonLength; x += 4) {
      final actualX = startX + (isLeft ? x : -x);
      final y = startY + 30 + sin(x * frequency + phase) * amplitude;
      path.lineTo(actualX, y);
    }

    // Draw with soft glow — PSP uses subtle orange/red tones
    final ribbonColor = Color.lerp(
      const Color(0xFF78140f),
      const Color(0xFFd94a17),
      sin(phase) * 0.5 + 0.5,
    )!;

    // Outer glow (very soft)
    Paint glowPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 12.0
      ..color = ribbonColor.withOpacity(0.15);
    canvas.drawPath(path, glowPaint);

    // Inner ribbon
    Paint paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0
      ..color = ribbonColor.withOpacity(0.6);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant RibbonPainter oldDelegate) {
    return true; // Always repaint for animation
  }
}