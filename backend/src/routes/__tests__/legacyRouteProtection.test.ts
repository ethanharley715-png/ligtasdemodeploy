import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

jest.mock("../../controllers/admin.controller", () => ({
  submitFeedback: jest.fn((_req, res) => res.json({ success: true })),
}));

jest.mock("../../controllers/analysis.controller", () => ({
  analyseReport: jest.fn((_req, res) => res.json({ ok: true })),
}));

import adminRoutes from "../admin.routes";
import analysisRoutes from "../analysis.routes";
import { getJwtSecret } from "../../config/authConfig";

function makeToken(role: "ADMIN" | "TEAM_MANAGER" | "CONSULTANT" = "ADMIN"): string {
  return jwt.sign(
    {
      userId: 9,
      email: "user@ligtas.com",
      role,
    },
    getJwtSecret(),
    {
      issuer: "LoginBackend",
      audience: "LoginFrontend",
    },
  );
}

describe("legacy route protection", () => {
  let app: express.Express;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
    app = express();
    app.use(express.json());
    app.use("/admin", adminRoutes);
    app.use("/analysis", analysisRoutes);
  });

  it("rejects unauthenticated access to admin feedback", async () => {
    const res = await request(app).post("/admin/feedback").send({
      issueId: "issue-1",
      rating: "correct",
    });

    expect(res.status).toBe(401);
  });

  it("rejects non-admin access to admin feedback", async () => {
    const res = await request(app)
      .post("/admin/feedback")
      .set("Authorization", `Bearer ${makeToken("CONSULTANT")}`)
      .send({
        issueId: "issue-1",
        rating: "correct",
      });

    expect(res.status).toBe(403);
  });

  it("allows admin access to admin feedback", async () => {
    const res = await request(app)
      .post("/admin/feedback")
      .set("Authorization", `Bearer ${makeToken("ADMIN")}`)
      .send({
        issueId: "issue-1",
        rating: "correct",
      });

    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated access to legacy analysis", async () => {
    const res = await request(app).post("/analysis").send({ report: "demo" });

    expect(res.status).toBe(401);
  });

  it("allows authenticated access to legacy analysis", async () => {
    const res = await request(app)
      .post("/analysis")
      .set("Authorization", `Bearer ${makeToken("CONSULTANT")}`)
      .send({ report: "demo" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
