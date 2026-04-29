# API Reference

This reference summarizes the main backend endpoints exposed by the handover build. The backend is mounted under `/api` for current application routes, with a few legacy routes also present.

Default local API base URL:

```text
http://localhost:4000/api
```

Browser authentication uses the `loginToken` HTTP-only cookie. Frontend requests should include credentials for protected endpoints.

## Error Shape

Most newer service/controller errors use this shape:

```json
{
  "code": "invalid_request",
  "message": "Human-readable error message."
}
```

Some older inline route handlers may still return:

```json
{
  "message": "Human-readable error message."
}
```

## Authentication

Base path: `/api/logins`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/login` | Public | Signs in and sets the `loginToken` cookie. |
| `POST` | `/mfa/verify` | Public | Verifies MFA flow when required. |
| `GET` | `/me` | Cookie | Returns the current authenticated user when the cookie is valid. |
| `POST` | `/logout` | Cookie | Clears the auth cookie. |
| `POST` | `/forgot-password` | Public | Starts password reset flow. |
| `POST` | `/validate-reset-token` | Public | Checks whether a reset token is valid. |
| `POST` | `/reset-password-with-token` | Public | Completes password reset. |
| `PATCH` | `/change-password` | Cookie | Changes the current user's password. |
| `GET` | `/security-events` | Admin | Returns recent auth/security events. |
| `POST` | `/dev/mfa/generate` | Development | Development helper for MFA setup. Do not expose for production use without review. |

## Reports And Uploads

Base path: `/api/reports`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/upload` | Cookie | Uploads one PDF in multipart field `file`; supports `scanMode=ai|rules` and `aiLocationMode=canonical_only|full`. Streams newline-delimited progress JSON. |
| `POST` | `/sessions/:reportSessionId/analyze` | Cookie | Runs or returns persisted QC analysis for a report session. |
| `GET` | `/sessions/:reportSessionId/qc-results` | Cookie | Returns persisted QC result for a session. |
| `GET` | `/` | Cookie | Lists visible reports. Admin sees all; users see permitted reports. |
| `GET` | `/:id` | Cookie | Returns persisted report detail and issues. |
| `POST` | `/` | Cookie | Legacy/manual report creation path. |
| `PATCH` | `/:id/complete` | Cookie | Legacy/manual completion path. |
| `PATCH` | `/tags` | Cookie | Updates a report tag status. |
| `PATCH` | `/issues/:issueId/review` | Cookie | Updates issue review status: `OPEN`, `COMPLETED`, or `FALSE_POSITIVE`. |
| `GET` | `/me/stats` | Cookie | Returns current user's report stats. |
| `GET` | `/me/recent` | Cookie | Returns current user's recent reports. |
| `GET` | `/:id/export?format=csv|pdf` | Cookie | Downloads a report export. |
| `POST` | `/:id/share` | Cookie | Sends report export by email when email is configured. |

### Upload Done Payload

The upload route finishes with a newline-delimited JSON object like:

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

Common upload error codes:

- `file_required`
- `invalid_file_type`
- `file_too_large`
- `invalid_scan_mode`
- `ai_scan_unavailable`
- `ai_scan_failed`
- `rule_scan_unavailable`
- `internal_error`

## Analytics

Base path: `/api/analytics`

Admin-only unless otherwise changed.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/kpis` | KPI cards for QC dashboard. |
| `GET` | `/issue-types` | Issue category counts. |
| `GET` | `/trends` | Trend chart data. |
| `GET` | `/section-density` | Issues grouped by report section. |
| `GET` | `/recurring-issue-rate` | Recurring issue metrics. |
| `GET` | `/consultant-signals` | Consultant quality signal data. |
| `GET` | `/weekly-digest/export?format=csv|pdf&weekStart=YYYY-MM-DD` | Weekly digest export. Supports optional filters. |
| `GET` | `/weekly-digest/availability` | Returns whether email sharing is configured. |
| `POST` | `/weekly-digest/share` | Sends weekly digest by email when configured. |
| `GET` | `/leaderboard` | Admin leaderboard data. |

## Team Analytics

Base path: `/api/team-analytics`

Admin or team-manager access.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/kpis` | Team-level KPI data. |
| `GET` | `/issue-types` | Team issue category counts. |
| `GET` | `/trends` | Team trend data. |
| `GET` | `/team-performance` | Team comparison data. |
| `GET` | `/consultant-performance` | Consultant comparison data. |

## Users

Base path: `/api/users`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/me` | Cookie | Current user's profile. |
| `PATCH` | `/me` | Cookie | Updates current user's profile fields. |
| `GET` | `/` | Admin | Lists users. |
| `GET` | `/team` | Admin or team manager | Lists visible team users. |
| `POST` | `/` | Admin | Creates a user. |
| `PATCH` | `/:id` | Admin | Updates a user. |
| `DELETE` | `/:id` | Admin | Deletes a user. |
| `GET` | `/:id/reports` | Admin or team manager | Gets reports visible for a selected user. |

## Teams

Base path: `/api/teams`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/` | Admin | Lists teams. |
| `POST` | `/` | Admin | Creates a team. |
| `GET` | `/me` | Cookie | Returns current user's team when available. |
| `GET` | `/me/recent-reports` | Cookie | Returns recent reports for the current user's team. |
| `GET` | `/:id` | Admin | Gets a team detail. |
| `PATCH` | `/:id` | Admin | Updates team name/manager. |
| `POST` | `/:id/members` | Admin | Adds a member. |
| `DELETE` | `/:id/members/:userId` | Admin | Removes a member. |
| `DELETE` | `/:id` | Admin | Deletes a team. |

## AI Learning

Base path: `/api/ai-learning`

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/stats` | AI learning dashboard stats. |
| `POST` | `/training-examples` | Uploads a training example PDF. |
| `GET` | `/training-examples` | Lists training examples, with optional type filtering. |
| `DELETE` | `/training-examples/:id` | Deletes a training example. |
| `POST` | `/feedback` | Submits feedback for a report. |
| `GET` | `/feedback/stats` | Feedback aggregate stats. |
| `GET` | `/feedback/pending-review` | Gets a report pending review. |

Developer note: review route-level authentication before exposing AI learning routes in a production deployment. The frontend restricts access through role-based UI, but backend middleware should be the authority for production access control.

## Notifications

Base path: `/api/notifications`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/` | Cookie | Returns notification data for the current user. |

## Admin Backup And Data Export

Base path: `/api/admin`

Admin or team-manager access.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/backup/manual` | Creates a manual backup/export payload. |
| `GET` | `/reports/export-all` | Exports all visible report data. |

## Rule Check

Base path: `/api/rules`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/check` | Public in current route | Runs deterministic rule checks against supplied text. |

## Legacy Routes

These routes are still mounted but should not be the first choice for new frontend work:

| Base Path | Notes |
| --- | --- |
| `/analysis` | Deprecated legacy analysis route. Protected with cookie auth. |
| `/admin` | Legacy admin feedback route. Protected with admin auth. |
| `/metrics` | Legacy metrics route. Review before production exposure. |

