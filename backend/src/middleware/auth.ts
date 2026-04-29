import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { hasTrustedBrowserSource } from "../config/origins";
import { AUTH_COOKIE_NAME, getJwtSecret } from "../config/authConfig";

export interface AuthPayload {
  userId: number;
  email: string;
  role: string;
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = (req as { cookies?: Record<string, string | undefined> }).cookies?.[AUTH_COOKIE_NAME];
  const token = bearerToken ?? cookieToken;

  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (!bearerToken && cookieToken) {
    const trustedBrowserSource = hasTrustedBrowserSource({
      origin: req.headers.origin,
      referer: req.headers.referer,
    });

    if (!trustedBrowserSource) {
      res.status(403).json({ message: "Trusted browser origin required for cookie authentication" });
      return;
    }
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      issuer: "LoginBackend",
      audience: "LoginFrontend",
    }) as AuthPayload;
    (req as Request & { user?: AuthPayload }).user = payload;
    next();
  } catch {
    res.status(403).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as Request & { user?: AuthPayload }).user?.role !== "ADMIN") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}

export function requireAdminOrTeamManager(req: Request, res: Response, next: NextFunction) {
  const role = (req as Request & { user?: AuthPayload }).user?.role;
  if (role !== "ADMIN" && role !== "TEAM_MANAGER") {
    res.status(403).json({ message: "Admin or Team Manager access required" });
    return;
  }
  next();
}
