import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const envCandidates = [
  path.join(process.cwd(), ".env"),
  path.join(__dirname, "..", "..", ".env"),
  path.join(__dirname, "..", ".env"),
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

if (process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID != null) {
  // Tests set process.env explicitly where needed; do not load local secrets.
} else if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}
