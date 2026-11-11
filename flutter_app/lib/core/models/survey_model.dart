// Models for the post-course survey (`/api/surveys/my/:groupId`).
// Item lists and scale come from the backend — never hard-coded here.

import '../utils/json_utils.dart';

class SurveyScaleOption {
  final int value;
  final String label;
  const SurveyScaleOption({required this.value, required this.label});

  factory SurveyScaleOption.fromJson(Map<String, dynamic> json) =>
      SurveyScaleOption(
        value: toInt(json['value']),
        label: toStr(json['label']),
      );
}

class SurveyItem {
  final String key;
  final String label;
  const SurveyItem({required this.key, required this.label});

  factory SurveyItem.fromJson(Map<String, dynamic> json) => SurveyItem(
        key: toStr(json['key']),
        label: toStr(json['label']),
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
        key: toStr(json['key']),
        title: toStr(json['title']),
        items: toJsonList(json['items']).map(SurveyItem.fromJson).toList(),
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
        status: toStrOrNull(json['status']) ?? 'draft',
        isAnonymous: toBool(json['is_anonymous']),
        answers: toJsonMap(json['answers']) ?? const {},
        currentStep: toInt(json['current_step']),
        updatedAt: toStrOrNull(json['updated_at']),
        submittedAt: toStrOrNull(json['submitted_at']),
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
        id: toInt(json['id']),
        name: toStr(json['name']),
        courseTitle: toStr(json['course_title']),
        courseMode: toStrOrNull(json['course_mode']) ?? 'online',
        instructorName: toStrOrNull(json['instructor_name']),
        placeName: toStrOrNull(json['place_name']),
        startDate: toStrOrNull(json['start_date']),
        endDate: toStrOrNull(json['end_date']),
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
    final group = toJsonMap(json['group']) ?? const {};
    final student = toJsonMap(json['student']) ?? const {};
    final response = toJsonMap(json['response']);
    return Survey(
      available: toBool(json['available']),
      status: toStrOrNull(json['status']) ?? 'pending',
      canEdit: toBool(json['can_edit']),
      isClosed: toBool(json['is_closed']),
      closesAt: toStrOrNull(json['closes_at']),
      daysLeft: toInt(json['days_left']),
      group: SurveyGroupInfo.fromJson(group),
      studentName: toStr(student['name']),
      sections:
          toJsonList(json['sections']).map(SurveySection.fromJson).toList(),
      helped: SurveyItem.fromJson(
          toJsonMap(json['helped']) ?? const {'key': 'helped_develop'}),
      notesLabel: toStrOrNull(json['notes_label']) ?? 'الاقتراحات والملاحظات',
      scale:
          toJsonList(json['scale']).map(SurveyScaleOption.fromJson).toList(),
      response: response == null ? null : SurveyResponse.fromJson(response),
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
        groupId: toInt(json['group_id']),
        groupName: toStr(json['group_name']),
        courseTitle: toStr(json['course_title']),
        courseMode: toStrOrNull(json['course_mode']) ?? 'online',
        completedAt: toStrOrNull(json['completed_at']),
        closesAt: toStrOrNull(json['closes_at']),
        daysLeft: toInt(json['days_left']),
        status: toStrOrNull(json['status']) ?? 'pending',
        answeredAt: toStrOrNull(json['answered_at']),
      );

  bool get canAnswer => status == 'pending' || status == 'draft';
}
