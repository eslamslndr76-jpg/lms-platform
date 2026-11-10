// Models for the post-course survey (`/api/surveys/my/:groupId`).
// Item lists and scale come from the backend — never hard-coded here.

class SurveyScaleOption {
  final int value;
  final String label;
  const SurveyScaleOption({required this.value, required this.label});

  factory SurveyScaleOption.fromJson(Map<String, dynamic> json) =>
      SurveyScaleOption(
        value: (json['value'] as num?)?.toInt() ?? 0,
        label: json['label'] as String? ?? '',
      );
}

class SurveyItem {
  final String key;
  final String label;
  const SurveyItem({required this.key, required this.label});

  factory SurveyItem.fromJson(Map<String, dynamic> json) => SurveyItem(
        key: json['key'] as String? ?? '',
        label: json['label'] as String? ?? '',
      );
}

class SurveySection {
  final String key;
  final String title;
  final List<SurveyItem> items;
  const SurveySection({
    required this.key,
    required this.title,
    required this.items,
  });

  factory SurveySection.fromJson(Map<String, dynamic> json) => SurveySection(
        key: json['key'] as String? ?? '',
        title: json['title'] as String? ?? '',
        items: ((json['items'] as List?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(SurveyItem.fromJson)
            .toList(),
      );
}

class SurveyResponse {
  final String status; // draft | submitted
  final bool isAnonymous;
  final Map<String, dynamic> answers;
  final int currentStep;
  final String? updatedAt;
  final String? submittedAt;
  const SurveyResponse({
    required this.status,
    required this.isAnonymous,
    required this.answers,
    required this.currentStep,
    this.updatedAt,
    this.submittedAt,
  });

  factory SurveyResponse.fromJson(Map<String, dynamic> json) => SurveyResponse(
        status: json['status'] as String? ?? 'draft',
        isAnonymous: json['is_anonymous'] as bool? ?? false,
        answers: (json['answers'] as Map?)?.cast<String, dynamic>() ?? {},
        currentStep: (json['current_step'] as num?)?.toInt() ?? 0,
        updatedAt: json['updated_at'] as String?,
        submittedAt: json['submitted_at'] as String?,
      );
}

class SurveyGroupInfo {
  final int id;
  final String name;
  final String courseTitle;
  final String courseMode;
  final String? instructorName;
  final String? placeName;
  final String? startDate;
  final String? endDate;
  const SurveyGroupInfo({
    required this.id,
    required this.name,
    required this.courseTitle,
    required this.courseMode,
    this.instructorName,
    this.placeName,
    this.startDate,
    this.endDate,
  });

  factory SurveyGroupInfo.fromJson(Map<String, dynamic> json) => SurveyGroupInfo(
        id: (json['id'] as num?)?.toInt() ?? 0,
        name: json['name'] as String? ?? '',
        courseTitle: json['course_title'] as String? ?? '',
        courseMode: json['course_mode'] as String? ?? 'online',
        instructorName: json['instructor_name'] as String?,
        placeName: json['place_name'] as String?,
        startDate: json['start_date'] as String?,
        endDate: json['end_date'] as String?,
      );
}

class Survey {
  final bool available;
  final String status; // not_open | closed | submitted | draft | pending
  final bool canEdit;
  final bool isClosed;
  final String? closesAt;
  final int daysLeft;
  final SurveyGroupInfo group;
  final String studentName;
  final List<SurveySection> sections;
  final SurveyItem helped;
  final String notesLabel;
  final List<SurveyScaleOption> scale;
  final SurveyResponse? response;

  const Survey({
    required this.available,
    required this.status,
    required this.canEdit,
    required this.isClosed,
    this.closesAt,
    required this.daysLeft,
    required this.group,
    required this.studentName,
    required this.sections,
    required this.helped,
    required this.notesLabel,
    required this.scale,
    this.response,
  });

  factory Survey.fromJson(Map<String, dynamic> json) {
    final group = (json['group'] as Map?)?.cast<String, dynamic>() ?? {};
    final student = (json['student'] as Map?)?.cast<String, dynamic>() ?? {};
    return Survey(
      available: json['available'] as bool? ?? false,
      status: json['status'] as String? ?? 'pending',
      canEdit: json['can_edit'] as bool? ?? false,
      isClosed: json['is_closed'] as bool? ?? false,
      closesAt: json['closes_at'] as String?,
      daysLeft: (json['days_left'] as num?)?.toInt() ?? 0,
      group: SurveyGroupInfo.fromJson(group),
      studentName: student['name'] as String? ?? '',
      sections: ((json['sections'] as List?) ?? [])
          .whereType<Map<String, dynamic>>()
          .map(SurveySection.fromJson)
          .toList(),
      helped: SurveyItem.fromJson(
          (json['helped'] as Map?)?.cast<String, dynamic>() ?? {'key': 'helped_develop'}),
      notesLabel: json['notes_label'] as String? ?? 'الاقتراحات والملاحظات',
      scale: ((json['scale'] as List?) ?? [])
          .whereType<Map<String, dynamic>>()
          .map(SurveyScaleOption.fromJson)
          .toList(),
      response: json['response'] == null
          ? null
          : SurveyResponse.fromJson(
              (json['response'] as Map).cast<String, dynamic>()),
    );
  }

  /// Flat list of all rated item keys (used for progress + validation).
  List<String> get allItemKeys =>
      sections.expand((s) => s.items).map((i) => i.key).toList();
}

/// One row in `GET /api/surveys/my` (dashboard "قيّم دورتك" list).
class SurveySummary {
  final int groupId;
  final String groupName;
  final String courseTitle;
  final String courseMode;
  final String? completedAt;
  final String? closesAt;
  final int daysLeft;
  final String status; // pending | draft | submitted | closed
  final String? answeredAt;

  const SurveySummary({
    required this.groupId,
    required this.groupName,
    required this.courseTitle,
    required this.courseMode,
    this.completedAt,
    this.closesAt,
    required this.daysLeft,
    required this.status,
    this.answeredAt,
  });

  factory SurveySummary.fromJson(Map<String, dynamic> json) => SurveySummary(
        groupId: (json['group_id'] as num?)?.toInt() ?? 0,
        groupName: json['group_name'] as String? ?? '',
        courseTitle: json['course_title'] as String? ?? '',
        courseMode: json['course_mode'] as String? ?? 'online',
        completedAt: json['completed_at'] as String?,
        closesAt: json['closes_at'] as String?,
        daysLeft: (json['days_left'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'pending',
        answeredAt: json['answered_at'] as String?,
      );

  bool get canAnswer => status == 'pending' || status == 'draft';
}
