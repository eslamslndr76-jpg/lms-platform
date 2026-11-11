// موديلات بيانات منطقة المحاضر (المرحلة 12).
// استجابات API من backend/src/routes/instructor.ts و src/services/instructorEvalService.ts proposalService.ts

import '../utils/json_utils.dart';

class InstructorGroup {
  final int id;
  final String name;
  final String status; // 'active' | 'completed' | ...
  final String? completedAt;
  final String? instructorEvalOpenedAt;
  final String courseTitle;
  final int studentsCount;
  final int lecturesCount;
  final String? evalStatus; // 'not_open' | 'draft' | 'submitted'

  const InstructorGroup({
    required this.id,
    required this.name,
    required this.status,
    this.completedAt,
    this.instructorEvalOpenedAt,
    required this.courseTitle,
    required this.studentsCount,
    required this.lecturesCount,
    this.evalStatus,
  });

  bool get isCompleted => status == 'completed' || completedAt != null;
  bool get evalOpened => instructorEvalOpenedAt != null;
  bool get canEvaluate => isCompleted && (evalStatus == 'not_open' || evalStatus == 'draft' || evalStatus == null);
  bool get evalSubmitted => evalStatus == 'submitted';

  String get statusLabelAr {
    switch (status) {
      case 'completed':
        return 'منتهية';
      case 'active':
        return 'جارية';
      default:
        return status;
    }
  }

  factory InstructorGroup.fromJson(Map<String, dynamic> json) {
    return InstructorGroup(
      id: toInt(json['id']),
      name: toStr(json['name']),
      status: toStr(json['status']),
      completedAt: toStrOrNull(json['completed_at']),
      instructorEvalOpenedAt: toStrOrNull(json['instructor_eval_opened_at']),
      courseTitle: toStr(json['course_title']),
      studentsCount: toInt(json['students_count']),
      lecturesCount: toInt(json['lectures_count']),
      evalStatus: toStrOrNull(json['eval_status']),
    );
  }
}

class EvalQuestion {
  final String key;
  final String label;
  const EvalQuestion({required this.key, required this.label});
  factory EvalQuestion.fromJson(Map<String, dynamic> json) =>
      EvalQuestion(key: toStr(json['key']), label: toStr(json['label']));
}

class EvalScaleOption {
  final int value;
  final String label;
  const EvalScaleOption({required this.value, required this.label});
  factory EvalScaleOption.fromJson(Map<String, dynamic> json) =>
      EvalScaleOption(value: toInt(json['value']), label: toStr(json['label']));
}

class EvalStudentScore {
  final int id;
  final String name;
  final List<int?> scores;
  final int? total;
  final bool complete;

  const EvalStudentScore({
    required this.id,
    required this.name,
    required this.scores,
    this.total,
    required this.complete,
  });

  factory EvalStudentScore.fromJson(Map<String, dynamic> json) {
    final rawScores = json['scores'];
    final scores = <int?>[
      if (rawScores is List) ...rawScores.map(toIntOrNull),
    ];
    return EvalStudentScore(
      id: toInt(json['id']),
      name: toStr(json['name']),
      scores: scores,
      total: toIntOrNull(json['total']),
      complete: toBool(json['complete']),
    );
  }
}

class InstructorEvaluation {
  final InstructorGroup group;
  final List<EvalQuestion> questions;
  final List<EvalScaleOption> scale;
  final List<EvalStudentScore> students;
  final String status; // 'not_open' | 'draft' | 'submitted'
  final String? submittedAt;
  final int studentsCount;
  final int completedCount;
  final bool canEdit;

  // بيانات المجموعة/الجدول القادمة مع نموذج التقييم (group).
  final String startDate;
  final String placeName;
  final String courseMode;
  final String instructorName;
  final String? groupCompletedAt;

  const InstructorEvaluation({
    required this.group,
    required this.questions,
    required this.scale,
    required this.students,
    required this.status,
    this.submittedAt,
    required this.studentsCount,
    required this.completedCount,
    required this.canEdit,
    this.startDate = '',
    this.placeName = '',
    this.courseMode = '',
    this.instructorName = '',
    this.groupCompletedAt,
  });

