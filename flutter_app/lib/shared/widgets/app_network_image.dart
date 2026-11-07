import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

class AppNetworkImage extends StatelessWidget {
  final String? imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;

  const AppNetworkImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    Widget imageWidget;

    if (imageUrl != null && imageUrl!.startsWith('data:image')) {
      try {
        final bytes = Uri.dataFromString(imageUrl!).data!.contentAsBytes();
        imageWidget = Image.memory(
          bytes,
          width: width,
          height: height,
          fit: fit,
          errorBuilder: (_, __, ___) => _placeholder(cs),
        );
      } catch (_) {
        imageWidget = _placeholder(cs);
      }
    } else if (imageUrl != null && (imageUrl!.startsWith('http://') || imageUrl!.startsWith('https://'))) {
      imageWidget = CachedNetworkImage(
        imageUrl: imageUrl!,
        width: width,
        height: height,
        fit: fit,
        placeholder: (context, url) => _loadingPlaceholder(cs),
        errorWidget: (context, url, error) => _placeholder(cs),
      );
    } else {
      imageWidget = _placeholder(cs);
    }

    if (borderRadius != null) {
      return ClipRRect(
        borderRadius: borderRadius!,
        child: imageWidget,
      );
    }

    return imageWidget;
  }

  Widget _placeholder(ColorScheme cs) {
    return Container(
      width: width,
      height: height,
      color: cs.surfaceContainerHighest.withValues(alpha: 0.6),
      child: Center(
        child: Icon(
          Icons.school_rounded,
          size: (height != null && height! < 60) ? 24 : 40,
          color: cs.primary.withValues(alpha: 0.4),
        ),
      ),
    );
  }

  Widget _loadingPlaceholder(ColorScheme cs) {
    return Container(
      width: width,
      height: height,
      color: cs.surfaceContainerHighest.withValues(alpha: 0.3),
      child: Center(
        child: SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: cs.primary.withValues(alpha: 0.6),
          ),
        ),
      ),
    );
  }
}
