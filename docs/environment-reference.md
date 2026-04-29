# Environment Reference

This file explains the main environment variables used by the handover build. Use `backend/.env.example` as the starting point for backend configuration.

Do not commit real secrets or production connection strings.

## Backend Required Variables

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | `postgresql://user:password@host:5432/ligtas` | PostgreSQL connection string for Prisma. Hosted Neon URLs should include the required SSL options. |
| `JWT_SECRET` | Yes | `replace-with-a-long-random-secret` | Used to sign login cookies/JWTs. Production startup should fail if this is missing. |
| `PORT` | No | `4000` | Backend HTTP port. Defaults to `4000` when unset. |

## Backend Web And CORS Variables

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `ALLOWED_ORIGINS` | Recommended | `http://localhost:5173` | Comma-separated frontend origins allowed by CORS. Restrict this to deployed frontend domains in production. |
| `PASSWORD_RESET_FRONTEND_URL` | Required for reset links | `http://localhost:5173` | Base frontend URL used in password reset emails. |
| `FRONTEND_URL` | Optional fallback | `http://localhost:5173` | Fallback used by password reset config if `PASSWORD_RESET_FRONTEND_URL` is not set. Prefer `PASSWORD_RESET_FRONTEND_URL` for clarity. |

## Backend AI Variables

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `AI_ENABLED` | No | `true` | Enables AI-assisted scanning. Defaults to enabled in current config. |
| `RULE_FALLBACK_ENABLED` | No | `true` | Enables deterministic rule-based scanning. At least one of AI or rule scanning must be enabled. |
| `OLLAMA_BASE_URL` | Required for Ollama AI scans | `http://127.0.0.1:11434` | Local or remote Ollama service URL. |
| `OLLAMA_MODEL` | Required for Ollama AI scans | `llama3:8b-instruct-q4_0` | Ollama model name used by `backend/src/ai/ollamaClient.ts`. |
| `OPENAI_API_KEY` | Optional | `replace-with-openai-key` | Currently used only by embedding experiment code, not by the main AI scan path. |

See `docs/ai-provider-switching.md` before changing models or adding cloud AI support.

## Backend Email Variables

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `EMAIL_PROVIDER` | No | `disabled`, `resend`, or `smtp` | Handover default is `disabled`. |
| `SMTP_FROM` | Required for sending email | `noreply@example.com` | Sender address for Resend or SMTP. |
| `RESEND_API_KEY` | Required for Resend | `replace-with-resend-key` | Used when `EMAIL_PROVIDER=resend`. |
| `SMTP_HOST` | Required for SMTP | `smtp.sendgrid.net` | SMTP host. |
| `SMTP_PORT` | Required for SMTP | `587` | SMTP port. |
| `SMTP_SECURE` | Required for SMTP | `false` | Whether to use a secure SMTP connection. |
| `SMTP_USER` | Required for SMTP | `apikey` | SMTP username. |
| `SMTP_PASS` | Required for SMTP | `replace-with-password` | SMTP password/API key. |
| `SMTP_TLS_REJECT_UNAUTHORIZED` | No | `true` | Keep enabled for production unless the client accepts the risk. |
| `SMTP_DEBUG` | No | `1` | Enables extra SMTP debug output. Do not leave noisy debug logging enabled in production. |

Verification helpers:

```bash
cd backend
npm run resend:verify
npm run smtp:verify
```

## Backend Login And Security Variables

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `LOGIN_CAPTCHA_PROVIDER` | No | `turnstile` | Enables optional CAPTCHA escalation when set to a supported provider. |
| `LOGIN_TURNSTILE_SECRET_KEY` | Required for Turnstile | `replace-with-turnstile-secret` | Server-side Cloudflare Turnstile secret. |
| `LOGIN_CAPTCHA_AFTER_LOCKOUTS` | No | `2` | Number of lockouts before CAPTCHA is required. |
| `AUTH_AUDIT_EVENT_LIMIT` | No | `200` | Number of recent auth/security events retained in the bounded in-memory view. |

## Backend Operational Limits

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `EMAIL_SHARE_MAX_PER_HOUR` | No | `10` | Limits email share operations. |
| `MAX_REPORT_FILE_SIZE_BYTES` | No | `52428800` | Upload size limit. Default example is 50 MB. |
| `REPORT_SESSION_TTL_HOURS` | No | `4` | Lifetime for short-lived extracted report sessions. |
| `NODE_ENV` | Recommended in deployment | `production` | Enables production-sensitive behaviour such as secure cookie handling and stricter startup checks. |

## Frontend Variables

Create a frontend `.env` file only when local defaults need to be changed.

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `VITE_API_URL` | Recommended outside default local setup | `http://localhost:4000/api` | Backend API base URL used by frontend calls. Set to deployed backend `/api` URL in production. |
| `VITE_API_BASE_URL` | Legacy fallback | `http://localhost:4000/api` | Fallback used by the upload helper if `VITE_API_URL` is not set. Prefer `VITE_API_URL`. |
| `VITE_SHOW_DEMO_LOGIN_HINTS` | No | `true` | Shows demo credential hints. Disable for client/production deployments. |
| `VITE_LOGIN_TURNSTILE_SITE_KEY` | Required if Turnstile is enabled | `replace-with-site-key` | Browser-side Cloudflare Turnstile site key. |

## Local Development Example

Backend:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ligtas"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=4000
ALLOWED_ORIGINS="http://localhost:5173"
PASSWORD_RESET_FRONTEND_URL="http://localhost:5173"
AI_ENABLED=true
RULE_FALLBACK_ENABLED=true
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="llama3:8b-instruct-q4_0"
EMAIL_PROVIDER=disabled
```

Frontend:

```env
VITE_API_URL="http://localhost:4000/api"
VITE_SHOW_DEMO_LOGIN_HINTS=true
```

## Production Checklist

Before deploying to a client environment:

- replace all demo secrets
- use a strong `JWT_SECRET`
- restrict `ALLOWED_ORIGINS`
- configure HTTPS
- disable demo login hints
- configure email only if required
- confirm AI provider/data handling requirements
- apply Prisma migrations
- verify password reset URLs point to the deployed frontend
- move rate-limit state to shared storage for multi-instance deployments
