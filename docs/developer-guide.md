# Developer Guide

This guide is for maintainers taking over the Ligtas QC codebase. It complements the root `README.md`, `backend/SETUP.md`, and the user-facing guide in `docs/user-guide.md`.

## Repository Layout

```text
backend/                 Express API, Prisma schema, services, tests
backend/prisma/          Database schema, generated client, migrations, seed data
backend/src/ai/          Ollama-based AI scanning, prompts, parsing, tests
backend/src/config/      Runtime configuration helpers
backend/src/controllers/ Request/response handlers for selected routes
backend/src/middleware/  Auth, upload, and error middleware
backend/src/repositories Data-access wrappers used by services
backend/src/routes/      Express route registration
backend/src/rules/       Deterministic QC rule engine
backend/src/services/    Main business logic and orchestration
backend/src/utils/       PDF, export, text, auth, and parsing utilities
frontend/                React, TypeScript, Vite app
frontend/src/components/ UI, layout, reports, analytics, and AI learning views
frontend/src/context/    Upload and language context
frontend/src/pages/      Route-level frontend pages
frontend/src/services/   Frontend API client wrappers
frontend/src/utils/      Browser-side helpers and tests
docs/                    Handover, user, database, AI, and developer docs
```

## Main Runtime Flow

The core report workflow is:

```text
User signs in
-> frontend stores auth state through backend cookie session
-> user uploads a PDF
-> backend validates and extracts text
-> scan runs through AI or rule-based path
-> report and issues are persisted in PostgreSQL
-> frontend shows QC results, report history, exports, and analytics
```

Source PDFs are not intended to be stored permanently. The backend persists report metadata, extracted analysis data, issues, review status, and analytics inputs.

## Backend Architecture

The backend is a TypeScript Express app started from `backend/src/index.ts`.

Important layers:

- `routes/` maps HTTP endpoints to controllers or inline handlers.
- `controllers/` handles request validation and response shape for selected workflows.
- `services/` contains most business logic, including upload analysis, report persistence, teams, analytics, AI learning, export, and sharing.
- `repositories/` contains smaller persistence wrappers where the code has been split that way.
- `rules/` contains deterministic QC checks.
- `ai/` contains the current Ollama-based AI scan implementation.
- `middleware/` contains authentication, upload validation, and error handling.
- `config/` contains runtime configuration derived from environment variables.

Prefer adding new behaviour in services rather than route handlers when the logic is business-specific or needs testing.

## Frontend Architecture

The frontend is a React, TypeScript, Vite app.

Important areas:

- `frontend/src/App.tsx` wires the main application shell and routing.
- `frontend/src/services/api.ts` centralizes most backend API calls.
- `frontend/src/context/UploadContext.tsx` owns the upload workflow and progress state.
- `frontend/src/components/views/` contains dashboard, reports, analytics, team, settings, and admin views.
- `frontend/src/components/reports/` contains report-detail and export/review components.
- `frontend/src/components/ai-learning/` contains AI learning dashboard components.
- `frontend/src/i18n/translations.ts` contains English and Welsh UI copy.

When adding a new backend endpoint, also add or update a typed wrapper in `frontend/src/services/api.ts` instead of scattering `fetch` calls through components.

## Authentication And Roles

Browser authentication uses an HTTP-only `loginToken` cookie. Frontend requests that require authentication should send credentials.

Primary auth routes:

- `POST /api/logins/login`
- `GET /api/logins/me`
- `POST /api/logins/logout`
- password reset and change-password routes under `/api/logins`

Role checks are enforced in backend middleware such as `authenticateToken`, `requireAdmin`, and `requireAdminOrTeamManager`.

Current role concepts:

- Admin: full administration and analytics workflows.
- Team manager: team-scoped analytics and team views.
- Consultant: upload, review, and own report workflows.

## Report Scanning

The system supports two scan paths:

- AI-assisted scan through local Ollama.
- Rule-based scan through deterministic checks.

The default scan mode is controlled by:

```env
AI_ENABLED=true
RULE_FALLBACK_ENABLED=true
```

