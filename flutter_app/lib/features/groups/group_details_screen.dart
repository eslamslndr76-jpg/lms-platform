import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/services/calendar_service.dart';
import '../attendance/qr_scanner_screen.dart';
import '../../core/utils/json_utils.dart';

class GroupDetailsScreen extends StatefulWidget {
  final int groupId;
  final int? highlightLectureId;

  const GroupDetailsScreen({
    super.key,
    required this.groupId,
    this.highlightLectureId,
  });

  @override
  State<GroupDetailsScreen> createState() => _GroupDetailsScreenState();
}

class _GroupDetailsScreenState extends State<GroupDetailsScreen> {
  final ApiClient _api = ApiClient();
  bool _isLoading = true;
  String? _error;

  Map<String, dynamic>? _group;
  List<Map<String, dynamic>> _lectures = [];

  @override
  void initState() {
    super.initState();
    _loadGroupAndLectures();
  }

  Future<void> _loadGroupAndLectures() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final resAll = await _api.get('/api/groups/my/all');
      if (resAll.statusCode == 200 && resAll.data is List) {
        final list = resAll.data as List;
        for (final item in list) {
          if (item is Map) {
            final map = Map<String, dynamic>.from(item);
            if (toInt(map['id']) == widget.groupId) {
              _group = map;
              break;
            }
          }
        }
      }

