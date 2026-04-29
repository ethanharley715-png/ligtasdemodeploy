import { Router } from "express";
import { submitFeedback } from "../controllers/admin.controller";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

// Deprecated legacy admin route: protected for compatibility while newer flows remain in flight.
router.post("/feedback", authenticateToken, requireAdmin, submitFeedback);

export default router;
