import 'package:flutter/material.dart';

/// Builds the scrollable body of [AppBottomSheet]; attach [ScrollController]
/// to the scrollable widget so drag-to-resize works.
///
/// - [AppBottomSheetSize.content]: the sheet scrolls the body itself, so the
///   body must **not** attach `scrollController` to its own scrollable.
/// - [AppBottomSheetSize.large]: the body owns the scrolling and must attach
///   `scrollController` to its scrollable (e.g. `ListView(controller: ...)`).
typedef AppBottomSheetBodyBuilder = Widget Function(
  BuildContext context,
  ScrollController scrollController,
);

/// How the shared bottom sheet sizes itself.
enum AppBottomSheetSize {
  /// Sheet fits its content (up to [AppBottomSheet.maxSize] of the available
  /// height); short content gets a short sheet with no empty space.
  content,

  /// Sheet opens partially and can be dragged up/down between [minSize] and
  /// [maxSize]; the body scrolls inside it.
  large,
}

/// Shared Material 3 bottom sheet with content-aware sizing.
///
/// - [AppBottomSheetSize.content] (default): height follows the content and is
///   re-laid out automatically when the content changes or the keyboard opens.
/// - [AppBottomSheetSize.large]: opens at [initialSize] (default 60%), can be
///   dragged up to [maxSize] (default 92%) or down to [minSize] (default 30%),
///   and the body scrolls inside.
/// - Tapping the scrim or the Android back button dismisses it.
/// - The keyboard lifts the sheet and never hides the focused field.
///
/// Usage:
///   AppBottomSheet.show(
///     context: context,
///     title: '...',
///     body: (context, scrollController) => ...,
///     actions: [FilledButton(...)],
///   );
class AppBottomSheet {
  AppBottomSheet._();

  /// Maximum fraction of the available height the sheet may occupy.
  static const double maxSize = 0.92;

  /// Minimum fraction used by [AppBottomSheetSize.large].
  static const double minSize = 0.3;

  /// Fraction the large sheet opens at by default.
  static const double initialSize = 0.6;

  static Future<T?> show<T>({
    required BuildContext context,
    required String title,
    String? subtitle,
    required AppBottomSheetBodyBuilder body,
    List<Widget>? actions,
    bool isDismissible = true,
    bool enableDrag = true,
    AppBottomSheetSize size = AppBottomSheetSize.content,
    double? initialSize,
    double? minSize,
    double? maxSize,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isDismissible: isDismissible,
      enableDrag: enableDrag,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        // Respect isDismissible for the Android back button / predictive back.
        return PopScope(
          canPop: isDismissible,
          child: _AppBottomSheetContent(
            title: title,
            subtitle: subtitle,
            body: body,
            actions: actions,
            size: size,
            initialSize: initialSize,
            minSize: minSize,
            maxSize: maxSize,
          ),
        );
      },
    );
  }
}

class _AppBottomSheetContent extends StatefulWidget {
  final String title;
  final String? subtitle;
  final AppBottomSheetBodyBuilder body;
  final List<Widget>? actions;
  final AppBottomSheetSize size;
  final double? initialSize;
  final double? minSize;
  final double? maxSize;

  const _AppBottomSheetContent({
    required this.title,
    this.subtitle,
    required this.body,
    this.actions,
    required this.size,
    this.initialSize,
    this.minSize,
    this.maxSize,
  });

  @override
  State<_AppBottomSheetContent> createState() => _AppBottomSheetContentState();
}

class _AppBottomSheetContentState extends State<_AppBottomSheetContent> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  double get _maxSize => (widget.maxSize ?? AppBottomSheet.maxSize).clamp(0.4, 1.0);
  double get _minSize => (widget.minSize ?? AppBottomSheet.minSize).clamp(0.1, _maxSize);
  double get _initialSize =>
      (widget.initialSize ?? AppBottomSheet.initialSize).clamp(_minSize, _maxSize);

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    // Keyboard-aware: the sheet sits above the keyboard and its height is
    // computed from the remaining space, so no field is covered.
    final keyboardInset = media.viewInsets.bottom;
    final availableHeight = media.size.height - keyboardInset;
    final isLarge = widget.size == AppBottomSheetSize.large;

    return Padding(
      padding: EdgeInsets.only(bottom: keyboardInset),
      child: isLarge
          ? SizedBox(
              height: availableHeight,
              child: DraggableScrollableSheet(
                initialChildSize: _initialSize,
                minChildSize: _minSize,
                maxChildSize: _maxSize,
                snap: true,
                snapSizes: _snapSizes,
                expand: false,
                shouldCloseOnMinExtent: false,
                builder: (context, scrollController) {
                  return _buildColumn(context, scrollController, expandedBody: true);
                },
              ),
            )
          : ConstrainedBox(
              constraints: BoxConstraints(maxHeight: availableHeight * _maxSize),
              child: _buildColumn(
                context,
                _scrollController,
                expandedBody: false,
                shrinkWrap: true,
              ),
            ),
    );
  }

  List<double> get _snapSizes {
    final stops = <double>{_initialSize}.where((s) => s > _minSize && s < _maxSize).toList();
    stops.sort();
    return stops;
  }

  /// [expandedBody] wraps the body in [Expanded] (large sheet, body scrolls
  /// itself); otherwise the body is wrapped in a shrink-wrapping scroll view so
  /// the sheet can size itself to its content.
  Widget _buildColumn(
    BuildContext context,
    ScrollController scrollController, {
    required bool expandedBody,
    bool shrinkWrap = false,
  }) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    final bodyWidget = widget.body(context, scrollController);

    return Column(
      mainAxisSize: shrinkWrap ? MainAxisSize.min : MainAxisSize.max,
      children: [
        // ── Fixed header (always visible) ───────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.title,
                style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                textAlign: TextAlign.center,
              ),
              if (widget.subtitle != null && widget.subtitle!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  widget.subtitle!,
                  style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 8),
              Divider(color: cs.outlineVariant.withValues(alpha: 0.5), height: 1),
            ],
          ),
        ),

        // ── Body ────────────────────────────────────────────────────────
        if (expandedBody)
          Expanded(child: bodyWidget)
        else
          Flexible(
            child: SingleChildScrollView(
              controller: scrollController,
              child: bodyWidget,
            ),
          ),

        // ── Fixed bottom action bar ─────────────────────────────────────
        if (widget.actions != null && widget.actions!.isNotEmpty)
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
              decoration: BoxDecoration(
                color: cs.surface,
                border: Border(
                  top: BorderSide(
                    color: cs.outlineVariant.withValues(alpha: 0.4),
                  ),
                ),
              ),
              child: Row(
                children: [
                  for (final a in widget.actions!) ...[
                    Expanded(child: a),
                    if (a != widget.actions!.last) const SizedBox(width: 10),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }
}
