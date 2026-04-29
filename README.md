# Ligtas Team Project

## Overview
Ligtas is a team-based software engineering project focused on supporting the quality control (QC) of professional reports.
The system acts as an automated pre-QC checker, identifying common non-technical issues before formal quality assurance, with the aim of reducing manual review time while preserving professional judgement.

The project prioritises explainability, trust, maintainability, and alignment with real-world professional workflows rather than full automation or final decision-making.

---

## Scope

### In Scope
- Automated detection of common non-technical report issues, including missing information, inconsistencies, template artefacts, unremoved guidance text, and incomplete limitations.
- Rule-based and AI-assisted report scanning, with deterministic rule checks available as the maintainable fallback.
- Clear, traceable feedback linking detected issues to source text, report sections, and page/location data where available.
- Upload, review, fix, export, and share workflows for analysed reports.
- Role-based dashboards for consultants, team managers, and administrators.
- Team analytics, weekly digest export, AI learning/training views, user administration, team management, and recent security-event visibility.

### Out of Scope
- Editing, rewriting, or automatically correcting report content.
- Making technical, legal, regulatory, or compliance judgements on report correctness.
- Acting as a compliance authority or final decision-maker.
- Long-term storage of uploaded source PDF files as a document-management system.

---

## Intended Users
- **Primary users:** Professional consultants preparing reports for quality control.
- **Team managers:** Users reviewing team-level activity, team reports, and model-improvement workflows.
- **Administrators:** Users managing accounts, teams, analytics, backup/export operations, and security events.
- **Client/maintainers:** Technical or operational stakeholders who need to run, deploy, and maintain the delivered software.

---

## Current Feature Set
- Cookie-based login/logout with role-based access control.
- Password reset flow, login throttling, lockout handling, optional CAPTCHA escalation, and admin security-event view.
- PDF upload and extraction with a 50 MB file limit.
- Rule-based QC checks for common report-quality issues.
- Optional AI-assisted scan mode where the configured AI service is available.
- QC Results view for immediate post-upload review.
- Report History and Report Detail views for persisted analysis results.
- Issue review states: open, completed, and false positive.
- CSV/PDF export for report results.
- Email sharing for report exports and weekly digests when email is configured.
- Admin QC Trend Dashboard with KPI, issue-category, trend, recurring-issue, section-density, consultant-signal, and weekly digest outputs.
- Team Analytics for admin and team-manager workflows.
- AI Learning & Training views for training examples and feedback.
- Teams, My Team, User Management, Settings, My Profile, About, Help, and notification surfaces.

---

## High-Level Architecture
The system follows a layered, session-based approach:

1. User authenticates through the backend login API.
2. Consultant uploads a PDF report from the React frontend.
3. Backend validates the file, extracts text, and creates a short-lived report session.
4. AI-assisted or rule-based checks analyse the extracted text.
5. Structured report and issue results are persisted in PostgreSQL through Prisma.
6. The frontend presents findings through QC Results, Report History, report detail, analytics, and role-specific views.

Uploaded source PDFs are processed in memory and temporary files only where needed for compression/extraction. Persisted data is the extracted analysis result, metadata, issues, review states, and analytics data rather than a permanent copy of the original PDF.

---

## Quality & Trust Principles
The design of the system is guided by the following principles:

- **Explainability:** Issues should clearly reference source text, section names, page numbers, or context where available.
- **Determinism:** Rule-based checks should produce consistent results for identical inputs.
- **Professional accountability:** The system supports, but does not replace, human judgement.
- **Security and privacy:** Authentication uses HTTP-only cookies; uploaded report files are not intended to be retained long-term.
- **Maintainability:** Core setup, API boundaries, and known limitations should be documented for client handover.

---

## Project Status
Active development / delivery handover stage for the CM6331 Large Team Project.

The delivered bundle should include the released version demonstrated in the delivery meeting, all source code, this README, and supporting documentation. Current behaviour, limitations, and operational setup are documented below so the client or future maintainers can build, run, and extend the project.

---

