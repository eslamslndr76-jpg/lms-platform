import { Router, Request, Response } from 'express';
import { callGemini, getAiKeys } from '../utils/gemini';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const SYSTEM_PROMPT = `أنت مساعد ذكي لنظام إدارة التعلم (LMS).
- إذا كنت أدمن: يمكنك عرض التقارير المالية، آخر الطلبات، وإحصائيات الكورسات.
- إذا كنت طالب: يمكنك فقط الاطلاع على حالة طلبك وجدولك.
استخدم الأدوات المتاحة عند الحاجة. أجب باللغة العربية بوضوح.`;

const TOOLS = [
  {
    name: 'get_financial_summary',
    description: 'جلب ملخص مالي (إجمالي المبيعات، عدد الطلبات المدفوعة والمعلقة)',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_orders',
    description: 'آخر 5 طلبات',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string', description: 'فلتر حسب الحالة (اختياري)' } },
    },
  },
  {
    name: 'get_course_stats',
    description: 'إحصائيات الكورسات',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_my_orders',
    description: 'عرض طلبات المستخدم الحالي',
    parameters: { type: 'object', properties: {} },
  },
];

async function executeTool(name: string, args: any, userId: number, roleId: number) {
  switch (name) {
    case 'get_financial_summary': {
      if (roleId > 2) return 'غير مصرح لك بعرض المالية';
      const paid = await sql("SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as sum FROM orders WHERE status='paid'");
      const pending = await sql("SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as sum FROM orders WHERE status='pending'");
      return `إجمالي المبيعات: ${paid.rows[0].sum} ج.م (${paid.rows[0].count} طلب)
الطلبات المعلقة: ${pending.rows[0].count} طلب بقيمة ${pending.rows[0].sum} ج.م`;
    }
    case 'get_recent_orders': {
      if (roleId > 2) return 'غير مصرح لك';
      const statusFilter = args?.status && args.status !== 'all' ? `WHERE o.status='${args.status}'` : '';
      const orders = await sql(
        `SELECT o.id, u.name as student, c.title_ar as course, o.amount, o.status
         FROM orders o JOIN users u ON o.user_id=u.id JOIN courses c ON o.course_id=c.id
         ${statusFilter} ORDER BY o.created_at DESC LIMIT 5`,
      );
      if (orders.rows.length === 0) return 'لا توجد طلبات';
      return orders.rows.map((o: any) =>
        `#${o.id} - ${o.student} - ${o.course} - ${o.amount} ج.م - ${o.status}`,
      ).join('\n');
    }
    case 'get_course_stats': {
      if (roleId > 2) return 'غير مصرح لك';
      const courses = await sql(
        `SELECT c.title_ar, COUNT(o.id) as students, COALESCE(SUM(o.amount),0) as revenue
         FROM courses c LEFT JOIN orders o ON c.id=o.course_id AND o.status='paid'
         GROUP BY c.id ORDER BY revenue DESC`,
      );
      return courses.rows.map((c: any) =>
        `${c.title_ar}: ${c.students} طالب - ${c.revenue} ج.م`,
      ).join('\n');
    }
    case 'get_my_orders': {
      const orders = await sql(
        `SELECT o.*, c.title_ar FROM orders o JOIN courses c ON o.course_id=c.id WHERE o.user_id=?`,
        userId,
      );
      if (orders.rows.length === 0) return 'لا توجد طلبات';
      return orders.rows.map((o: any) =>
        `طلب #${o.id}: ${o.title_ar} - ${o.amount} ج.م - ${o.status}`,
      ).join('\n');
    }
    default:
      return `الأداة ${name} غير معروفة`;
  }
}

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const keys = await getAiKeys();
    const messages = [
      ...(history || []).map((h: any) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user' as const, parts: [{ text: message }] },
    ];

    const data = await callGemini(SYSTEM_PROMPT, messages, TOOLS, keys);

    const candidate = data?.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part?.functionCall) {
      const fc = part.functionCall;
      const resultText = await executeTool(fc.name, fc.args, req.user!.userId, req.user!.roleId);

      const toolMessages = [
        ...messages,
        { role: 'model' as const, parts: [{ text: '', functionCall: fc }] },
        { role: 'user' as const, parts: [{ text: resultText }] },
      ];
      const followUp = await callGemini(SYSTEM_PROMPT, toolMessages, TOOLS, keys);
      const reply = followUp?.candidates?.[0]?.content?.parts?.[0]?.text || resultText;
      return res.json({ reply, tool: fc.name, result: resultText });
    }

    res.json({ reply: part?.text || 'عذراً، لم أتمكن من معالجة طلبك' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Chat failed' });
  }
});

export default router;
