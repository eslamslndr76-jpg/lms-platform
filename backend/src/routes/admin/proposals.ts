import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, requirePermission, ADMIN, EMPLOYEE } from '../../middleware/rbac';
import * as proposalService from '../../services/proposalService';

const router = Router();

function fail(res: Response, err: any, fallback: string) {
  console.error('[Proposals]', err?.message || err);
  res.status(err?.status || 500).json({ error: err?.message || fallback });
}

// GET /api/admin/proposals — every proposal, submitted first
router.get('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('proposals', 'read'), async (_req: Request, res: Response) => {
  try {
    res.json(await proposalService.getProposals());
  } catch (err: any) {
    fail(res, err, 'Failed to fetch proposals');
  }
});

// GET /api/admin/proposals/:id
router.get('/:id', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('proposals', 'read'), async (req: Request, res: Response) => {
  try {
    res.json(await proposalService.getProposal(Number(req.params.id)));
  } catch (err: any) {
    fail(res, err, 'Failed to fetch proposal');
  }
});

// PUT /api/admin/proposals/:id — the admin may adjust the content before deciding
router.put('/:id', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('proposals', 'write'), async (req: Request, res: Response) => {
  try {
    const proposal = await proposalService.adminUpdateProposal(Number(req.params.id), {
      course_title: req.body?.course_title,
      objectives: req.body?.objectives,
      daily_content: req.body?.daily_content,
    });
    res.json({ message: 'Proposal updated', proposal });
  } catch (err: any) {
    fail(res, err, 'Failed to update proposal');
  }
});

// POST /api/admin/proposals/:id/review — approve | reject | needs_changes
router.post('/:id/review', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('proposals', 'write'), async (req: Request, res: Response) => {
  try {
    const action = req.body?.action;
    if (!['approve', 'reject', 'needs_changes'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve, reject or needs_changes' });
    }
    if (action === 'needs_changes' && !String(req.body?.note || '').trim()) {
      return res.status(400).json({ error: 'اكتب ملاحظة توضح المطلوب تعديله' });
    }
    const proposal = await proposalService.reviewProposal(
      req.user!.userId,
      Number(req.params.id),
      action,
      req.body?.note,
    );
    res.json({ message: 'Proposal reviewed', proposal });
  } catch (err: any) {
    fail(res, err, 'Failed to review proposal');
  }
});

// POST /api/admin/proposals/:id/create-course — manual creation from an approved proposal
router.post('/:id/create-course', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('proposals', 'write'), requirePermission('courses', 'write'), async (req: Request, res: Response) => {
  try {
    const course = await proposalService.createCourseFromProposal(Number(req.params.id), req.body || {});
    res.status(201).json({ message: 'Course created from proposal', course });
  } catch (err: any) {
    fail(res, err, 'Failed to create course from proposal');
  }
});

// GET /api/admin/proposals/:id/word — printable proposal (Arabic RTL)
router.get('/:id/word', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('proposals', 'read'), async (req: Request, res: Response) => {
  try {
    const proposal = await proposalService.getProposal(Number(req.params.id));
    const buffer = await proposalService.buildProposalWord(proposal);
    const fileName = `proposal-${proposal.id}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err: any) {
    fail(res, err, 'Failed to export proposal');
  }
});

export default router;
