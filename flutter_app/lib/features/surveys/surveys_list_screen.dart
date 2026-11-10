import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/surveys/surveys_provider.dart';
import '../../core/models/survey_model.dart';
import 'survey_screen.dart';

/// Lists the student's completed groups with their survey state.
class SurveysListScreen extends StatefulWidget {
  const SurveysListScreen({super.key});

  @override
  State<SurveysListScreen> createState() => _SurveysListScreenState();
}

class _SurveysListScreenState extends State<SurveysListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SurveysProvider>().fetchMySurveys();
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final provider = context.watch<SurveysProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('استبيانات الدورات')),
      body: RefreshIndicator(
        onRefresh: () => provider.fetchMySurveys(),
        child: provider.isLoading
            ? const Center(child: CircularProgressIndicator())
            : provider.error != null
                ? _ErrorView(
                    message: provider.error!,
                    onRetry: () => provider.fetchMySurveys(),
                  )
                : provider.surveys.isEmpty
                    ? _EmptyView()
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: provider.surveys.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, i) =>
                            _SurveyCard(summary: provider.surveys[i], cs: cs, tt: tt),
                      ),
      ),
    );
  }
}

class _SurveyCard extends StatelessWidget {
  final SurveySummary summary;
  final ColorScheme cs;
  final TextTheme tt;
  const _SurveyCard({required this.summary, required this.cs, required this.tt});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (summary.status) {
      'submitted' => ('تم الإرسال', Colors.green.shade700),
      'draft' => ('مسودة محفوظة', cs.tertiary),
      'closed' => ('مغلق', cs.outline),
      _ => ('بانتظار إجابتك', cs.primary),
    };

    return Card(
      elevation: 0,
      color: cs.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: summary.status == 'closed' || summary.status == 'submitted'
            ? () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => SurveyScreen(groupId: summary.groupId),
                  ),
                )
            : () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => SurveyScreen(groupId: summary.groupId),
                  ),
                );
                if (context.mounted) {
                  context.read<SurveysProvider>().fetchMySurveys(silent: true);
                }
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
                      summary.courseTitle.isNotEmpty
                          ? summary.courseTitle
                          : summary.groupName,
                      style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      label,
                      style: tt.labelSmall?.copyWith(
                        color: color,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
              if (summary.groupName.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  summary.groupName,
                  style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                ),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(Icons.access_time_rounded, size: 14, color: cs.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(
                    summary.daysLeft > 0
                        ? 'متبقي ${summary.daysLeft} يوم للإجابة'
                        : 'انتهت مدة الإجابة',
                    style: tt.labelSmall?.copyWith(color: cs.onSurfaceVariant),
                  ),
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
                  Text('لا توجد استبيانات', style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text(
                    'يُفتح استبيان تقييم الدورة بعد انتهاء مجموعتك التدريبية.',
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
            Text('تعذر تحميل الاستبيانات',
                style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: cs.error)),
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
