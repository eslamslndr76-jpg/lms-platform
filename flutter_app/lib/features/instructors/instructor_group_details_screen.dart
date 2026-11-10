import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/instructors/instructor_provider.dart';
import '../../core/models/instructor_model.dart';
import 'instructor_evaluation_screen.dart';

/// تفاصيل مجموعة المحاضر + زر التقييم إن كانت المجموعة منتهية.
class InstructorGroupDetailsScreen extends StatefulWidget {
  final int groupId;
  const InstructorGroupDetailsScreen({super.key, required this.groupId});

  @override
  State<InstructorGroupDetailsScreen> createState() =>
      _InstructorGroupDetailsScreenState();
}

class _InstructorGroupDetailsScreenState
    extends State<InstructorGroupDetailsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<InstructorProvider>();
      provider.fetchGroups();
      provider.fetchEvaluation(widget.groupId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final provider = context.watch<InstructorProvider>();

    final group = provider.groups.firstWhere(
      (g) => g.id == widget.groupId,
      orElse: () => InstructorGroup(
        id: widget.groupId,
        name: '',
        status: '',
        courseTitle: '',
        studentsCount: 0,
        lecturesCount: 0,
      ),
    );
    final eval = provider.evaluation;

    return Scaffold(
      appBar: AppBar(
        title: Text(group.name.isNotEmpty ? group.name : 'تفاصيل المجموعة'),
      ),
      body: provider.groupsLoading || provider.evalLoading
          ? const Center(child: CircularProgressIndicator())
          : provider.groupsError != null || provider.evalError != null
              ? _ErrorView(
                  message: provider.groupsError ?? provider.evalError!,
                  onRetry: () {
                    provider.fetchGroups();
                    provider.fetchEvaluation(widget.groupId);
                  },
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // معلومات المجموعة
                    Card(
                      color: cs.surfaceContainerLow,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(group.name,
                                style: tt.headlineSmall?.copyWith(
                                    fontWeight: FontWeight.w900)),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: group.isCompleted
                                        ? Colors.green
                                            .shade700
                                            .withValues(alpha: 0.15)
                                        : cs.primary.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    group.statusLabelAr,
                                    style: TextStyle(
                                      color: group.isCompleted
                                          ? Colors.green.shade700
                                          : cs.primary,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            if (group.courseTitle.isNotEmpty) ...[
                              Row(
                                children: [
                                  Icon(Icons.menu_book_outlined,
                                      size: 18, color: cs.primary),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      'الكورس: ${group.courseTitle}',
                                      style: tt.bodyMedium
                                          ?.copyWith(fontWeight: FontWeight.w700),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                            ],
                            Row(
                              children: [
                                Icon(Icons.school_outlined,
                                    size: 16, color: cs.onSurfaceVariant),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                      'المتدربون: ${group.studentsCount}',
                                      style: tt.bodySmall
                                          ?.copyWith(color: cs.onSurfaceVariant)),
                                ),
                                const SizedBox(width: 14),
                                Icon(Icons.play_circle_outlined,
                                    size: 16, color: cs.onSurfaceVariant),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                      'المحاضرات: ${group.lecturesCount}',
                                      style: tt.bodySmall
                                          ?.copyWith(color: cs.onSurfaceVariant)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            if (eval != null &&
                                eval.completedCount > 0) ...[
                              Row(
                                children: [
                                  Icon(Icons.check_circle_outlined,
                                      size: 16,
                                      color: Colors.green.shade700),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      'تم تقييم ${eval.completedCount} من ${eval.studentsCount} متدرباً',
                                      style: tt.bodySmall
                                          ?.copyWith(color: cs.onSurfaceVariant),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    // بيانات الجدول (تاريخ البدء · المكان · نمط الدراسة)
                    if (eval != null &&
                        (eval.startDate.isNotEmpty ||
                            eval.placeName.isNotEmpty ||
                            eval.courseMode.isNotEmpty)) ...[
                      Card(
                        color: cs.surfaceContainerLow,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('الجدول',
                                  style: tt.titleSmall?.copyWith(
                                      fontWeight: FontWeight.w800)),
                              const SizedBox(height: 10),
                              if (eval.startDate.isNotEmpty)
                                _InfoRow(
                                  icon: Icons.event_outlined,
                                  label: 'تاريخ البدء',
                                  value: eval.startDate.length >= 10
                                      ? eval.startDate.substring(0, 10)
                                      : eval.startDate,
                                ),
                              if (eval.courseMode.isNotEmpty)
                                _InfoRow(
                                  icon: Icons.laptop_mac_outlined,
                                  label: 'نمط الدراسة',
                                  value: eval.courseModeLabelAr,
                                ),
                              if (eval.placeName.isNotEmpty)
                                _InfoRow(
                                  icon: Icons.place_outlined,
                                  label: 'المكان',
                                  value: eval.placeName,
                                ),
                              if (eval.instructorName.isNotEmpty)
                                _InfoRow(
                                  icon: Icons.person_outline,
                                  label: 'المحاضر',
                                  value: eval.instructorName,
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    // طلاب المجموعة
                    if (eval != null && eval.students.isNotEmpty) ...[
                      Card(
                        color: cs.surfaceContainerLow,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                              child: Row(
                                children: [
                                  Icon(Icons.groups_outlined,
                                      size: 18, color: cs.primary),
                                  const SizedBox(width: 6),
                                  Text(
                                    'طلاب المجموعة (${eval.students.length})',
                                    style: tt.titleSmall
                                        ?.copyWith(fontWeight: FontWeight.w800),
                                  ),
                                ],
                              ),
                            ),
                            const Divider(height: 1),
                            for (final student in eval.students)
                              ListTile(
                                dense: true,
                                leading: CircleAvatar(
                                  radius: 16,
                                  backgroundColor:
                                      cs.primaryContainer.withValues(alpha: 0.5),
                                  child: Text(
                                    student.name.trim().isNotEmpty
                                        ? student.name.trim().characters.first
                                        : '؟',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      color: cs.onPrimaryContainer,
                                    ),
                                  ),
                                ),
                                title: Text(student.name),
                                trailing: student.complete
                                    ? Icon(Icons.check_circle_rounded,
                                        size: 18, color: Colors.green.shade700)
                                    : null,
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    // زر التقييم
                    if (group.canEvaluate &&
                        eval != null &&
                        !eval.isSubmitted) ...[
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) =>
                                  InstructorEvaluationScreen(
                                      groupId: group.id),
                            ),
                          ),
                          icon: const Icon(Icons.assignment_rounded),
                          label: const Text('ابدأ تقييم الطلاب'),
                          style: FilledButton.styleFrom(
                              minimumSize: const Size.fromHeight(50)),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (eval != null && eval.isSubmitted) ...[
                      Card(
                        color: Colors.green.withValues(alpha: 0.1),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle_rounded,
                                  color: Colors.green),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text('تم إرسال التقييم',
                                        style: tt.titleSmall
                                            ?.copyWith(
                                                fontWeight: FontWeight.w800,
                                                color: Colors.green.shade700)),
                                    const SizedBox(height: 4),
                                    Text('تم تقييم جميع الطلاب وإرسال التقييم نهائياً.',
                                        style: tt.bodySmall
                                            ?.copyWith(color: cs.onSurfaceVariant)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                    if (eval != null && eval.isNotOpen) ...[
                      Card(
                        color: cs.errorContainer.withValues(alpha: 0.1),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.lock_outline,
                                      color: cs.error),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text('التقييم غير متاح حالياً',
                                        style: tt.titleSmall
                                            ?.copyWith(
                                                fontWeight: FontWeight.w800,
                                                color: cs.error)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text('يتم فتح التقييم بعد إنهاء المجموعة.',
                                  style: tt.bodySmall
                                      ?.copyWith(color: cs.onSurfaceVariant)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                  ],
                ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: cs.onSurfaceVariant),
          const SizedBox(width: 8),
          Text(label,
              style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: tt.bodySmall?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
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
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline_rounded,
                  size: 56, color: cs.error),
              const SizedBox(height: 16),
              Text('تعذر تحميل البيانات',
                  style: tt.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800, color: cs.error)),
              const SizedBox(height: 8),
              Text(message,
                  textAlign: TextAlign.center,
                  style: tt.bodySmall
                      ?.copyWith(color: cs.onSurfaceVariant)),
              const SizedBox(height: 20),
              FilledButton.icon(onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('إعادة المحاولة')),
            ],
          ),
        ),
      );
  }
}
