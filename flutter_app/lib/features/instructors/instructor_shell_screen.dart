import 'package:flutter/material.dart';
import 'instructor_account_screen.dart';
import 'instructor_evaluation_list_screen.dart';
import 'instructor_groups_screen.dart';
import 'instructor_proposals_screen.dart';

/// تبويبات منطقة المحاضر — تُستخدم أيضاً من جدول التوجيه المركزي.
class InstructorTabs {
  InstructorTabs._();

  static const int groups = 0;
  static const int evaluations = 1;
  static const int proposals = 2;
  static const int account = 3;

  /// يقرأه القشرة (Shell) ويُكتب من التوجيه/الإشعارات.
  static final ValueNotifier<int> notifier = ValueNotifier<int>(0);
}

/// واجهة المحاضر الرئيسية: مجموعاتي · التقييم · المقترحات · حسابي.
/// الطالب لا يصل إليها أبداً (تُعرض له واجهته في HomeScreen).
class InstructorShellScreen extends StatefulWidget {
  const InstructorShellScreen({super.key});

  @override
  State<InstructorShellScreen> createState() => _InstructorShellScreenState();
}

class _InstructorShellScreenState extends State<InstructorShellScreen> {
  late int _index = InstructorTabs.notifier.value;

  @override
  void initState() {
    super.initState();
    InstructorTabs.notifier.addListener(_onTabChanged);
  }

  @override
  void dispose() {
    InstructorTabs.notifier.removeListener(_onTabChanged);
    super.dispose();
  }

  void _onTabChanged() {
    final value = InstructorTabs.notifier.value;
    if (mounted && value != _index) {
      setState(() => _index = value);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [
          InstructorGroupsScreen(),
          InstructorEvaluationListScreen(),
          InstructorProposalsScreen(),
          InstructorAccountScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) {
          setState(() => _index = i);
          InstructorTabs.notifier.value = i;
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.groups_outlined),
            selectedIcon: Icon(Icons.groups_rounded),
            label: 'مجموعاتي',
          ),
          NavigationDestination(
            icon: Icon(Icons.assignment_outlined),
            selectedIcon: Icon(Icons.assignment_rounded),
            label: 'التقييم',
          ),
          NavigationDestination(
            icon: Icon(Icons.lightbulb_outline_rounded),
            selectedIcon: Icon(Icons.lightbulb_rounded),
            label: 'المقترحات',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'حسابي',
          ),
        ],
      ),
    );
  }
}
