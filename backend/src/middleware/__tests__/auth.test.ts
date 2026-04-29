import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { authenticateToken } from "../auth";
import { getJwtSecret } from "../../config/authConfig";

function makeToken() {
  return jwt.sign(
    { userId: 7, email: "tester@ligtas.com", role: "CONSULTANT" },
    getJwtSecret(),
    {
      issuer: "LoginBackend",
      audience: "LoginFrontend",
    },
  );
}

function makeResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("authenticateToken", () => {
  beforeEach(() => {
    delete process.env.ALLOWED_ORIGINS;
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  it("accepts bearer tokens without origin checks", () => {
    const req = {
      headers: { authorization: `Bearer ${makeToken()}` },
    } as unknown as Request;
    const res = makeResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("accepts cookie tokens from an allowed origin", () => {
    const req = {
      headers: { origin: "http://localhost:5173" },
      cookies: { loginToken: makeToken() },
    } as unknown as Request;
    const res = makeResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("accepts cookie tokens from an allowed referer", () => {
    const req = {
      headers: { referer: "http://localhost:5173/reports/rep_123" },
      cookies: { loginToken: makeToken() },
    } as unknown as Request;
    const res = makeResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects cookie tokens without a trusted browser source", () => {
    const req = {
      headers: {},
      cookies: { loginToken: makeToken() },
    } as unknown as Request;
    const res = makeResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(403);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      message: "Trusted browser origin required for cookie authentication",
    });
  });

  it("rejects cookie tokens from untrusted origins", () => {
    const req = {
      headers: { origin: "https://evil.example.com" },
      cookies: { loginToken: makeToken() },
    } as unknown as Request;
    const res = makeResponse();
    const next = jest.fn() as NextFunction;

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(403);
  });
});