The AI path is currently:

```text
reportSessionService / reportAnalysisService
-> analysis.service.ts
-> ai/analyser.ts
-> ai/ollamaClient.ts
```

See `docs/ai-provider-switching.md` for model switching and future cloud-provider notes.

## Database And Prisma

The Prisma schema is in:

```text
backend/prisma/schema.prisma
```

Common commands:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

For production-style deployment, apply committed migrations rather than creating new development migrations:

```bash
npx prisma migrate deploy
```

See `docs/database-erd.md` for relationships and known schema caveats.

## Environment Configuration

Backend environment variables are documented in:

```text
backend/.env.example
docs/environment-reference.md
```

Frontend environment variables are documented in:

```text
frontend/README.md
docs/environment-reference.md
```

Never commit real secrets, database URLs, API keys, email credentials, or client production configuration.

## Testing And Quality Checks

Run checks before opening a merge request or handing over a release:

```bash
cd frontend
npm run lint
npm run typecheck
npm run test:ci
npm run build

cd ../backend
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

Frontend tests use Vitest and Testing Library. Backend tests use Jest and Supertest.

Focused test locations:

- frontend component tests: `frontend/src/**/__tests__`
- backend route tests: `backend/src/routes/__tests__`
- backend service tests: `backend/src/services/__tests__`
- backend AI tests: `backend/src/ai/tests`
- backend rule tests: `backend/src/rules/__tests__`

## Common Development Tasks

### Add A New Backend Endpoint

1. Add the route in `backend/src/routes`.
2. Put non-trivial logic in a service under `backend/src/services`.
3. Add authentication or role middleware where required.
4. Return errors through `ApiError` and the shared error handler where possible.
5. Add or update backend tests.
6. Add a typed frontend wrapper in `frontend/src/services/api.ts`.
7. Update `docs/api-reference.md` if the endpoint is part of the handover surface.

### Add A New Persisted Field

1. Update `backend/prisma/schema.prisma`.
2. Create a migration with `npm run prisma:migrate`.
3. Regenerate Prisma with `npm run prisma:generate`.
4. Update repositories/services/selects that read or write the field.
5. Update frontend API types if the field is exposed to the UI.
6. Add tests for read/write behaviour.
7. Update `docs/database-erd.md` if the relationship or table shape changes.

### Add A New Frontend View

1. Add the view or page component under `frontend/src/components/views` or `frontend/src/pages`.
2. Add API calls to `frontend/src/services/api.ts`.
3. Add copy to `frontend/src/i18n/translations.ts` if the text is user-facing.
4. Wire the route/navigation through the existing app layout.
5. Add focused component tests.

### Change QC Rules

Rule-based checks live in:

```text
backend/src/rules/reportTextRules.ts
backend/src/rules/engine.ts
backend/src/rules/types.ts
```

After changing rules:

1. Add or update tests in `backend/src/rules/__tests__`.
2. Check report persistence normalization in `backend/src/services/reportAnalysisService.ts`.
3. Confirm frontend labels and issue type mappings still display correctly.

## Production Hardening Notes

Before a client production deployment, review:

- real hosting target for frontend and backend
- HTTPS and secure cookie settings
- `ALLOWED_ORIGINS` restricted to the deployed frontend
- secret storage and rotation
- shared rate-limit storage for multi-instance backend deployments
- email provider configuration
- AI provider availability and data protection requirements
- source PDF retention requirements
- database backup and restore process
- seeded demo accounts and demo UI hints disabled

## Related Documentation

- `README.md` - main project overview and setup.
- `backend/SETUP.md` - backend setup and operational notes.
- `frontend/README.md` - frontend setup and scripts.
- `docs/api-reference.md` - API surface summary.
- `docs/environment-reference.md` - environment variables.
- `docs/database-erd.md` - database relationships and caveats.
- `docs/ai-provider-switching.md` - AI model/provider switching.
- `docs/user-guide.md` - user-facing workflow guide.
- `CI.md` - GitLab CI/CD pipeline.

