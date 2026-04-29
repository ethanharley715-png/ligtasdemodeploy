/**
 * Run from backend: npm run resend:verify
 * Checks RESEND_API_KEY against the Resend API (no email sent).
 */
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

const backendEnv = path.join(__dirname, "..", ".env");
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else {
  dotenv.config();
}

const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
const from = (process.env.SMTP_FROM ?? "").trim();

console.log("Loaded .env from:", fs.existsSync(backendEnv) ? backendEnv : "(cwd default)");
console.log("RESEND_API_KEY set:", apiKey ? `yes (${apiKey.slice(0, 4)}…)` : "NO");
console.log("SMTP_FROM:", from || "(empty)");
console.log("");

if (!apiKey) {
  console.error("Set RESEND_API_KEY in backend/.env (get a key at https://resend.com/api-keys)");
  process.exit(1);
}

void (async () => {
  const res = await fetch("https://api.resend.com/domains", {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Resend API check FAILED:", res.status, text.slice(0, 500));
    process.exit(1);
  }

  console.log("Resend API check: OK (key accepted)");
  process.exit(0);
})();
