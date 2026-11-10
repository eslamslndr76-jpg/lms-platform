import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/surveys/surveys_provider.dart';
import '../../core/models/survey_model.dart';

/// Post-course survey screen: every item defined by the API, step by step,
/// with auto-saved drafts and a single final submission.
class SurveyScreen extends StatefulWidget {
  final int groupId;
  const SurveyScreen({super.key, required this.groupId});

  @override
  State<SurveyScreen> createState() => _SurveyScreenState();
}

class _SurveyScreenState extends State<SurveyScreen> {
  Survey? _survey;
  bool _isLoading = true;
  String? _loadError;

  final Map<String, dynamic> _answers = {};
  final TextEditingController _notesCtrl = TextEditingController();
  bool _isAnonymous = false;

  int _step = 0; // 0..N-1 = sections, N = helped+notes, N+1 = review
  bool _isSubmitting = false;
  bool _isSavingDraft = false;
  String? _submitError;
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
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _loadError = null;
    });
    try {
      final survey =
          await context.read<SurveysProvider>().fetchSurvey(widget.groupId);
      if (!mounted) return;
      final saved = survey.response;
      setState(() {
        _survey = survey;
        _submitted = saved?.status == 'submitted';
        if (saved != null) {
          _answers.addAll(saved.answers);
          _isAnonymous = saved.isAnonymous;
          final notes = saved.answers['notes'];
          if (notes is String) _notesCtrl.text = notes;
          final maxStep = survey.sections.length + 1;
          _step = saved.currentStep.clamp(0, maxStep);
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

  int get _totalSteps => (_survey?.sections.length ?? 0) + 2; // sections + helped + review

  void _scheduleDraftSave() {
    _draftTimer?.cancel();
    _draftTimer = Timer(const Duration(milliseconds: 900), _saveDraft);
  }

  Future<void> _saveDraft() async {
    if (_survey == null || _submitted || !_survey!.canEdit) return;
    setState(() => _isSavingDraft = true);
    try {
      final payload = Map<String, dynamic>.from(_answers);
      if (_notesCtrl.text.trim().isNotEmpty) {
        payload['notes'] = _notesCtrl.text.trim();
      }
      await context.read<SurveysProvider>().saveDraft(
            groupId: widget.groupId,
            answers: payload,
            isAnonymous: _isAnonymous,
            currentStep: _step,
          );
    } catch (_) {
      // Draft save failures are non-fatal; the submit path surfaces errors.
    } finally {
      if (mounted) setState(() => _isSavingDraft = false);
    }
  }

  void _setAnswer(String key, dynamic value) {
    setState(() => _answers[key] = value);
    _scheduleDraftSave();
  }

  bool get _allRatedAnswered {
    final s = _survey;
    if (s == null) return false;
    for (final key in s.allItemKeys) {
      final v = _answers[key];
      if (v is! int) return false;
    }
    return true;
  }

  bool get _helpedAnswered {
    final v = _answers['helped_develop'];
    return v == 'yes' || v == 'no';
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _submitError = null;
    });
    try {
      final payload = Map<String, dynamic>.from(_answers);
      if (_notesCtrl.text.trim().isNotEmpty) {
        payload['notes'] = _notesCtrl.text.trim();
      }
      await context.read<SurveysProvider>().submit(
            groupId: widget.groupId,
            answers: payload,
            isAnonymous: _isAnonymous,
          );
      if (!mounted) return;
      setState(() {
        _submitted = true;
        _isSubmitting = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _submitError = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('استبيان تقييم الدورة'),
        actions: [
          if (_isSavingDraft)
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
              : _submitted
                  ? _ThankYouView(survey: _survey!)
                  : !_survey!.canEdit
                      ? _NotAvailableView(survey: _survey!)
                      : _buildForm(cs),
    );
  }

  Widget _buildForm(ColorScheme cs) {
    final survey = _survey!;
    final isReview = _step == survey.sections.length + 1;

    return Column(
      children: [
        _ProgressHeader(
          survey: survey,
          step: _step,
          totalSteps: _totalSteps,
        ),
        if (_submitError != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: cs.errorContainer,
            child: Text(
              _submitError!,
              style: TextStyle(color: cs.onErrorContainer, fontSize: 13),
              textAlign: TextAlign.center,
            ),
          ),
        Expanded(child: _buildStepBody(survey, isReview)),
        _buildBottomBar(survey, isReview),
      ],
    );
  }

  Widget _buildStepBody(Survey survey, bool isReview) {
    if (isReview) return _ReviewStep(survey: survey, answers: _answers, notes: _notesCtrl.text);
    if (_step < survey.sections.length) return _SectionStep(section: survey.sections[_step], answers: _answers, onAnswer: _setAnswer);
    return _FinalStep(survey: survey, answers: _answers, onAnswer: _setAnswer, notesCtrl: _notesCtrl, onNotesChanged: _scheduleDraftSave, isAnonymous: _isAnonymous);
  }

  Widget _buildBottomBar(Survey survey, bool isReview) {
    final cs = Theme.of(context).colorScheme;
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(
          color: cs.surface,
          border: Border(top: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4))),
        ),
        child: Row(
          children: [
            if (_step > 0)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => setState(() => _step--),
                  icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                  label: const Text('السابق'),
                ),
              ),
            if (_step > 0) const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: isReview
                  ? FilledButton.icon(
                      onPressed: (_allRatedAnswered && _helpedAnswered && !_isSubmitting) ? _submit : null,
                      icon: _isSubmitting
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.send_rounded, size: 18),
                      label: Text(_isSubmitting ? 'جارٍ الإرسال...' : 'إرسال الاستبيان'),
                    )
                  : FilledButton.icon(
                      onPressed: _canAdvance() ? () => setState(() => _step++) : null,
                      icon: const Icon(Icons.arrow_back_rounded, size: 18),
                      label: const Text('التالي'),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  bool _canAdvance() {
    final survey = _survey!;
    if (_step < survey.sections.length) {
      final section = survey.sections[_step];
      return section.items.every((item) => _answers[item.key] is int);
    }
    // Final step: requires all rated items + helped answer
    return _allRatedAnswered && _helpedAnswered;
  }
}

// ── Header with progress ────────────────────────────────────────────────
class _ProgressHeader extends StatelessWidget {
  final Survey survey;
  final int step;
  final int totalSteps;
  const _ProgressHeader({required this.survey, required this.step, required this.totalSteps});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final progress = (step + 1) / totalSteps;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
      color: cs.surfaceContainerLow,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Auto-shown course / student / date info (never asked from the student)
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      survey.group.courseTitle.isNotEmpty ? survey.group.courseTitle : survey.group.name,
                      style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        if (survey.studentName.isNotEmpty) survey.studentName,
                        if (survey.group.instructorName != null && survey.group.instructorName!.isNotEmpty)
                          'مقدم الدورة: ${survey.group.instructorName}',
                        if (survey.group.placeName != null && survey.group.placeName!.isNotEmpty)
                          survey.group.placeName!,
                      ].join(' · '),
                      style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              if (survey.daysLeft > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: cs.primaryContainer,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'متبقي ${survey.daysLeft} يوم',
                    style: tt.labelSmall?.copyWith(color: cs.onPrimaryContainer, fontWeight: FontWeight.w700),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(value: progress, minHeight: 7),
          ),
          const SizedBox(height: 6),
          Text(
            'الخطوة ${step + 1} من $totalSteps',
            style: tt.labelSmall?.copyWith(color: cs.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

// ── One section with 1..5 scale per item ────────────────────────────────
class _SectionStep extends StatelessWidget {
  final SurveySection section;
  final Map<String, dynamic> answers;
  final void Function(String key, dynamic value) onAnswer;
  const _SectionStep({required this.section, required this.answers, required this.onAnswer});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: section.items.length + 1,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        if (index == 0) return _SectionTitle(title: section.title);
        final item = section.items[index - 1];
        return _ScaleQuestion(
          label: item.label,
          index: index,
          selected: answers[item.key] as int?,
          onSelect: (v) => onAnswer(item.key, v),
        );
      },
    );
  }
}

// ── Final step: helped question + notes ─────────────────────────────────
class _FinalStep extends StatelessWidget {
  final Survey survey;
  final Map<String, dynamic> answers;
  final void Function(String key, dynamic value) onAnswer;
  final TextEditingController notesCtrl;
  final VoidCallback onNotesChanged;
  final bool isAnonymous;
  const _FinalStep({
    required this.survey,
    required this.answers,
    required this.onAnswer,
    required this.notesCtrl,
    required this.onNotesChanged,
    required this.isAnonymous,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final helped = answers['helped_develop'];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _SectionTitle(title: survey.notesLabel),
        Card(
          elevation: 0,
          color: cs.surfaceContainerLow,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  survey.helped.label,
                  style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _YesNoButton(
                        label: 'نعم',
                        selected: helped == 'yes',
                        onTap: () => onAnswer('helped_develop', 'yes'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _YesNoButton(
                        label: 'لا',
                        selected: helped == 'no',
                        onTap: () => onAnswer('helped_develop', 'no'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'ملاحظات إضافية (اختياري)',
          style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: notesCtrl,
          maxLines: 5,
          maxLength: 4000,
          onChanged: (_) => onNotesChanged(),
          decoration: const InputDecoration(
            hintText: 'اكتب اقتراحاتك أو ملاحظاتك هنا...',
            border: OutlineInputBorder(),
            alignLabelWithHint: true,
          ),
        ),
      ],
    );
  }
}

// ── Review step ─────────────────────────────────────────────────────────
class _ReviewStep extends StatelessWidget {
  final Survey survey;
  final Map<String, dynamic> answers;
  final String notes;
  const _ReviewStep({required this.survey, required this.answers, required this.notes});

  String _labelFor(int? value) {
    if (value == null) return '—';
    for (final s in survey.scale) {
      if (s.value == value) return s.label;
    }
    return '$value';
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'مراجعة إجاباتك',
          style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        Text(
          'تأكد من إجاباتك — بعد الإرسال لا يمكن التعديل.',
          style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        for (final section in survey.sections) ...[
          Text(
            section.title,
            style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: cs.primary),
          ),
          const SizedBox(height: 8),
          for (final item in section.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: Text(item.label, style: tt.bodySmall)),
                  const SizedBox(width: 8),
                  Text(
                    _labelFor(answers[item.key] as int?),
                    style: tt.bodySmall?.copyWith(fontWeight: FontWeight.w800, color: cs.primary),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 8),
        ],
        Text(
          survey.helped.label,
          style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: cs.primary),
        ),
        const SizedBox(height: 6),
        Text(
          answers['helped_develop'] == 'yes' ? 'نعم' : answers['helped_develop'] == 'no' ? 'لا' : '—',
          style: tt.bodySmall?.copyWith(fontWeight: FontWeight.w800),
        ),
        if (notes.trim().isNotEmpty) ...[
          const SizedBox(height: 14),
          Text('ملاحظاتك', style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: cs.primary)),
          const SizedBox(height: 6),
          Text(notes, style: tt.bodySmall),
        ],
      ],
    );
  }
}

// ── Shared widgets ──────────────────────────────────────────────────────
class _SectionTitle extends StatelessWidget {
  final String title;
  const _SectionTitle({required this.title});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text(
        title,
        style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900, color: cs.primary),
      ),
    );
  }
}

