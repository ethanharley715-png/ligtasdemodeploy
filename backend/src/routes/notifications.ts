import { Router } from "express";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/** Fixed IDs and timestamps so read state stays stable; body copy is the live “source of truth” from the API. */
const ANNOUNCEMENTS = [
  {
    id: "ann-tm-2026-03",
    kind: "team_manager" as const,
    title: "Team manager announcement",
    body:
      "Please review the updated QC checklist with your team before Friday. Contact your team lead if you need access to the shared template folder.",
    createdAt: "2026-03-27T11:30:00.000Z",
  },
  {
    id: "ann-admin-2026-03",
    kind: "admin" as const,
    title: "Admin notice",
    body:
      "Scheduled maintenance: Sunday 02:00–04:00 (local time). Uploads may be briefly unavailable; completed reports are unaffected.",
    createdAt: "2026-03-26T09:00:00.000Z",
  },
  {
    id: "ann-feat-settings-2026",
    kind: "feature" as const,
    title: "New feature available",
    body:
      "Email notification preferences are now under Settings → Notifications. You can choose which alerts we send to your inbox.",
    createdAt: "2026-03-28T08:00:00.000Z",
  },
];

router.get("/", authenticateToken, (_req, res) => {
  res.json({
    serverTime: new Date().toISOString(),
    announcements: ANNOUNCEMENTS,
  });
});

export default router;
