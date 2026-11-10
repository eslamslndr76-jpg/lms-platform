import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/instructors/instructor_provider.dart';
import '../../core/models/instructor_model.dart';

/// شاشة تقييم الطلاب للمحاضر (المرحلة 12).
class InstructorEvaluationScreen extends StatefulWidget {
  final int groupId;
  const InstructorEvaluationScreen({super.key, required this.groupId});

  @override
  State<InstructorEvaluationScreen> createState() =>
      _InstructorEvaluationScreenState();
}

class _InstructorEvaluationScreenState extends State<InstructorEvaluationScreen> {
  InstructorEvaluation? _eval;
  bool _isLoading = true;
  String? _loadError;

  final Map<int, List<int?>> _scores = {};

  bool _isSaving = false;
  String? _saveError;
  Timer? _draftTimer;
  bool _submitted = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _draftTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _loadError = null;
    });
    try {
      final provider = context.read<InstructorProvider>();
      final eval = await provider.fetchEvaluation(widget.groupId);
      if (!mounted) return;
      if (eval == null) {
        setState(() {
          _loadError = provider.evalError ?? 'تعذر تحميل نموذج التقييم';
          _isLoading = false;
        });
        return;
      }
      setState(() {
        _eval = eval;
        _submitted = eval.isSubmitted;
        for (final s in eval.students) {
          _scores[s.id] = List<int?>.from(s.scores);
        }
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _loadError = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  int get _questionCount => _eval?.questions.length ?? 0;

  void _setScore(int studentId, int questionIndex, int? value) {
    final current = _scores[studentId] ?? List.filled(_questionCount, null);
    current[questionIndex] = value;
    _scores[studentId] = current;
    _scheduleDraftSave();
  }

  bool get _allComplete {
    final eval = _eval;
    if (eval == null) return false;
    for (final s in eval.students) {
      final scores = _scores[s.id] ?? List.filled(_questionCount, null);
      if (scores.any((v) => v == null)) return false;
    }
    return true;
  }

  int get _completedCount {
    final eval = _eval;
    if (eval == null) return 0;
    int count = 0;
    for (final s in eval.students) {
      final scores = _scores[s.id] ?? List.filled(_questionCount, null);
      if (!scores.any((v) => v == null)) count++;
    }
    return count;
  }

  void _scheduleDraftSave() {
    _draftTimer?.cancel();
    _draftTimer = Timer(const Duration(milliseconds: 1000), _saveDraft);
  }

  Future<void> _saveDraft() async {
    if (_eval == null || _submitted) return;
    setState(() => _isSaving = true);
    try {
      final success =
          await context.read<InstructorProvider>().saveEvaluationDraft(
                widget.groupId,
                Map<int, List<int?>>.from(_scores),
              );
      if (!mounted) return;
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('تم حفظ المسودة'), duration: Duration(seconds: 2)),
        );
      }
    } catch (_) {
      // المسودة غير حرجة
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _submit() async {
    if (!_allComplete) {
      setState(() => _saveError = 'يرجى تقييم جميع الطلاب قبل الإرسال');
      return;
    }
    setState(() {
      _isSaving = true;
      _saveError = null;
    });
    try {
      final success =
          await context.read<InstructorProvider>().submitEvaluation(
                widget.groupId,
                Map<int, List<int?>>.from(_scores),
              );
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        if (success) _submitted = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _saveError = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final eval = _eval;

    return Scaffold(
      appBar: AppBar(
        title: Text(eval?.group.name ?? 'تقييم الطلاب'),
        actions: [
          if (_isSaving)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Center(
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
              ? _ErrorView(message: _loadError!, onRetry: _load)
              : _submitted && eval != null
                  ? _SubmittedView(eval: eval)
                  : eval == null
                      ? const Center(child: Text('لا توجد بيانات تقييم'))
                      : _buildForm(context, eval),
    );
  }

  Widget _buildForm(BuildContext context, InstructorEvaluation eval) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          color: cs.surfaceContainerLow,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(eval.group.courseTitle,
                            style: tt.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 4),
                        Text('المجموعة: ${eval.group.name}',
                            style: tt.bodySmall
                                ?.copyWith(color: cs.onSurfaceVariant)),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '$_completedCount من ${eval.studentsCount}',
                      style: const TextStyle(
                        color: Colors.green,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
              if (eval.scale.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 12,
                  runSpacing: 4,
                  children: [
                    for (final s in eval.scale)
                      Text(
                        '${s.value} = ${s.label}',
                        style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                      ),
                  ],
                ),
              ],
              if (_saveError != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  color: cs.errorContainer,
                  child: Text(_saveError!,
                      style: TextStyle(
                          color: cs.onErrorContainer, fontSize: 13)),
                ),
              ],
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: eval.students.length,
              itemBuilder: (context, index) {
                final student = eval.students[index];
                return _StudentCard(
                  student: student,
                  scores:
                      _scores[student.id] ?? List.filled(_questionCount, null),
                  questions: eval.questions,
                  onScoreChanged: (qIndex, value) =>
                      _setScore(student.id, qIndex, value),
                );
              },
            ),
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            color: cs.surface,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'تم تقييم $_completedCount من ${eval.studentsCount} متدرباً',
                      style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                    ),
                    FilledButton.icon(
                      onPressed: (_allComplete && !_isSaving) ? _submit : null,
                      icon: _isSaving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.send_rounded, size: 18),
                      label:
                          Text(_isSaving ? 'جارٍ الإرسال...' : 'إرسال التقييم'),
                      style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(48)),
                    ),
                  ],
                ),
                if (!_allComplete) ...[
                  const SizedBox(height: 8),
                  Text('يجب تقييم جميع الطلاب قبل الإرسال.',
                      style: tt.bodySmall
                          ?.copyWith(color: cs.onSurfaceVariant)),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _StudentCard extends StatelessWidget {
  final EvalStudentScore student;
  final List<int?> scores;
  final List<EvalQuestion> questions;
  final void Function(int questionIndex, int? value) onScoreChanged;

  const _StudentCard({
    required this.student,
    required this.scores,
    required this.questions,
    required this.onScoreChanged,
  });

  bool get _complete => scores.every((v) => v != null);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Card(
      elevation: 0,
      color: cs.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(student.name,
                          style: tt.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text(
                        _complete ? 'تم التقييم' : 'لم يتم التقييم بعد',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: _complete
                              ? Colors.green.shade700
                              : cs.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                if (_complete)
                  const Icon(Icons.check_circle,
                      color: Colors.green, size: 20),
              ],
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (int i = 0; i < questions.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${i + 1}. ${questions[i].label}',
                            style: tt.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Row(
                          children: List.generate(5, (v) {
                            final value = v + 1;
                            return Expanded(
                              child: _ScaleButton(
                                value: value,
                                selected: scores[i] == value,
                                onTap: () => onScoreChanged(i, value),
                              ),
                            );
                          }),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ScaleButton extends StatelessWidget {
  final int value;
  final bool selected;
  final VoidCallback onTap;

  const _ScaleButton({
    required this.value,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? cs.primary : cs.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? cs.primary : cs.outlineVariant,
            width: selected ? 0 : 1,
          ),
        ),
        child: Text(
          '$value',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 15,
            color: selected ? cs.onPrimary : cs.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}

class _SubmittedView extends StatelessWidget {
  final InstructorEvaluation eval;
  const _SubmittedView({required this.eval});

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
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.15),
                  shape: BoxShape.circle),
              child: const Icon(Icons.check_circle_rounded,
                  size: 56, color: Colors.green),
            ),
            const SizedBox(height: 18),
            Text('تم إرسال التقييم!',
                style:
                    tt.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            Text(
              'تم تقييم ${eval.completedCount} من ${eval.studentsCount} متدرباً.',
              textAlign: TextAlign.center,
              style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
            ),
          ],
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
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, size: 56, color: cs.error),
            const SizedBox(height: 16),
            Text('تعذر تحميل التقييم',
                style: tt.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w800, color: cs.error)),
            const SizedBox(height: 8),
            Text(message,
                textAlign: TextAlign.center,
                style:
                    tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
            const SizedBox(height: 20),
            FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('إعادة المحاولة')),
          ],
        ),
      ),
    );
  }
}