## Repository
- GitLab repository: https://git.cardiff.ac.uk/c23073115/ligtas-team-project.git
- Frontend app: `frontend/`
- Backend API: `backend/`
- Prisma schema and migrations: `backend/prisma/`
- Developer guide: `docs/developer-guide.md`
- API reference: `docs/api-reference.md`
- Environment reference: `docs/environment-reference.md`
- Formal user documentation: `docs/user-guide.md`
- Backend setup notes: `backend/SETUP.md`
- CI/CD notes: `CI.md`

---

## Getting Started
Implementation is split across frontend and backend apps.

### Prerequisites
- Node.js 20 or compatible current LTS version.
- npm.
- PostgreSQL database, either local PostgreSQL or a hosted database such as Neon.
- Backend `.env` file based on `backend/.env.example`.
- Optional: Ollama or another configured AI provider if AI-assisted scanning is required.
- Optional: email provider credentials for password reset, report sharing, and weekly digest sharing.
- Optional on Windows: Ghostscript (`gswin64c`) for PDF compression. If Ghostscript is missing, the backend falls back to the original PDF buffer.

### 1. Configure Backend Environment
Create `backend/.env` and configure at minimum:

```env
DATABASE_URL="postgresql://user:password@host:5432/database"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=4000
```

Common optional variables:

```env
ALLOWED_ORIGINS="http://localhost:5173"
AI_ENABLED=true
RULE_FALLBACK_ENABLED=true
EMAIL_PROVIDER=resend
RESEND_API_KEY="..."
SMTP_FROM="noreply@example.com"
PASSWORD_RESET_FRONTEND_URL="http://localhost:5173"
```

Do not use demo credentials, committed sample secrets, or development API keys in a client or production deployment. Rotate any credentials that were used during development before handover.

### 2. Install, Migrate, and Seed the Backend
```bash
cd backend
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The API runs at `http://localhost:4000` by default.

Useful health check:

```bash
curl http://localhost:4000/api/health
```

Seeded local/demo users use password `admin123`. Useful examples are:

- `admin@ligtas.com` - admin
- `teammanager@ligtas.com` - team manager
- `consultant@ligtas.com` - consultant

Seeded accounts and report data are for local development and demonstration only.

### 3. Install and Start the Frontend
In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

The Vite development server normally runs at `http://localhost:5173`.

If the API is not running on `http://localhost:4000/api`, configure:

```env
VITE_API_URL="http://localhost:4000/api"
```

### 4. Production Build
```bash
# Frontend
cd frontend
npm run build

# Backend
cd ../backend
npm run build
npm start
```

Frontend build output is written to `frontend/dist/`. Backend build output is written to `backend/dist/`.

---

## Local Quality Checks
Run these before packaging or handing over the bundle:

