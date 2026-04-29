/**
 * Run from backend folder: npx ts-node --transpile-only scripts/verifySmtp.ts
 * Prints non-secret diagnostics and calls nodemailer.verify() (no email sent).
 */
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

const backendEnv = path.join(__dirname, "..", ".env");
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else {
  dotenv.config();
}

const host = (process.env.SMTP_HOST ?? "").trim();
const user = (process.env.SMTP_USER ?? "").trim();
const pass = (process.env.SMTP_PASS ?? "").trim();

console.log("Loaded .env from:", fs.existsSync(backendEnv) ? backendEnv : "(cwd default)");
console.log("SMTP_HOST:", host || "(empty)");
console.log("SMTP_USER:", user || "(empty)");
console.log("SMTP_PASS length:", pass.length, "(Gmail app passwords are 16 letters)");
console.log("");

const auth = { user, pass };
const transporter =
  host.toLowerCase() === "smtp.gmail.com"
    ? nodemailer.createTransport({ service: "gmail", auth })
    : nodemailer.createTransport({
        host: host || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true",
        auth,
      });

void transporter.verify().then(
  () => {
    console.log("SMTP verify: OK (credentials accepted by server)");
    process.exit(0);
  },
  (err: Error) => {
    console.error("SMTP verify: FAILED");
    console.error(err.message);
    process.exit(1);
  },
);
