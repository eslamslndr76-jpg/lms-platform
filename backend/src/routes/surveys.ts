import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';
import * as surveyService from '../services/surveyService';

const router = Router();

function fail(res: Response, err: any, fallback: string) {
  console.error('[Survey]', err?.message || err);
  res.status(err?.status || 500).json({ error: err?.message || fallback });
}

// ═══════════════════════════════════════════════
// Student — post-course survey (edit-plan.md §4.4)
// ═══════════════════════════════════════════════

// GET /api/surveys/my — completed groups with their survey state
router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const surveys = await surveyService.getPendingSurveys(req.user!.userId);
    res.json(surveys);
  } catch (err: any) {
    fail(res, err, 'Failed to fetch surveys');
  }
});

// GET /api/surveys/my/:groupId — survey definition + saved draft
router.get('/my/:groupId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const survey = await surveyService.getMySurvey(req.user!.userId, Number(req.params.groupId));
    res.json(survey);
  } catch (err: any) {
    fail(res, err, 'Failed to fetch survey');
  }
});

// PUT /api/surveys/my/:groupId/draft — auto-save (never overwrites a submission)
router.put('/my/:groupId/draft', authMiddleware, async (req: Request, res: Response) => {
  try {
    const response = await surveyService.saveSurveyDraft(
      req.user!.userId,
      Number(req.params.groupId),
      req.body || {},
    );
    res.json({ message: 'Saved', response });
  } catch (err: any) {
    fail(res, err, 'Failed to save survey draft');
  }
});

// POST /api/surveys/my/:groupId/submit — one response per student, final
router.post('/my/:groupId/submit', authMiddleware, async (req: Request, res: Response) => {
  try {
    const response = await surveyService.submitSurvey(
      req.user!.userId,
      Number(req.params.groupId),
      req.body || {},
    );
    res.json({ message: 'Submitted', response });
  } catch (err: any) {
    fail(res, err, 'Failed to submit survey');
  }
});

// ═══════════════════════════════════════════════
// Admin — results, reminders, window
// ═══════════════════════════════════════════════

// GET /api/surveys/group/:groupId/stats
router.get('/group/:groupId/stats', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const stats = await surveyService.getGroupSurveyStats(Number(req.params.groupId));
    res.json(stats);
  } catch (err: any) {
    fail(res, err, 'Failed to fetch survey stats');
  }
});

// POST /api/surveys/group/:groupId/remind — reminds the students who haven't answered
router.post('/group/:groupId/remind', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const result = await surveyService.sendSurveyReminder(Number(req.params.groupId), 'manual');
    res.json({ message: `Sent ${result.sent} reminders`, ...result });
  } catch (err: any) {
    fail(res, err, 'Failed to send reminders');
  }
});

// PUT /api/surveys/group/:groupId/window — extend (or shorten) the window
router.put('/group/:groupId/window', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const closesAt = req.body?.closes_at;
    if (!closesAt) return res.status(400).json({ error: 'closes_at is required' });
    const result = await surveyService.extendSurveyWindow(Number(req.params.groupId), String(closesAt));
    res.json({ message: 'Survey window updated', ...result });
  } catch (err: any) {
    fail(res, err, 'Failed to update survey window');
  }
});

// POST /api/surveys/process-reminders — sends the two scheduled reminders
router.post('/process-reminders', authMiddleware, requireRole(ADMIN), async (_req: Request, res: Response) => {
  try {
    const result = await surveyService.runSurveyReminderSweep();
    res.json({ message: 'Reminder sweep finished', ...result });
  } catch (err: any) {
    fail(res, err, 'Failed to process survey reminders');
  }
});

export default router;
