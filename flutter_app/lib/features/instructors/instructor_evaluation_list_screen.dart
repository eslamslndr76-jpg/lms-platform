import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/instructors/instructor_provider.dart';
import '../../core/models/instructor_model.dart';
import 'instructor_evaluation_screen.dart';

/// تبويب "التقييم": المجموعات المنتهية وحالة تقييم طلابها.
class InstructorEvaluationListScreen extends StatefulWidget {
  const InstructorEvaluationListScreen({super.key});

  @override
  State<InstructorEvaluationListScreen> createState() =>
      _InstructorEvaluationListScreenState();
}

class _InstructorEvaluationListScreenState
    extends State<InstructorEvaluationListScreen> {
  @override
  void initState() {
    super.initState();
    // تبويب "مجموعاتي" يجلب القائمة عند فتح القشرة، فلا نكرر الطلب هنا.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<InstructorProvider>();
      if (provider.groups.isEmpty && !provider.groupsLoading && provider.groupsError == null) {
        provider.fetchGroups();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final provider = context.watch<InstructorProvider>();
    final groups = provider.groups.where((g) => g.isCompleted).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('التقييم')),
      body: RefreshIndicator(
        onRefresh: () => provider.fetchGroups(),
        child: provider.groupsLoading
            ? const Center(child: CircularProgressIndicator())
            : provider.groupsError != null
                ? _ErrorView(
                    message: provider.groupsError!,
                    onRetry: () => provider.fetchGroups(),
                  )
                : groups.isEmpty
                    ? const _EmptyView()
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: groups.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, i) => _EvalCard(
                          group: groups[i],
                          cs: cs,
                          tt: tt,
                          onOpen: () async {
                            final provider = context.read<InstructorProvider>();
                            await Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) =>
                                    InstructorEvaluationScreen(groupId: groups[i].id),
                              ),
                            );
                            provider.fetchGroups(silent: true);
                          },
                        ),
                      ),
      ),
    );
  }
}

class _EvalCard extends StatelessWidget {
  final InstructorGroup group;
  final ColorScheme cs;
  final TextTheme tt;
  final Future<void> Function() onOpen;

  const _EvalCard({
    required this.group,
    required this.cs,
    required this.tt,
    required this.onOpen,
  });

  @override
  Widget build(BuildContext context) {
    final submitted = group.evalSubmitted;
    final draft = group.evalStatus == 'draft';
    final statusColor =
        submitted ? Colors.green.shade700 : (draft ? Colors.orange.shade800 : cs.primary);
    final statusLabel = submitted
        ? 'تم الإرسال'
        : draft
            ? 'مسودة محفوظة'
            : 'لم يبدأ';

    return Card(
      elevation: 0,
      color: cs.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    group.name,
                    style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusLabel,
                    style: TextStyle(
                      color: statusColor,
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            if (group.courseTitle.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                group.courseTitle,
                style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
              ),
            ],
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Icons.school_outlined, size: 16, color: cs.onSurfaceVariant),
                const SizedBox(width: 6),
                Text(
                  '${group.studentsCount} متدرب',
                  style: tt.labelSmall?.copyWith(color: cs.onSurfaceVariant),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (submitted)
              Row(
                children: [
                  Icon(Icons.verified_rounded, size: 18, color: cs.onSurfaceVariant),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'أُرسل التقييم نهائياً ولا يمكن تعديله.',
                      style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                    ),
                  ),
                ],
              )
            else
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: onOpen,
                  icon: const Icon(Icons.assignment_rounded, size: 18),
                  label: Text(draft ? 'متابعة التقييم' : 'ابدأ التقييم'),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: cs.primaryContainer.withValues(alpha: 0.3),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.assignment_outlined, size: 56, color: cs.primary),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'لا توجد مجموعات منتهية',
                    style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'يُفتح تقييم الطلاب بعد إنهاء المجموعة من إدارة المنصة.',
                    textAlign: TextAlign.center,
                    style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded, size: 56, color: cs.error),
            const SizedBox(height: 16),
            Text(
              'تعذر تحميل المجموعات',
              style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: cs.error),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('إعادة المحاولة'),
            ),
          ],
        ),
      ),
    );
  }
}
