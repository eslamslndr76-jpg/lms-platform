import 'package:flutter/material.dart';

/// Builds the scrollable body of [AppBottomSheet]; attach [ScrollController]
/// to the scrollable widget so drag-to-resize works.
typedef AppBottomSheetBodyBuilder = Widget Function(
  BuildContext context,
  ScrollController scrollController,
);

/// Shared Material 3 bottom sheet with drag-to-expand/collapse behavior.
///
/// - Opens at [initialSize] (default 40%) and snaps to 40% / 70% / 95%.
/// - Drag down below the initial snap to dismiss (plus barrier tap).
/// - Shows title + subtitle always visible at the top, scrollable body,
///   and an optional fixed bottom action bar.
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

  static const List<double> snapStops = [0.4, 0.7, 0.95];

  static Future<T?> show<T>({
    required BuildContext context,
    required String title,
    String? subtitle,
    required AppBottomSheetBodyBuilder body,
    List<Widget>? actions,
    bool isDismissible = true,
    bool enableDrag = true,
    double initialSize = 0.4,
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
            initialSize: initialSize,
          ),
        );
      },
    );
  }
}

class _AppBottomSheetContent extends StatelessWidget {
  final String title;
  final String? subtitle;
  final AppBottomSheetBodyBuilder body;
  final List<Widget>? actions;
  final double initialSize;

  const _AppBottomSheetContent({
    required this.title,
    this.subtitle,
    required this.body,
    this.actions,
    required this.initialSize,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final media = MediaQuery.of(context);
    // Keyboard-aware: the sheet is lifted above the keyboard and its snap
    // fractions are computed from the remaining height, so no field is covered.
    final keyboardInset = media.viewInsets.bottom;
    final availableHeight = media.size.height - keyboardInset;

    return Padding(
      padding: EdgeInsets.only(bottom: keyboardInset),
      child: SizedBox(
        height: availableHeight * 0.95,
        child: DraggableScrollableSheet(
            initialChildSize: initialSize,
            minChildSize: AppBottomSheet.snapStops.first,
            maxChildSize: AppBottomSheet.snapStops.last,
            snap: true,
            snapSizes: AppBottomSheet.snapStops.sublist(1),
            expand: false,
            builder: (context, scrollController) {
              return Column(
                children: [
                  // ── Fixed header (always visible even at 40%) ──────────
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          title,
                          style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                          textAlign: TextAlign.center,
                        ),
                        if (subtitle != null && subtitle!.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            subtitle!,
                            style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                            textAlign: TextAlign.center,
                          ),
                        ],
                        const SizedBox(height: 8),
                        Divider(color: cs.outlineVariant.withValues(alpha: 0.5), height: 1),
                      ],
                    ),
                  ),

                  // ── Scrollable body ─────────────────────────────────────
                  Expanded(
                    child: body(context, scrollController),
                  ),

                  // ── Fixed bottom action bar ─────────────────────────────
                  if (actions != null && actions!.isNotEmpty)
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
                            for (final a in actions!) ...[
                              Expanded(child: a),
                              if (a != actions!.last) const SizedBox(width: 10),
                            ],
                          ],
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      );
  }
}
