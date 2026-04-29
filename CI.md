# CI/CD Pipeline

## Overview

The Ligtas QC project uses GitLab CI/CD. The pipeline runs automatically on every push to `main` and `development` branches.

## Pipeline Stages

1. **Install** - `npm ci` for frontend and backend (dependencies cached)
2. **Lint** - ESLint for all TypeScript files (fails on lint errors)
3. **Type Check** - `tsc --noEmit` for frontend and backend
4. **Test** - Vitest (frontend) and Jest (backend) with coverage >=60%
5. **Build** - `vite build` (frontend), `tsc` (backend)
6. **Deploy** - Staging deployment (main branch only)

## Required GitLab CI/CD Variables

Configure these in **Settings -> CI/CD -> Variables** (masked and protected):

| Variable        | Description                     | Example                          |
|-----------------|---------------------------------|----------------------------------|
| `DATABASE_URL`  | PostgreSQL connection string    | `postgresql://user:pass@host/db` |
| `JWT_SECRET`    | Secret for JWT signing          | `your-secret-key`                |

Add any other variables your app needs (e.g. `VITE_API_URL` for frontend builds).

## Local Checks

Run these locally before pushing:

```bash
# Frontend
cd frontend
npm ci
npm run lint
npm run typecheck
npm run test:ci
npm run build

# Backend
cd backend
npm ci
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

## Pipeline Duration

The pipeline (install through build) is designed to complete within 10 minutes. Check the GitLab CI/CD pipeline UI for detailed logs if a stage fails.