class _ScaleQuestion extends StatelessWidget {
  final String label;
  final int index;
  final int? selected;
  final void Function(int value) onSelect;
  const _ScaleQuestion({
    required this.label,
    required this.index,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Card(
      elevation: 0,
      color: cs.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '$index. $label',
              style: tt.bodyMedium?.copyWith(fontWeight: FontWeight.w700, height: 1.4),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                for (int v = 1; v <= 5; v++) ...[
                  Expanded(
                    child: _ScaleButton(
                      value: v,
                      selected: selected == v,
                      onTap: () => onSelect(v),
                    ),
                  ),
                  if (v < 5) const SizedBox(width: 6),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ScaleButton extends StatelessWidget {
  final int value;
  final bool selected;
  final VoidCallback onTap;
  const _ScaleButton({required this.value, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 42,
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
            fontSize: 16,
            color: selected ? cs.onPrimary : cs.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}

class _YesNoButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _YesNoButton({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 46,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? cs.primary : cs.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? cs.primary : cs.outlineVariant),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: selected ? cs.onPrimary : cs.onSurface,
          ),
        ),
      ),
    );
  }
}

class _ThankYouView extends StatelessWidget {
  final Survey survey;
  const _ThankYouView({required this.survey});

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
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(color: cs.primaryContainer, shape: BoxShape.circle),
              child: Icon(Icons.celebration_rounded, size: 56, color: cs.onPrimaryContainer),
            ),
            const SizedBox(height: 18),
            Text('شكراً لك!', style: tt.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            Text(
              'تم إرسال إجاباتك بنجاح. رأيك يساعدنا على تحسين برامجنا التدريبية.',
              textAlign: TextAlign.center,
              style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotAvailableView extends StatelessWidget {
  final Survey survey;
  const _NotAvailableView({required this.survey});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    final (title, message) = switch (survey.status) {
      'not_open' => ('الاستبيان غير متاح بعد', 'يُفتح الاستبيان بعد انتهاء المجموعة التدريبية.'),
      'closed' => ('انتهت مدة الاستبيان', 'أُغلق هذا الاستبيان بعد انتهاء مدة الإجابة المحددة.'),
      _ => ('الاستبيان غير متاح', 'لا يمكن الإجابة على هذا الاستبيان حالياً.'),
    };

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(color: cs.surfaceContainerHigh, shape: BoxShape.circle),
              child: Icon(Icons.lock_clock_rounded, size: 56, color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 18),
            Text(title, style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            Text(
              message,
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
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded, size: 56, color: cs.error),
            const SizedBox(height: 16),
            Text('تعذر تحميل الاستبيان', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: cs.error)),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center, style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
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