      final resLec = await _api.get('/api/groups/my/${widget.groupId}/lectures');
      if (resLec.statusCode == 200 && resLec.data is List) {
        final list = resLec.data as List;
        _lectures = list
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
      }
    } catch (_) {
      _error = 'تعذر تحميل بيانات المجموعة والمحاضرات';
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('تفاصيل المجموعة')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null && _group == null && _lectures.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('تفاصيل المجموعة')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline_rounded, size: 56, color: cs.error),
                const SizedBox(height: 12),
                Text(_error!, style: tt.titleMedium, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.tonal(
                  onPressed: _loadGroupAndLectures,
                  child: const Text('إعادة المحاولة'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final groupName = toStrOrNull(_group?['name']) ?? 'المجموعة التدريبية';
    final courseTitle = toStrOrNull(_group?['title_ar']) ??
        toStrOrNull(_group?['course_name']) ??
        'تفاصيل الدورة';
    final schedule = toStrOrNull(_group?['schedule_display']) ??
        toStrOrNull(_group?['schedule']) ??
        '';
    final instructor = toStrOrNull(_group?['instructor_name']) ??
        toStrOrNull(_group?['instructor']);
    final location =
        toStrOrNull(_group?['location']) ?? toStrOrNull(_group?['place_name']);

    final progress = toJsonMap(_group?['lecture_progress']);
    final totalLec = (progress == null ? null : toIntOrNull(progress['total'])) ??
        _lectures.length;
    final doneLec = (progress == null ? null : toIntOrNull(progress['done'])) ??
        _lectures.where((l) => toBool(l['is_completed'])).length;

    return Scaffold(
      appBar: AppBar(
        title: Text(groupName),
      ),
      body: RefreshIndicator(
        onRefresh: _loadGroupAndLectures,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Header Card ──────────────────────────────────────
            Card(
              color: cs.primaryContainer,
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      courseTitle,
                      style: tt.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: cs.onPrimaryContainer,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(Icons.group_work_rounded, size: 18, color: cs.primary),
                        const SizedBox(width: 6),
                        Text(
                          groupName,
                          style: tt.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: cs.onPrimaryContainer,
                          ),
                        ),
                      ],
                    ),
                    if (schedule.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.calendar_today_rounded, size: 16, color: cs.onPrimaryContainer),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              schedule,
                              style: tt.bodySmall?.copyWith(
                                color: cs.onPrimaryContainer.withValues(alpha: 0.9),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                    if (instructor != null && instructor.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Icon(Icons.person_outline_rounded, size: 16, color: cs.onPrimaryContainer),
                          const SizedBox(width: 6),
                          Text(
                            'المحاضر: $instructor',
                            style: tt.bodySmall?.copyWith(
                              color: cs.onPrimaryContainer.withValues(alpha: 0.9),
                            ),
                          ),
                        ],
                      ),
                    ],
                    if (location != null && location.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Icon(Icons.location_on_outlined, size: 16, color: cs.onPrimaryContainer),
                          const SizedBox(width: 6),
                          Text(
                            'المقر: $location',
                            style: tt.bodySmall?.copyWith(
                              color: cs.onPrimaryContainer.withValues(alpha: 0.9),
                            ),
                          ),
                        ],
                      ),
                    ],
                    if (totalLec > 0) ...[
                      const SizedBox(height: 14),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'التقدم بالمحاضرات: $doneLec من $totalLec',
                            style: tt.bodySmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: cs.onPrimaryContainer,
                            ),
                          ),
                          Text(
                            totalLec > 0 ? '${((doneLec / totalLec) * 100).toInt().clamp(0, 100)}%' : '0%',
                            style: tt.bodySmall?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: cs.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: LinearProgressIndicator(
                          value: totalLec > 0 ? (doneLec / totalLec).clamp(0.0, 1.0) : 0.0,
                          minHeight: 8,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // ── Lectures Header ──────────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'جدول المحاضرات (${_lectures.length})',
                  style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
                Icon(Icons.schedule_rounded, color: cs.primary, size: 20),
              ],
            ),
            const SizedBox(height: 12),

            if (_lectures.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Center(
                    child: Text(
                      'لم يتم إضافة محاضرات لهذه المجموعة بعد.',
                      style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
                    ),
                  ),
                ),
              )
            else
              ..._lectures.asMap().entries.map((entry) {
                final idx = entry.key + 1;
                final lec = entry.value;
                final lecId = toInt(lec['id']);
                final topic = toStrOrNull(lec['topic']) ?? 'محاضرة $idx';
                final date = toStr(lec['date']);
                final dayName = toStr(lec['day_of_week_name']);
                final timeFrom = toStr(lec['time_from']);
                final timeTo = toStr(lec['time_to']);
                final lecLoc = toStr(lec['location']);
                final zoomLink = toStrOrNull(lec['zoom_link']);
                final isAttActive = toBool(lec['attendance_active']);
                final isCompleted = toBool(lec['is_completed']);
                final attendedBool = toBool(lec['attended']);
                final myAtt = toStrOrNull(lec['my_attendance']) ??
                    (attendedBool ? 'attended' : null);

                final isHighlighted = widget.highlightLectureId == lecId;
                final lectureStart = CalendarService.parseLectureStart(date, timeFrom);

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border: isHighlighted
                        ? Border.all(color: cs.primary, width: 2)
                        : null,
                  ),
                  child: Card(
                    elevation: isHighlighted ? 3 : 1,
                    color: isAttActive
                        ? cs.secondaryContainer.withValues(alpha: 0.35)
                        : isHighlighted
                            ? cs.primaryContainer.withValues(alpha: 0.25)
                            : null,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: isAttActive
                                      ? cs.primary
                                      : isCompleted
                                          ? Colors.green.shade700
                                          : cs.surfaceContainerHighest,
                                  shape: BoxShape.circle,
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  '$idx',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w900,
                                    color: isAttActive || isCompleted ? Colors.white : cs.onSurface,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      topic,
                                      style: tt.titleSmall?.copyWith(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 15,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        if (dayName.isNotEmpty || date.isNotEmpty) ...[
                                          Icon(Icons.calendar_today_outlined, size: 14, color: cs.onSurfaceVariant),
                                          const SizedBox(width: 4),
                                          Text(
                                            '$dayName $date'.trim(),
                                            style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                                          ),
                                          const SizedBox(width: 12),
                                        ],
                                        if (timeFrom.isNotEmpty) ...[
                                          Icon(Icons.access_time_rounded, size: 14, color: cs.onSurfaceVariant),
                                          const SizedBox(width: 4),
                                          Text(
                                            timeTo.isNotEmpty ? '$timeFrom - $timeTo' : timeFrom,
                                            style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              if (isAttActive)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.red.shade600,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.fiber_manual_record, size: 10, color: Colors.white),
                                      SizedBox(width: 4),
                                      Text(
                                        'الحضور مفتوح',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              else if (myAtt == 'attended')
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.green.shade100,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    'حاضر ✅',
                                    style: TextStyle(
                                      color: Colors.green.shade900,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                )
                              else if (isCompleted)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: cs.surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    'منتهية',
                                    style: TextStyle(
                                      color: cs.onSurfaceVariant,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                            ],
                          ),

                          if (lecLoc.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Icon(Icons.room_outlined, size: 15, color: cs.onSurfaceVariant),
                                const SizedBox(width: 6),
                                Text(
                                  lecLoc,
                                  style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                                ),
                              ],
                            ),
                          ],

                          if (zoomLink != null && zoomLink.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: () async {
                                final uri = Uri.tryParse(zoomLink);
                                if (uri != null && await canLaunchUrl(uri)) {
                                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                                }
                              },
                              icon: const Icon(Icons.videocam_rounded, size: 18),
                              label: const Text('رابط البث / Zoom'),
                              style: OutlinedButton.styleFrom(
                                visualDensity: VisualDensity.compact,
                              ),
                            ),
                          ],

                          // أضف للتقويم (المرحلة 14)
                          if (lectureStart != null) ...[
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: () async {
                                final messenger = ScaffoldMessenger.of(context);
                                final res = await CalendarService.addLecture(
                                  lectureId: lecId,
                                  start: lectureStart,
                                  title: topic,
                                  description:
                                      'المجموعة: ${_group?['name'] ?? ''} — الكورس: ${_group?['course_title'] ?? ''}',
                                  location: lecLoc,
                                  link: '/groups/${widget.groupId}',
                                );
                                messenger.showSnackBar(
                                  SnackBar(content: Text(res.message)),
                                );
                              },
                              icon: const Icon(Icons.event_available_rounded, size: 18),
                              label: const Text('أضف للتقويم'),
                              style: OutlinedButton.styleFrom(
                                visualDensity: VisualDensity.compact,
                              ),
                            ),
                          ],

                          // Action button if attendance is currently open
                          if (isAttActive) ...[
                            const SizedBox(height: 12),
                            FilledButton.icon(
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => QrScannerScreen(
                                      targetLectureId: lecId,
                                    ),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.qr_code_scanner_rounded),
                              label: const Text('مسح كود الحضور بالكاميرا'),
                              style: FilledButton.styleFrom(
                                minimumSize: const Size.fromHeight(42),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
