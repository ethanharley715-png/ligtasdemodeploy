# Backend Setup (Ligtas QC)

## 1. Database and Prisma

- Set `DATABASE_URL` in `backend/.env` using a PostgreSQL-compatible database.
- For local development, generate the Prisma client and run migrations:

  ```bash
  npm run prisma:generate
  npm run prisma:migrate
  ```

- For production-style or hosted database setup, apply committed migrations without creating new development migrations:

  ```bash
  npx prisma migrate deploy
  ```

- If Prisma reports drift in a local development database, either fix the migrations manually or reset the local database:

  ```bash
  npx prisma migrate reset
  ```

  This is destructive and should not be used on a client database unless the client explicitly wants all data removed.

- Seed demo users and reports:

  ```bash
  npm run prisma:seed
  ```

  Demo users use password `admin123`. Useful logins include:

  - `admin@ligtas.com`
  - `teammanager@ligtas.com`
  - `consultant@ligtas.com`

## 2. Run the API

```bash
npm run dev
```

The API runs on port `4000` by default. The frontend should use `VITE_API_URL=http://localhost:4000/api` when running locally.

## 3. AI Scanning

The handover path uses local Ollama for AI-assisted scanning. Keep Ollama running while using AI scan mode:

```bash
ollama serve
```

Recommended backend environment:

```env
AI_ENABLED=true
RULE_FALLBACK_ENABLED=true
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="llama3:8b-instruct-q4_0"
```

Rule scanning remains available as the maintainable fallback when Ollama is unavailable.

For local model changes and future cloud-provider integration notes, see `../docs/ai-provider-switching.md`.

## 4. Authentication

- Active browser login route: `POST /api/logins/login`
- Browser sessions use the `loginToken` cookie, not browser-stored bearer tokens.
- Cookies are configured as `httpOnly`, with explicit `sameSite`, expiry/max-age, and `secure` in production.
- Logout uses `POST /api/logins/logout` and explicitly clears the auth cookie.
- Protected browser routes should rely on cookie auth with `credentials: "include"`.

### Login Hardening

The active login route includes:

- per-IP throttling
- per-IP + email throttling
- progressive lockout durations
- hard lockout during the cooldown window
- optional CAPTCHA escalation when configured

Lockout responses may include:

```json
{
  "message": "Too many sign-in attempts. Please wait before trying again.",
  "retryAfterSeconds": 300,
  "captchaRequired": false
}
```

### Security Audit Visibility

- Recent authentication/security events are available to admins only at `GET /api/logins/security-events`.
- This is a bounded operational window, not permanent compliance-grade storage.
- Runtime events are also emitted to backend stdout/stderr in structured form.

### Required Environment

- `JWT_SECRET` must be configured for authentication to work.
- In production, startup fails if `JWT_SECRET` is missing.

Optional login CAPTCHA configuration:

- `LOGIN_CAPTCHA_PROVIDER=turnstile`
- `LOGIN_TURNSTILE_SECRET_KEY=...`
- `LOGIN_CAPTCHA_AFTER_LOCKOUTS=2`

Optional audit window size:

- `AUTH_AUDIT_EVENT_LIMIT=200`

### Demo Accounts

- Seeded accounts are for local development/demo only.
- The frontend can show helper credential hints in development/demo mode.
- Production deployments should disable demo credential hints and remove or change seeded demo accounts.

### Current Limitation

- Login rate limiting is currently in memory.
- This is acceptable for local or single-instance deployment, but multi-instance production would require shared rate-limit storage such as Redis or a database-backed cache.

## 5. Tables

- **users / UserAccount** - email, password hash, name, role code (`adm`, `tm`, `usr`), reset fields, MFA fields, manager/team links.
- **Team** - team name, optional manager, timestamps.
- **Report** - file name, status (`PROCESSING`, `COMPLETED`, `FAILED`), totals, pass/fail result, optional owner.
- **Issue** - persisted QC issue type, rule key, description, location, context, suggestion, page/section, review status, linked to Report.
- **ReportSession** - short-lived extracted report text used during upload/analysis.
- **TrainingExample**, **AdminFeedback**, **TrainingRun** - AI learning/training support.
- **AiIssue**, **Feedback** - legacy/admin AI issue feedback path.

Analytics endpoints aggregate from `Report` and `Issue` for KPIs, issue types, trends, and pass rate.

For the full current model and migration caveats, see `../docs/database-erd.md`.

## 6. Related Developer Documentation

- `../docs/developer-guide.md` - overall developer handover guide.
- `../docs/api-reference.md` - endpoint summary.
- `../docs/environment-reference.md` - backend and frontend environment variables.
- `../docs/database-erd.md` - database model and caveats.
- `../docs/ai-provider-switching.md` - AI model/provider switching notes.
