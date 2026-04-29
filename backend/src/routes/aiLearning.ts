import { Router, Request, Response, NextFunction } from "express";
import { authenticateToken, requireAdminOrTeamManager, AuthPayload } from "../middleware/auth";
import { uploadTrainingFile } from "../middleware/uploadTrainingFile";
import {
  uploadTrainingExample,
  listTrainingExamples,
  deleteTrainingExample,
  submitFeedback,
  getStats,
  getFeedbackStats,
  getPendingReviewReport,
} from "../services/aiLearningService";

const router = Router();

// All routes require admin or team manager auth
router.use(authenticateToken, requireAdminOrTeamManager);

// GET /api/ai-learning/stats - Dashboard statistics
router.get("/stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (e) {
    next(e);
  }
});

// POST /api/ai-learning/training-examples - Upload a training example PDF
router.post(
  "/training-examples",
  uploadTrainingFile,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as Request & { user?: AuthPayload }).user!;
      const result = await uploadTrainingExample({
        userAccountId: auth.userId,
        file: req.file,
        type: req.body.type,
      });
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },
);

// GET /api/ai-learning/training-examples - List training dataset
router.get("/training-examples", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.query.type as string | undefined;
    const examples = await listTrainingExamples(type ? { type } : undefined);
    res.json(examples);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/ai-learning/training-examples/:id - Remove a training example
router.delete("/training-examples/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteTrainingExample(req.params.id as string);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// POST /api/ai-learning/feedback - Submit feedback on a report
router.post("/feedback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as Request & { user?: AuthPayload }).user!;
    const result = await submitFeedback({
      userAccountId: auth.userId,
      reportId: req.body.reportId,
      rating: req.body.rating,
      comment: req.body.comment,
    });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

// GET /api/ai-learning/feedback/stats - Feedback statistics
router.get("/feedback/stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getFeedbackStats();
    res.json(stats);
  } catch (e) {
    next(e);
  }
});

// GET /api/ai-learning/feedback/pending-review - Next report needing review
router.get("/feedback/pending-review", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await getPendingReviewReport();
    res.json(report);
  } catch (e) {
    next(e);
  }
});

export default router;
