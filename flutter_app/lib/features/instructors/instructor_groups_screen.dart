import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/instructors/instructor_provider.dart';
import '../../core/models/instructor_model.dart';
import 'instructor_group_details_screen.dart';
import 'instructor_evaluation_screen.dart';

/// شاشة مجموعات المحاضر (المرحلة 12).
/// يعرض مجموعات المحاضر فقط بحالتها (جارية/منتهية) مع أزرار الإجراء المتاحة.
class InstructorGroupsScreen extends StatefulWidget {
  const InstructorGroupsScreen({super.key});

  @override
  State<InstructorGroupsScreen> createState() => _InstructorGroupsScreenState();
}

class _InstructorGroupsScreenState extends State<InstructorGroupsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InstructorProvider>().fetchGroups();
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final provider = context.watch<InstructorProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('مجموعاتي')),
      body: RefreshIndicator(
        onRefresh: () => provider.fetchGroups(),
        child: provider.groupsLoading
            ? const Center(child: CircularProgressIndicator())
            : provider.groupsError != null
                ? _ErrorView(message: provider.groupsError!, onRetry: () => provider.fetchGroups())
                : provider.groups.isEmpty
                    ? const _EmptyView()
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: provider.groups.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, i) =>
                            _GroupCard(group: provider.groups[i], cs: cs, tt: tt),
                      ),
      ),
    );
  }
}

class _GroupCard extends StatelessWidget {
  final InstructorGroup group;
  final ColorScheme cs;
  final TextTheme tt;
  const _GroupCard({required this.group, required this.cs, required this.tt});

  @override
  Widget build(BuildContext context) {
    final isCompleted = group.isCompleted;
    final statusColor = isCompleted ? Colors.green.shade700 : cs.primary;

    return Card(
      elevation: 0,
      color: cs.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => InstructorGroupDetailsScreen(groupId: group.id),
            ),
          );
        },
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
                      group.statusLabelAr,
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
                  Text('${group.studentsCount} متدرب', style: tt.labelSmall?.copyWith(color: cs.onSurfaceVariant)),
                  const SizedBox(width: 14),
                  Icon(Icons.play_circle_outline, size: 16, color: cs.onSurfaceVariant),
                  const SizedBox(width: 6),
                  Text('${group.lecturesCount} محاضرة', style: tt.labelSmall?.copyWith(color: cs.onSurfaceVariant)),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: group.canEvaluate
                          ? () async {
                              final provider = context.read<InstructorProvider>();
                              await Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => InstructorEvaluationScreen(groupId: group.id),
                                ),
                              );
                              provider.fetchGroups(silent: true);
                            }
                          : null,
                      icon: const Icon(Icons.assignment_rounded, size: 18),
                      label: const Text('تقييم الطلاب'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: group.canEvaluate ? cs.primary : cs.onSurfaceVariant,
                        minimumSize: const Size.fromHeight(40),
                      ),
                    ),
                  ),
                  if (group.evalSubmitted) ...[
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.green.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'تم الإرسال',
                        style: TextStyle(
                          color: Colors.green,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
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
                    child: Icon(Icons.groups_outlined, size: 56, color: cs.primary),
                  ),
                  const SizedBox(height: 16),
                  Text('لا توجد مجموعات', style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text(
                    'ستظهر هنا المجموعات التي تُشرف عليها كمحاضر.',
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
            Text('تعذر تحميل المجموعات',
                style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: cs.error)),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center, style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
            const SizedBox(height: 20),
            FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded), label: const Text('إعادة المحاولة')),
          ],
        ),
      ),
    );
  }
}
