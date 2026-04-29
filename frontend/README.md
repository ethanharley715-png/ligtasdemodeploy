# Ligtas QC Frontend

React, TypeScript, Vite frontend for the Ligtas QC dashboard.

## Main Responsibilities

The frontend provides:

- login, logout, password reset, and profile workflows
- PDF upload with streamed progress feedback
- QC results, report history, report detail, export, and share workflows
- admin analytics, team analytics, teams, users, settings, and security views
- AI learning and training dashboard screens
- English and Welsh UI copy through `src/i18n/translations.ts`

## Local Setup

```bash
npm ci
npm run dev
```

The development server normally runs at `http://localhost:5173`.

If the backend API is not running at `http://localhost:4000/api`, create a local frontend env file and set:

```env
VITE_API_URL="http://localhost:4000/api"
```

Optional demo/development settings:

```env
VITE_SHOW_DEMO_LOGIN_HINTS=true
VITE_LOGIN_TURNSTILE_SITE_KEY="replace-with-turnstile-site-key"
```

## Source Layout

```text
src/App.tsx                 Application shell and routing
src/components/views/       Main dashboard, report, analytics, admin, and team views
src/components/reports/     Report detail, PDF review, export, and issue review controls
src/components/ai-learning/ AI learning dashboard components
src/components/layout/      Header, sidebar, footer, notification layout
src/components/ui/          Shared UI primitives
src/context/                Upload and language contexts
src/pages/                  Page-level components
src/services/api.ts         Backend API client wrappers and DTO types
src/utils/                  Browser-side helpers
src/i18n/translations.ts    UI translation strings
```

Add new backend calls to `src/services/api.ts` instead of placing raw `fetch` calls directly in components, unless the call is genuinely one-off or legacy code being retired.

## Scripts

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
npm run preview
```

Build output is written to `frontend/dist`.

## Testing

Frontend tests use Vitest, Testing Library, and the configured DOM test environment.

Common test locations:

- `src/components/**/__tests__`
- `src/context/**/__tests__`
- `src/pages/**/__tests__`
- `src/services/**/__tests__`
- `src/utils/**/__tests__`

Run the full frontend quality checks before handover:

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

## Handover Notes

- The frontend expects the backend to authenticate through the `loginToken` HTTP-only cookie.
- API calls should include credentials where required.
- In production, set `VITE_API_URL` to the deployed backend `/api` base URL.
- Demo login hints should be disabled for client/production deployment.
- If Turnstile CAPTCHA is enabled on the backend, set `VITE_LOGIN_TURNSTILE_SITE_KEY` for the matching frontend environment.

## Related Documentation

- `../docs/developer-guide.md`
- `../docs/api-reference.md`
- `../docs/environment-reference.md`
- `../docs/user-guide.md`
