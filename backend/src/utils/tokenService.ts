// src/utils/tokenService.ts
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/authConfig";

export interface LoginJwtPayload {
  userId: number;
  email: string;
  role: string; // "ADMIN" | "CONSULTANT" (mapped from user_type "adm" | "usr")
}

export function generateJwtToken(userId: number, email: string, userType: string): string {
  const roleMap: Record<string, string> = { adm: "ADMIN", tm: "TEAM_MANAGER", usr: "CONSULTANT" };
  const role = roleMap[userType] ?? "CONSULTANT";
  return jwt.sign(
    { userId, email, role },
    getJwtSecret(),
    {
      expiresIn: "7d",
      issuer: "LoginBackend",
      audience: "LoginFrontend",
    }
  );
}
