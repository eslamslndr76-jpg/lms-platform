import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/instructors/instructor_provider.dart';
import '../../core/models/instructor_model.dart';

/// شاشة مقترحات الكورسات للمحاضر (المرحلة 12).
class InstructorProposalsScreen extends StatefulWidget {
  const InstructorProposalsScreen({super.key});

  @override
  State<InstructorProposalsScreen> createState() => _InstructorProposalsScreenState();
}

class _InstructorProposalsScreenState extends State<InstructorProposalsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<InstructorProvider>().fetchProposals();
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final provider = context.watch<InstructorProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('مقترحاتي')),
      body: RefreshIndicator(
        onRefresh: () => provider.fetchProposals(),
        child: provider.proposalsLoading
            ? const Center(child: CircularProgressIndicator())
            : provider.proposalsError != null
                ? _ErrorView(
                    message: provider.proposalsError!,
                    onRetry: () => provider.fetchProposals(),
                  )
                : provider.proposals.isEmpty
                    ? const _EmptyView()
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: provider.proposals.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, i) =>
                            _ProposalCard(proposal: provider.proposals[i], cs: cs, tt: tt),
                      ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final provider = context.read<InstructorProvider>();
          await Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const InstructorProposalFormScreen(),
            ),
          );
          if (!mounted) return;
          provider.fetchProposals();
        },
        icon: const Icon(Icons.add_rounded),
        label: const Text('مقترح جديد'),
      ),
    );
  }
}

class _ProposalCard extends StatelessWidget {
  final InstructorProposal proposal;
  final ColorScheme cs;
  final TextTheme tt;
  const _ProposalCard({required this.proposal, required this.cs, required this.tt});

