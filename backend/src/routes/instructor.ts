import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { INSTRUCTOR, requireRole } from '../middleware/rbac';
import { sql } from '../db/helpers';
import * as instructorEvalService from '../services/instructorEvalService';
import * as proposalService from '../services/proposalService';

const router = Router();

function fail(res: Response, err: any, fallback: string) {
  console.error('[Instructor]', err?.message || err);
  res.status(err?.status || 500).json({ error: err?.message || fallback });
}

// GET /api/instructor/groups — only the groups linked to the signed-in instructor.
router.get('/groups', authMiddleware, requireRole(INSTRUCTOR), async (req: Request, res: Response) => {
  try {
    const rows = await sql(
      `SELECT g.id, g.name, g.status, g.completed_at, g.instructor_eval_opened_at,
              c.title_ar as course_title,
              (SELECT COUNT(*) FROM group_students gs WHERE gs.group_id=g.id) as students_count,
              (SELECT COUNT(*) FROM lectures l WHERE l.group_id=g.id) as lectures_count,
              (SELECT status FROM group_instructor_evals e WHERE e.group_id=g.id) as eval_status
       FROM groups g JOIN courses c ON g.course_id=c.id
       WHERE g.instructor_user_id=?
       ORDER BY COALESCE(g.completed_at, g.created_at) DESC`,
      req.user!.userId,
    );
    res.json(rows.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch instructor groups' });
  }
});

// GET /api/instructor/groups/:id/evaluation — form definition + saved draft
router.get('/groups/:id/evaluation', authMiddleware, requireRole(INSTRUCTOR), async (req: Request, res: Response) => {
  try {
    const evaluation = await instructorEvalService.getInstructorEvaluation(
      req.user!.userId,
      Number(req.params.id),
    );
    res.json(evaluation);
  } catch (err: any) {
    fail(res, err, 'Failed to fetch evaluation');
  }
});

// PUT /api/instructor/groups/:id/evaluation/draft — save progress, keep editing
router.put('/groups/:id/evaluation/draft', authMiddleware, requireRole(INSTRUCTOR), async (req: Request, res: Response) => {
  try {
    const evaluation = await instructorEvalService.saveInstructorEvaluationDraft(
      req.user!.userId,
      Number(req.params.id),
      req.body?.scores,
    );
    res.json({ message: 'Saved', evaluation });
  } catch (err: any) {
    fail(res, err, 'Failed to save evaluation draft');
  }
});

// POST /api/instructor/groups/:id/evaluation/submit — final, locked afterwards
router.post('/groups/:id/evaluation/submit', authMiddleware, requireRole(INSTRUCTOR), async (req: Request, res: Response) => {
  try {
    const evaluation = await instructorEvalService.submitInstructorEvaluation(
      req.user!.userId,
      Number(req.params.id),
      req.body?.scores,
    );
    res.json({ message: 'Submitted', evaluation });
  } catch (err: any) {
    fail(res, err, 'Failed to submit evaluation');
  }
});

// ═══════════════════════════════════════════════
// Course proposals (edit-plan.md §6)
// ═══════════════════════════════════════════════

// GET /api/instructor/proposals — only the signed-in instructor's proposals
router.get('/proposals', authMiddleware, requireRole(INSTRUCTOR), async (req: Request, res: Response) => {
  try {
    res.json(await proposalService.getInstructorProposals(req.user!.userId));
  } catch (err: any) {
    fail(res, err, 'Failed to fetch proposals');
  }
});

// POST /api/instructor/proposals — starts a new draft
router.post('/proposals', authMiddleware, requireRole(INSTRUCTOR), async (req: Request, res: Response) => {
  try {
    const proposal = await proposalService.createProposal(req.user!.userId, {
      course_title: req.body?.course_title,
      objectives: req.body?.objectives,
      daily_content: req.body?.daily_content,
    });
    res.status(201).json({ message: 'Proposal created', proposal });
  } catch (err: any) {
    fail(res, err, 'Failed to create proposal');
  }
});

// GET /api/instructor/proposals/:id
router.get('/proposals/:id', authMiddleware, requireRole(INSTRUCTOR), async (req: Request, res: Response) => {
  try {
    res.json(await proposalService.loadProposalForInstructor(req.user!.userId, Number(req.params.id)));
  } catch (err: any) {
    fail(res, err, 'Failed to fetch proposal');
  }
});

// PUT /api/instructor/proposals/:id — only while draft / needs_changes
router.put('/proposals/:id', authMiddleware, requireRole(INSTRUCTOR), async (req: Request, res: Response) => {
  try {
    const proposal = await proposalService.updateProposal(req.user!.userId, Number(req.params.id), {
      course_title: req.body?.course_title,
      objectives: req.body?.objectives,
      daily_content: req.body?.daily_content,
    });
    res.json({ message: 'Proposal saved', proposal });
  } catch (err: any) {
    fail(res, err, 'Failed to save proposal');
  }
});

// POST /api/instructor/proposals/:id/submit — sends it to the admin
router.post('/proposals/:id/submit', authMiddleware, requireRole(INSTRUCTOR), async (req: Request, res: Response) => {
  try {
    const proposal = await proposalService.submitProposal(req.user!.userId, Number(req.params.id));
    res.json({ message: 'Proposal submitted', proposal });
  } catch (err: any) {
    fail(res, err, 'Failed to submit proposal');
  }
});

// GET /api/instructor/proposals/:id/word — printable Arabic RTL proposal
router.get('/proposals/:id/word', authMiddleware, requireRole(INSTRUCTOR), async (req: Request, res: Response) => {
  try {
    const proposal = await proposalService.loadProposalForInstructor(
      req.user!.userId,
      Number(req.params.id),
    );
    const buffer = await proposalService.buildProposalWord(proposal);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${proposal.id}.docx"`);
    res.send(buffer);
  } catch (err: any) {
    fail(res, err, 'Failed to export proposal');
  }
});

export default router;
