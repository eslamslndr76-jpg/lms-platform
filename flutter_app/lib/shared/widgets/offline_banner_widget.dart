import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/network/network_service.dart';

class OfflineBannerWidget extends StatelessWidget {
  const OfflineBannerWidget({super.key});

  @override
  Widget build(BuildContext context) {
    final network = context.watch<NetworkService>();

    if (network.isOnline) {
      return const SizedBox.shrink();
    }

    final cs = Theme.of(context).colorScheme;

    return Container(
      width: double.infinity,
      color: cs.errorContainer,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.wifi_off_rounded, size: 16, color: cs.onErrorContainer),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              'أنت تعمل بدون اتصال — يتم عرض أحدث البيانات المحفوظة',
              style: TextStyle(
                color: cs.onErrorContainer,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}