  String get courseModeLabelAr {
    switch (courseMode) {
      case 'online':
        return 'أونلاين';
      case 'offline':
        return 'حضوري';
      case 'hybrid':
        return 'مدمج';
      default:
        return courseMode;
    }
  }

  bool get isSubmitted => status == 'submitted';
  bool get isNotOpen => status == 'not_open';
  bool get isDraft => status == 'draft';

  factory InstructorEvaluation.fromJson(Map<String, dynamic> json) {
    final groupJson = toJsonMap(json['group']) ?? const {};
    return InstructorEvaluation(
      group: InstructorGroup.fromJson(groupJson),
      questions: toJsonList(json['questions']).map(EvalQuestion.fromJson).toList(),
      scale: toJsonList(json['scale']).map(EvalScaleOption.fromJson).toList(),
      students:
          toJsonList(json['students']).map(EvalStudentScore.fromJson).toList(),
      status: toStrOrNull(json['status']) ?? 'not_open',
      submittedAt: toStrOrNull(json['submitted_at']),
      studentsCount: toInt(json['students_count']),
      completedCount: toInt(json['completed_count']),
      canEdit: toBool(json['can_edit']),
      startDate: toStr(groupJson['start_date']),
      placeName: toStr(groupJson['place_name']),
      courseMode: toStr(groupJson['course_mode']),
      instructorName: toStr(groupJson['instructor_name']),
      groupCompletedAt: toStrOrNull(groupJson['completed_at']),
    );
  }
}

class ProposalDay {
  final String day;
  final String topic;
  final String instructor;
  const ProposalDay({required this.day, required this.topic, required this.instructor});
  factory ProposalDay.fromJson(Map<String, dynamic> json) => ProposalDay(
        day: toStr(json['day']),
        topic: toStr(json['topic']),
        instructor: toStr(json['instructor']),
      );
}

class InstructorProposal {
  final int id;
  final int instructorUserId;
  final String instructorName;
  final String courseTitle;
  final List<String> objectives;
  final List<ProposalDay> dailyContent;
  final String materialsUrl;
  final String status; // 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_changes'
  final String statusLabel;
  final String adminNote;
  final int? courseId;
  final String? submittedAt;
  final String? reviewedAt;
  final String? createdAt;
  final String? updatedAt;

  const InstructorProposal({
    required this.id,
    required this.instructorUserId,
    required this.instructorName,
    required this.courseTitle,
    required this.objectives,
    required this.dailyContent,
    required this.materialsUrl,
    required this.status,
    required this.statusLabel,
    required this.adminNote,
    this.courseId,
    this.submittedAt,
    this.reviewedAt,
    this.createdAt,
    this.updatedAt,
  });

  String get statusLabelAr => statusLabel;

  bool get canEdit => status == 'draft' || status == 'needs_changes';
  bool get isSubmitted => status == 'submitted';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';

  factory InstructorProposal.fromJson(Map<String, dynamic> json) {
    final rawObjectives = json['objectives'];
    final objectives = <String>[
      if (rawObjectives is List) ...rawObjectives.map(toStr),
    ];
    return InstructorProposal(
      id: toInt(json['id']),
      instructorUserId: toInt(json['instructor_user_id']),
      instructorName: toStr(json['instructor_name']),
      courseTitle: toStr(json['course_title']),
      objectives: objectives,
      dailyContent:
          toJsonList(json['daily_content']).map(ProposalDay.fromJson).toList(),
      materialsUrl: toStr(json['materials_url']),
      status: toStrOrNull(json['status']) ?? 'draft',
      statusLabel: toStrOrNull(json['status_label']) ?? 'مسودة',
      adminNote: toStr(json['admin_note']),
      courseId: toIntOrNull(json['course_id']),
      submittedAt: toStrOrNull(json['submitted_at']),
      reviewedAt: toStrOrNull(json['reviewed_at']),
      createdAt: toStrOrNull(json['created_at']),
      updatedAt: toStrOrNull(json['updated_at']),
    );
  }
}