  (Color, IconData) get _statusStyle {
    switch (proposal.status) {
      case 'approved':
        return (Colors.green.shade700, Icons.check_circle_rounded);
      case 'rejected':
        return (cs.error, Icons.cancel_rounded);
      case 'submitted':
        return (Colors.orange.shade800, Icons.pending_rounded);
      case 'needs_changes':
        return (Colors.amber.shade800, Icons.edit_rounded);
      default:
        return (cs.primary, Icons.edit_rounded);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (color, icon) = _statusStyle;

    return Card(
      elevation: 0,
      color: cs.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () async {
          final provider = context.read<InstructorProvider>();
          final changed = await Navigator.of(context).push<bool>(
            MaterialPageRoute(
              builder: (_) => InstructorProposalDetailScreen(proposalId: proposal.id),
            ),
          );
          if (changed == true) provider.fetchProposals(silent: true);
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
                      proposal.courseTitle,
                      style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, size: 14, color: color),
                        const SizedBox(width: 6),
                        Text(
                          proposal.statusLabelAr,
                          style: TextStyle(
                            color: color,
                            fontWeight: FontWeight.w800,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (proposal.adminNote.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'ملاحظة الإدارة: ${proposal.adminNote}',
                    style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              if (proposal.objectives.isNotEmpty) ...[
                Text(
                  'الأهداف: ${proposal.objectives.take(2).join('، ')}'
                      '${proposal.objectives.length > 2 ? ' و ${proposal.objectives.length - 2} أخرى' : ''}',
                  style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant, height: 1.4),
                ),
              ],
              if (proposal.materialsUrl.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.link_outlined, size: 14, color: cs.primary),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        proposal.materialsUrl,
                        style: tt.bodySmall?.copyWith(color: cs.primary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
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
                    child: Icon(Icons.lightbulb_outline, size: 56, color: cs.primary),
                  ),
                  const SizedBox(height: 16),
                  Text('لا توجد مقترحات', style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text(
                    'ابدأ بإنشاء مقترح دورة تدريبية جديد.',
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
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, size: 56, color: cs.error),
            const SizedBox(height: 16),
            Text('تعذر تحميل المقترحات',
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

/// شاشة إنشاء/تعديل مقترح كورس.
class InstructorProposalFormScreen extends StatefulWidget {
  final InstructorProposal? proposal;
  const InstructorProposalFormScreen({super.key, this.proposal});

  @override
  State<InstructorProposalFormScreen> createState() => _InstructorProposalFormScreenState();
}

class _InstructorProposalFormScreenState extends State<InstructorProposalFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _materialsCtrl = TextEditingController();
  final List<TextEditingController> _objectiveCtrls = [];
  final List<Map<String, TextEditingController>> _dayCtrls = [];

  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.proposal != null) {
      final p = widget.proposal!;
      _titleCtrl.text = p.courseTitle;
      _materialsCtrl.text = p.materialsUrl;
      for (final obj in p.objectives) {
        _objectiveCtrls.add(TextEditingController(text: obj));
      }
      for (final day in p.dailyContent) {
        _dayCtrls.add({
          'day': TextEditingController(text: day.day),
          'topic': TextEditingController(text: day.topic),
          'instructor': TextEditingController(text: day.instructor),
        });
      }
    } else {
      _addObjective();
      _addDay();
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _materialsCtrl.dispose();
    for (final c in _objectiveCtrls) {
      c.dispose();
    }
    for (final m in _dayCtrls) {
      m['day']?.dispose();
      m['topic']?.dispose();
      m['instructor']?.dispose();
    }
    super.dispose();
  }

  void _addObjective() {
    setState(() => _objectiveCtrls.add(TextEditingController()));
  }

  void _removeObjective(int index) {
    setState(() {
      _objectiveCtrls[index].dispose();
      _objectiveCtrls.removeAt(index);
    });
  }

  void _addDay() {
    setState(() => _dayCtrls.add({
      'day': TextEditingController(),
      'topic': TextEditingController(),
      'instructor': TextEditingController(),
    }));
  }

  void _removeDay(int index) {
    setState(() {
      _dayCtrls[index]['day']?.dispose();
      _dayCtrls[index]['topic']?.dispose();
      _dayCtrls[index]['instructor']?.dispose();
      _dayCtrls.removeAt(index);
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_objectiveCtrls.any((c) => c.text.trim().isEmpty)) {
      setState(() => _error = 'يرجى إضافة هدف واحد على الأقل');
      return;
    }
    if (_dayCtrls.any((m) => m['topic']!.text.trim().isEmpty)) {
      setState(() => _error = 'يرجى إضافة موضوع علمي ليوم واحد على الأقل');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final provider = context.read<InstructorProvider>();
      final materials =
          _materialsCtrl.text.trim().isEmpty ? null : _materialsCtrl.text.trim();
      final objectives = _objectiveCtrls.map((c) => c.text.trim()).toList();
      final daily = _dayCtrls
          .map((m) => {
                'day': m['day']!.text.trim(),
                'topic': m['topic']!.text.trim(),
                'instructor': m['instructor']!.text.trim(),
              })
          .toList();

      final bool ok;
      if (widget.proposal == null) {
        final created = await provider.createProposal(
          courseTitle: _titleCtrl.text.trim(),
          objectives: objectives,
          dailyContent: daily,
          materialsUrl: materials,
        );
        ok = created != null;
      } else {
        ok = await provider.updateProposal(
          proposalId: widget.proposal!.id,
          courseTitle: _titleCtrl.text.trim(),
          objectives: objectives,
          dailyContent: daily,
          materialsUrl: materials,
        );
      }

      if (!mounted) return;
      if (ok) {
        Navigator.of(context).pop(true);
      } else {
        setState(() => _isLoading = false);
      }
    } on Exception catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final isEdit = widget.proposal != null;

    return Scaffold(
      appBar: AppBar(title: Text(isEdit ? 'تعديل المقترح' : 'مقترح جديد')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // اسم الدورة
                  TextFormField(
                    controller: _titleCtrl,
                    decoration: const InputDecoration(
                      labelText: 'اسم الدورة التدريبية',
                      hintText: 'مثال: مهارات الاتصال الفعال',
                      prefixIcon: Icon(Icons.title_outlined),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'مطلوب' : null,
                  ),
                  const SizedBox(height: 16),

                  // الأهداف
                  Text(
                    'أهداف الدورة',
                    style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  ..._objectiveCtrls.asMap().entries.map((entry) {
                    final i = entry.key;
                    final c = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: c,
                              decoration: InputDecoration(
                                hintText: 'هدف ${i + 1}',
                                border: const OutlineInputBorder(),
                                isDense: true,
                              ),
                              validator: (v) => (v == null || v.trim().isEmpty) ? 'مطلوب' : null,
                            ),
                          ),
                          const SizedBox(width: 8),
                          if (_objectiveCtrls.length > 1)
                            SizedBox(
                              width: 32,
                              height: 32,
                              child: IconButton(
                                onPressed: () => _removeObjective(i),
                                icon: Icon(Icons.remove_circle_outline, color: cs.error),
                              ),
                            ),
                        ],
                      ),
                    );
                  }),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: _addObjective,
                      icon: const Icon(Icons.add_circle_outline),
                      label: const Text('إضافة هدف'),
                      style: OutlinedButton.styleFrom(minimumSize: const Size(40, 36)),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // المحتوى اليومي
                  Text(
                    'المحتوى اليومي',
                    style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  ..._dayCtrls.asMap().entries.map((entry) {
                    final i = entry.key;
                    final m = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                flex: 2,
                                child: TextFormField(
                                  controller: m['day'],
                                  decoration: InputDecoration(
                                    hintText: 'اليوم ${i + 1}',
                                    border: const OutlineInputBorder(),
                                    isDense: true,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                flex: 3,
                                child: TextFormField(
                                  controller: m['topic'],
                                  decoration: InputDecoration(
                                    hintText: 'الموضوع',
                                    border: const OutlineInputBorder(),
                                    isDense: true,
                                  ),
                                  validator: (v) => (v == null || v.trim().isEmpty) ? 'مطلوب' : null,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                flex: 2,
                                child: TextFormField(
                                  controller: m['instructor'],
                                  decoration: InputDecoration(
                                    hintText: 'المحاضر',
                                    border: const OutlineInputBorder(),
                                    isDense: true,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              if (_dayCtrls.length > 1)
                                SizedBox(
                                  width: 32,
                                  height: 32,
                                  child: IconButton(
                                    onPressed: () => _removeDay(i),
                                    icon: Icon(Icons.remove_circle_outline, color: cs.error),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    );
                  }),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: _addDay,
                      icon: const Icon(Icons.add_circle_outline),
                      label: const Text('إضافة يوم'),
                      style: OutlinedButton.styleFrom(minimumSize: const Size(40, 36)),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // رابط المادة العلمية
                  TextFormField(
                    controller: _materialsCtrl,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'رابط المادة العلمية (Google Drive)',
                      hintText: 'https://drive.google.com/...',
                      prefixIcon: Icon(Icons.link_outlined),
                      border: OutlineInputBorder(),
                    ),
                    maxLength: 500,
                    validator: (v) {
                      final value = v?.trim() ?? '';
                      if (value.isEmpty) return null;
                      if (!value.startsWith('http://') && !value.startsWith('https://')) {
                        return 'الرابط يجب أن يبدأ بـ http:// أو https://';
                      }
                      if (value.length > 500) {
                        return 'الرابط يجب ألا يزيد عن 500 حرف';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'ارفع المادة العلمية على Google Drive وضع الرابط هنا (يبدأ بـ http أو https، بحد أقصى 500 حرف). '
                    'الملفات الأكبر من 20MB لا تُرفع على المنصة — شاركها كرابط من Drive.',
                    style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                  ),
                  const SizedBox(height: 20),

                  if (_error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      color: cs.errorContainer,
                      child: Text(_error!,
                          style: TextStyle(color: cs.onErrorContainer, fontSize: 13)),
                    ),
                    const SizedBox(height: 12),
                  ],

                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _isLoading ? null : _save,
                      icon: _isLoading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.save_rounded, size: 18),
                      label: Text(isEdit ? 'حفظ التعديلات' : 'إنشاء مسودة'),
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

/// تفاصيل المقترح + تحميل Word.
class InstructorProposalDetailScreen extends StatefulWidget {
  final int proposalId;
  const InstructorProposalDetailScreen({super.key, required this.proposalId});

  @override
  State<InstructorProposalDetailScreen> createState() => _InstructorProposalDetailScreenState();
}

class _InstructorProposalDetailScreenState extends State<InstructorProposalDetailScreen> {
  InstructorProposal? _proposal;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final p = await context.read<InstructorProvider>().fetchProposal(widget.proposalId);
      if (!mounted) return;
      setState(() {
        _proposal = p;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _downloadWord() async {
    if (_proposal == null) return;
    final messenger = ScaffoldMessenger.of(context);
    final provider = context.read<InstructorProvider>();
    messenger.showSnackBar(
      const SnackBar(content: Text('جارٍ تحميل ملف Word...'), duration: Duration(seconds: 2)),
    );
    try {
      final path = await provider.downloadProposalWord(widget.proposalId);
      if (!mounted) return;
      if (path == null) {
        messenger.showSnackBar(
          const SnackBar(content: Text('فشل تحميل ملف Word')),
        );
        return;
      }
      await OpenFilex.open(path);
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text('تعذر فتح الملف: $e'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  Future<void> _submit() async {
    final ok = await context.read<InstructorProvider>().submitProposal(widget.proposalId);
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop(true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('فشل تقديم المقترح')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final proposal = _proposal;

    return Scaffold(
      appBar: AppBar(
        title: const Text('تفاصيل المقترح'),
        actions: [
          if (proposal != null && proposal.canEdit)
            IconButton(
              onPressed: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => InstructorProposalFormScreen(proposal: proposal),
                  ),
                );
                if (!mounted) return;
                _load();
              },
              icon: const Icon(Icons.edit_rounded),
            ),
          if (proposal != null && proposal.canEdit)
            IconButton(
              onPressed: _submit,
              icon: const Icon(Icons.send_rounded),
              tooltip: 'تقديم للإدارة',
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
          : proposal == null
              ? const Center(child: Text('لم يتم العثور على المقترح'))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // حالة المقترح
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: cs.primaryContainer.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.description_outlined, size: 48, color: Colors.green),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(proposal.courseTitle,
                                    style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.green.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        proposal.statusLabelAr,
                                        style: const TextStyle(
                                          color: Colors.green,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                    if (proposal.adminNote.isNotEmpty) ...[
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          'ملاحظة: ${proposal.adminNote}',
                                          style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // الأهداف
                    if (proposal.objectives.isNotEmpty) ...[
                      Text('أهداف الدورة', style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      ...proposal.objectives.map((obj) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.playlist_add_check_outlined, size: 16, color: cs.primary),
                            const SizedBox(width: 8),
                            Expanded(child: Text(obj, style: tt.bodyMedium)),
                          ],
                        ),
                      )),
                      const SizedBox(height: 16),
                    ],

                    // المحتوى اليومي
                    Text('المحتوى اليومي', style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    ...proposal.dailyContent.map((day) => Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        title: Text('${day.day} - ${day.topic}', style: tt.bodyMedium),
                        subtitle: Text(day.instructor.isNotEmpty ? 'المحاضر: ${day.instructor}' : '',
                            style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
                      ),
                    )),
                    const SizedBox(height: 16),

                    // رابط المادة العلمية
                    if (proposal.materialsUrl.isNotEmpty) ...[
                      ListTile(
                        leading: const Icon(Icons.link_outlined),
                        title: const Text('المادة العلمية'),
                        subtitle: Text(proposal.materialsUrl),
                        onTap: () async {
                          final uri = Uri.parse(proposal.materialsUrl);
                          if (await canLaunchUrl(uri)) {
                            await launchUrl(uri, mode: LaunchMode.externalApplication);
                          }
                        },
                      ),
                      const SizedBox(height: 16),
                    ],

                    // أفعال
                    if (proposal.canEdit) ...[
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _submit,
                          icon: const Icon(Icons.send_rounded),
                          label: const Text('تقديم للإدارة'),
                          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                        ),
                      ),
                      const SizedBox(height: 10),
                    ],
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _downloadWord,
                        icon: const Icon(Icons.file_download_outlined),
                        label: const Text('تحميل ملف Word'),
                        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                      ),
                    ),
                  ],
                ),
    );
  }
}
