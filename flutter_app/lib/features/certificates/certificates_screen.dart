import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/certificates/certificates_provider.dart';
import '../../core/models/certificate_model.dart';

class CertificatesScreen extends StatefulWidget {
  const CertificatesScreen({super.key});

  @override
  State<CertificatesScreen> createState() => _CertificatesScreenState();
}

class _CertificatesScreenState extends State<CertificatesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CertificatesProvider>().fetchMyCertificates(silent: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final provider = context.watch<CertificatesProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('شهاداتي المعتمدة'),
      ),
      body: RefreshIndicator(
        onRefresh: () => provider.fetchMyCertificates(silent: true),
        child: provider.isLoading
            ? const Center(child: CircularProgressIndicator())
            : provider.certificates.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.workspace_premium_outlined,
                            size: 72,
                            color: cs.onSurfaceVariant.withValues(alpha: 0.4),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'لا توجد شهادات صادرة بعد',
                            style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'تُمنح الشهادات المعتمدة فور استكمال حضور جميع محاضرات الدورة التدريبية واجتياز متطلباتها.',
                            textAlign: TextAlign.center,
                            style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: provider.certificates.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 14),
                    itemBuilder: (context, index) {
                      final cert = provider.certificates[index];
                      return _CertificateCard(certificate: cert);
                    },
                  ),
      ),
    );
  }
}

class _CertificateCard extends StatelessWidget {
  final CertificateModel certificate;

  const _CertificateCard({required this.certificate});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: cs.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.workspace_premium_rounded, color: cs.onPrimaryContainer, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        certificate.titleAr,
                        style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'كود التحقق: ${certificate.serialId}',
                        style: TextStyle(
                          fontSize: 12,
                          color: cs.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'تاريخ الإصدار: ${certificate.issuedAt.split('T').first}',
                  style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: certificate.isActive
                        ? cs.primaryContainer
                        : cs.errorContainer,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    certificate.isActive ? 'معتمدة وصالحة' : 'ملغاة',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: certificate.isActive
                          ? cs.onPrimaryContainer
                          : cs.onErrorContainer,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
