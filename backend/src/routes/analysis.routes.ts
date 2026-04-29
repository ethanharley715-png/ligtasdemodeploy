import { Router } from "express";
import { analyseReport } from "../controllers/analysis.controller";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Deprecated legacy analysis route: protected to avoid unauthenticated access.
router.post("/", authenticateToken, analyseReport);

export default router;