```bash
# Frontend
cd frontend
npm run lint
npm run typecheck
npm run test:ci
npm run build

# Backend
cd ../backend
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

The GitLab CI pipeline performs install, lint, typecheck, test, build, and a placeholder staging deploy stage.

---

## Handover and Deployment Notes
The delivery meeting handover should make it clear how the client can run and maintain the solution after the demonstration.

### Recommended Bundle Contents
- Released source code from the demonstrated version.
- Link to the GitLab repository.
- Root `README.md`.
- `docs/developer-guide.md`.
- `docs/api-reference.md`.
- `docs/environment-reference.md`.
- `docs/user-guide.md`.
- `docs/ai-provider-switching.md`.
- `backend/SETUP.md`.
- `backend/NEON_SETUP.md` if the hosted Neon database is used.
- `CI.md`.
- `.env.example` files with placeholders only.
- Any demonstration notes, sample PDFs, or client-specific deployment notes agreed with the client.

### Deployment Shape
A typical deployment has:

- A static frontend host serving `frontend/dist`.
- A Node.js backend service running `backend/dist/index.js`.
- A PostgreSQL database with Prisma migrations applied.
- Environment variables configured in the hosting provider.
- HTTPS enabled so authentication cookies can be marked secure in production.
- CORS `ALLOWED_ORIGINS` restricted to the deployed frontend domain.
- Email provider credentials configured only if password reset or email sharing is required.

### Maintenance Notes
- Apply database migrations through Prisma before starting a new backend release.
- Keep `JWT_SECRET`, database credentials, AI keys, and email credentials outside source control.
- Review and rotate any development secrets before client handover.
- Use rule-based scan mode as the reliable fallback if AI infrastructure is unavailable.
- Login rate limiting is currently in memory, so multi-instance production deployments should move rate-limit state to shared storage such as Redis or a database-backed cache.
- Security events are a bounded operational view, not a permanent compliance archive.
- Original uploaded PDFs are not intended to be stored permanently. If the client wants document retention, that should be designed as a separate feature with explicit data-protection controls.

### Known Limitations for Handover
- AI-assisted scanning depends on the configured AI service and credentials being available.
- Some page anchors or highlights may be missing when reliable page/location data cannot be derived from the PDF text.
- Email sharing gracefully degrades when email configuration is missing; download/export remains available.
- Demo users and seeded reports are not production data.
- Deployment automation is not yet tied to a real staging or production hosting target; `.gitlab-ci.yml` currently contains a placeholder deploy step.

---

## Further Documentation
Additional repo-managed documentation:

- [Documentation Index](docs/README.md)

Developer and maintainer docs:

- [Developer Guide](docs/developer-guide.md)
- [API Reference](docs/api-reference.md)
- [Environment Reference](docs/environment-reference.md)
- [Database ERD](docs/database-erd.md)
- [AI Provider Switching Guide](docs/ai-provider-switching.md)

User, setup, and delivery docs:

- [User Documentation](docs/user-guide.md)
- [Backend Setup](backend/SETUP.md)
- [Frontend README](frontend/README.md)
- [Neon Database Setup](backend/NEON_SETUP.md)
- [CI/CD Pipeline](CI.md)

Additional project/process documentation may also be maintained in the GitLab Wiki:

- Related Work & Existing Approaches
- QC Rules & Detection Strategies
- Non-Functional Requirements
- Architecture & Design Notes

---

## Contribution & Collaboration
Team contributions are tracked through GitLab issues, merge requests, commits, project documentation, and sprint/process evidence.
Individual contributions are recorded separately as part of the module assessment requirements.

---

## Repository & Tooling Notes
This project uses GitLab for version control, issue tracking, collaboration, and CI/CD.

Main technologies:

- React, TypeScript, Vite, Tailwind CSS, Material UI, Radix UI, and Recharts on the frontend.
- Node.js, Express, TypeScript, Prisma, PostgreSQL, Jest, and PDF processing utilities on the backend.
- Vitest and Testing Library for frontend tests.
- GitLab CI/CD for linting, typechecking, tests, and builds.

---

## Backend Upload API

`POST /api/reports/upload`

- Auth: cookie-based session via `/api/logins/login`
- Content-Type: `multipart/form-data`
- File field: `file` (single PDF, max 50 MB by default)
- Optional query: `scanMode=ai|rules`
- Optional query for AI mode: `aiLocationMode=canonical_only|full`

The current upload route streams newline-delimited JSON progress messages and finishes with a `stage: "done"` payload:

```json
{
  "stage": "done",
  "result": {
    "reportSessionId": "uuid",
    "reportId": "cuid",
    "filename": "report.pdf",
    "wordCount": 1234,
    "estimatedPages": 3,
    "issues": [],
    "codeIssues": {
      "issues": []
    }
  }
}
```

Upload error codes:

- `file_required`
- `invalid_file_type`
- `file_too_large`
- `invalid_scan_mode`
- `ai_scan_unavailable`
- `rule_scan_unavailable`
- `internal_error`

---

## Session QC Analysis API
Rule-based QC detection is session-scoped for frontend integration.
The QC Results page can consume these endpoints without requiring knowledge of internal `Report` identifiers.

- `POST /api/reports/sessions/:reportSessionId/analyze`
  - Runs deterministic non-technical checks on extracted report text.
  - Persists results internally to `Report` and `Issue`.
  - Returns `201` on first analysis and `200` on repeated calls for the same session.
  - Supports optional `scanMode=ai|rules` and `aiLocationMode=canonical_only|full`.
- `GET /api/reports/sessions/:reportSessionId/qc-results`
  - Returns the persisted structured QC result contract for that session.
  - Returns `404` with `qc_results_not_found` if analysis has not been run yet.

### QC Error Envelope

```json
{
  "code": "report_session_not_found",
  "message": "Report session not found or expired."
}
```

Other QC-specific error codes:

- `report_session_not_found`
- `qc_results_not_found`
- `invalid_request`
- `invalid_scan_mode`
- `analysis_failed`

---

## Report Export and Share Workflow
Persisted report detail pages support consultant-facing export and share actions for a single analysed report.

- `GET /api/reports/:id/export?format=csv|pdf`
  - Returns a downloadable attachment for the requested report.
  - Applies the same ownership rules as the report detail page.
- `POST /api/reports/:id/share`
  - Sends the selected export as an email attachment.
  - Requires a valid recipient email and the same report access permissions.

Export/share files include:

- report identifier
- generation timestamp
- summary statistics
- full issue detail rows

### Email Configuration
The backend uses a provider-agnostic mail service contract.
Resend or SMTP can be configured through backend environment variables.

Common Resend variables:

- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `SMTP_FROM`

Common SMTP variables:

- `EMAIL_PROVIDER=smtp`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

If email is not configured for the current environment, the UI keeps download available and the share flow degrades gracefully.

---

## Weekly QC Digest Workflow
The admin-facing QC Trend Dashboard supports an on-demand weekly digest workflow for the last completed or selected calendar week.

- `GET /api/analytics/weekly-digest/export?format=csv|pdf&weekStart=YYYY-MM-DD`
  - Exports a weekly digest attachment for the selected week.
  - Supports optional `consultantId` and `issueType` filters.
- `GET /api/analytics/weekly-digest/availability`
  - Returns whether email sharing is configured in the current environment.

Weekly digest output includes:

- digest generation timestamp
- selected week start/end
- active consultant and issue-category filters
- KPI summary
- recurring issue rate
- daily trend rows
- issue category counts
- section density rows
- consultant quality signals

This workflow is on demand only in the current implementation. It does not create scheduled digests, persistent share links, or permanent audit records.

---

## Ollama Setup Guide
Ollama can be used for local AI model experimentation where the backend AI path is configured to call a local model service.

### 1. Install Ollama on Windows
Go to https://ollama.com/download and install the Windows version.

After installation, open PowerShell and verify:

```powershell
ollama --version
```

If the command is not recognised, add the Ollama install directory to your Windows `Path`, then restart PowerShell or VS Code.

Typical install path:

```text
C:\Users\<your-username>\AppData\Local\Programs\Ollama
```

### 2. Run Ollama as a Server
```powershell
ollama serve
```

The server normally runs at `http://localhost:11434`. Keep the terminal open while using the local model service.

### 3. Pull the LLaMA 3 8B Model
```powershell
ollama pull llama3:8b-instruct-q4_0
ollama list
```

### 4. Run the Model
```powershell
ollama run llama3:8b-instruct-q4_0
```

---

## Delivery Meeting Focus
For the handover section of the delivery meeting, cover:

- What problem Ligtas solves and where it sits in the client's QC workflow.
- How to run the backend, frontend, database migrations, and seeded demo data.
- How the client would deploy the system: frontend host, backend service, PostgreSQL database, environment variables, HTTPS, and CORS.
- Which parts are ready for use: upload, scan, review, export, analytics, teams, users, settings, and documentation.
- Which parts need future production hardening: secret rotation, real deployment target, shared rate-limit storage, AI credential management, and any client-specific document-retention policy.
- Where maintainers should look first: this README, `docs/user-guide.md`, `backend/SETUP.md`, `backend/prisma/schema.prisma`, and the GitLab repository/issues.
