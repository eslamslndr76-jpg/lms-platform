// موديلات بيانات منطقة المحاضر (المرحلة 12).
// استجابات API من backend/src/routes/instructor.ts و src/services/instructorEvalService.ts proposalService.ts

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
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name'] as String? ?? '',
      status: json['status'] as String? ?? '',
      completedAt: json['completed_at'] as String?,
      instructorEvalOpenedAt: json['instructor_eval_opened_at'] as String?,
      courseTitle: json['course_title'] as String? ?? '',
      studentsCount: (json['students_count'] as num?)?.toInt() ?? 0,
      lecturesCount: (json['lectures_count'] as num?)?.toInt() ?? 0,
      evalStatus: json['eval_status'] as String?,
    );
  }
}

class EvalQuestion {
  final String key;
  final String label;
  const EvalQuestion({required this.key, required this.label});
  factory EvalQuestion.fromJson(Map<String, dynamic> json) =>
      EvalQuestion(key: json['key'] as String? ?? '', label: json['label'] as String? ?? '');
}

class EvalScaleOption {
  final int value;
  final String label;
  const EvalScaleOption({required this.value, required this.label});
  factory EvalScaleOption.fromJson(Map<String, dynamic> json) =>
      EvalScaleOption(value: (json['value'] as num?)?.toInt() ?? 0, label: json['label'] as String? ?? '');
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
    final scores = <int?>[];
    if (rawScores is List) {
      for (final s in rawScores) {
        scores.add(s is num ? s.toInt() : null);
      }
    }
    return EvalStudentScore(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name'] as String? ?? '',
      scores: scores,
      total: json['total'] is num ? json['total'].toInt() : null,
      complete: json['complete'] as bool? ?? false,
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
    final groupJson = (json['group'] as Map?)?.cast<String, dynamic>() ?? {};
    final questions = ((json['questions'] as List?) ?? [])
        .whereType<Map<String, dynamic>>()
        .map(EvalQuestion.fromJson)
        .toList();
    final scale = ((json['scale'] as List?) ?? [])
        .whereType<Map<String, dynamic>>()
        .map(EvalScaleOption.fromJson)
        .toList();
    final students = ((json['students'] as List?) ?? [])
        .whereType<Map<String, dynamic>>()
        .map(EvalStudentScore.fromJson)
        .toList();
    return InstructorEvaluation(
      group: InstructorGroup.fromJson(groupJson),
      questions: questions,
      scale: scale,
      students: students,
      status: json['status'] as String? ?? 'not_open',
      submittedAt: json['submitted_at'] as String?,
      studentsCount: (json['students_count'] as num?)?.toInt() ?? 0,
      completedCount: (json['completed_count'] as num?)?.toInt() ?? 0,
      canEdit: json['can_edit'] as bool? ?? false,
      startDate: groupJson['start_date'] as String? ?? '',
      placeName: groupJson['place_name'] as String? ?? '',
      courseMode: groupJson['course_mode'] as String? ?? '',
      instructorName: groupJson['instructor_name'] as String? ?? '',
      groupCompletedAt: groupJson['completed_at'] as String?,
    );
  }
}

class ProposalDay {
  final String day;
  final String topic;
  final String instructor;
  const ProposalDay({required this.day, required this.topic, required this.instructor});
  factory ProposalDay.fromJson(Map<String, dynamic> json) =>
      ProposalDay(day: json['day'] as String? ?? '', topic: json['topic'] as String? ?? '', instructor: json['instructor'] as String? ?? '');
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
    final objectives = ((json['objectives'] as List?) ?? [])
        .whereType<String>()
        .toList();
    final dailyContent = ((json['daily_content'] as List?) ?? [])
        .whereType<Map<String, dynamic>>()
        .map(ProposalDay.fromJson)
        .toList();
    return InstructorProposal(
      id: (json['id'] as num?)?.toInt() ?? 0,
      instructorUserId: (json['instructor_user_id'] as num?)?.toInt() ?? 0,
      instructorName: json['instructor_name'] as String? ?? '',
      courseTitle: json['course_title'] as String? ?? '',
      objectives: objectives,
      dailyContent: dailyContent,
      materialsUrl: json['materials_url'] as String? ?? '',
      status: json['status'] as String? ?? 'draft',
      statusLabel: json['status_label'] as String? ?? 'مسودة',
      adminNote: json['admin_note'] as String? ?? '',
      courseId: json['course_id'] is num ? json['course_id'].toInt() : null,
      submittedAt: json['submitted_at'] as String?,
      reviewedAt: json['reviewed_at'] as String?,
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
    );
  }
}
