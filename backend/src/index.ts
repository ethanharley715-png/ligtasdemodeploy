import "./config/loadEnv";
import express from "express";
import analysisRoutes from "./routes/analysis.routes";
import adminRoutes from "./routes/admin.routes";
import metricsRoutes from "./routes/metrics.routes";
import cors from "cors";
import cookieParser from "cookie-parser";
import rulesRouter from "./routes/rules";
import loginRouter from "./routes/login";
import reportsRouter from "./routes/reports";
import analyticsRouter from "./routes/analytics";
import teamAnalyticsRouter from "./routes/teamAnalytics";
import usersRouter from "./routes/users";
import aiLearningRouter from "./routes/aiLearning";
import teamsRouter from "./routes/teams";
import notificationsRouter from "./routes/notifications";
import dataBackupRouter from "./routes/dataBackup.routes";
import { getAllowedOrigins, isAllowedOrigin } from "./config/origins";
import { scanConfig } from "./config/scanConfig";
import { assertAuthConfigOnStartup } from "./config/authConfig";
import { errorHandler } from "./middleware/errorHandler";

assertAuthConfigOnStartup();

const port = process.env.PORT || 4000;

const app = express();
const allowedOrigins = getAllowedOrigins();

app.use(cookieParser());
app.use(express.json());

// CORS
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
    exposedHeaders: ["Content-Disposition", "Content-Type"],
  }),
);

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none';");
  next();
});

// Origin validation
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();
  if (!isAllowedOrigin(origin, allowedOrigins)) {
    return res.status(403).json({ message: "Origin not allowed" });
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "ligtas-backend" });
});

app.get("/", (_req, res) => {
  res.json({ message: "Ligtas QC API", docs: "Use /api/health, /api/logins/login, /api/reports, /api/analytics, /api/users" });
});

app.use("/api/rules", rulesRouter);
app.use("/api/logins", loginRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/team-analytics", teamAnalyticsRouter);
app.use("/api/users", usersRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/admin", dataBackupRouter);
app.use("/api/ai-learning", aiLearningRouter);
app.use("/analysis", analysisRoutes);
app.use("/admin", adminRoutes);
app.use("/metrics", metricsRoutes);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log("Scan config", {
    aiProvider: scanConfig.aiProvider,
    aiEnabled: scanConfig.aiEnabled,
    ruleScanEnabled: scanConfig.ruleScanEnabled,
  });
});
