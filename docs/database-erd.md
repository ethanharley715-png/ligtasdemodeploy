# Database ERD

Generated from [backend/prisma/schema.prisma](../backend/prisma/schema.prisma) and checked against the committed Prisma migrations and backend Prisma usage on 2026-04-20.

Use this Mermaid block directly in the GitLab wiki.

```mermaid
erDiagram
    users {
        Int id PK "autoincrement"
        String email UK
        String name "nullable"
        String password_hash
        String user_type "adm | tm | usr"
        String reset_token_hash "nullable"
        DateTime reset_token_expires_at "nullable"
        Int managed_by_user_id FK "nullable; users.id"
        String teamId FK "nullable; Team.id; indexed"
        Boolean mfaEnabled "default false"
        String mfaSecret "nullable"
        String mfaBackupCodes "nullable"
    }

    Report {
        String id PK "cuid"
        String fileName
        Int fileSizeBytes "nullable"
        ReportStatus status "PROCESSING | COMPLETED | FAILED; default PROCESSING"
        DateTime uploadedAt "default now"
        DateTime analyzedAt "nullable"
        Int processingTimeSeconds "nullable"
        Int userAccountId FK "nullable; users.id"
        String reportSessionId UK "nullable; logical ReportSession.id; no FK"
        Int totalIssues "default 0"
        Int criticalIssues "default 0"
        Boolean passedQC "default false"
    }

    Issue {
        String id PK "cuid"
        IssueType type
        String ruleKey "nullable"
        String description "text"
        String location
        String context "text"
        String suggestion "text"
        Int pageNumber "nullable"
        String sectionName "nullable"
        IssueReviewStatus reviewStatus "OPEN | COMPLETED | FALSE_POSITIVE; default OPEN"
        DateTime reviewedAt "nullable"
        DateTime createdAt "default now"
        String reportId FK "Report.id"
    }

    ReportSession {
        String id PK "uuid"
        Int userAccountId FK "users.id; indexed with expiresAt"
        String filename
        String text "serialized extracted report text"
        Int wordCount
        Int estimatedPages
        DateTime createdAt "default now"
        DateTime expiresAt
    }

    Team {
        String id PK "cuid"
        String name UK
        Int managerUserId FK "nullable; unique; users.id"
        DateTime createdAt "default now"
        DateTime updatedAt "updatedAt"
    }

    AiIssue {
        String id PK "uuid"
        String reportId FK "Report.id; indexed"
        IssueType type
        String description
        Float confidence
        DateTime createdAt "default now"
    }

    Feedback {
        String id PK "uuid"
        String issueId FK "AiIssue.id"
        String rating
        String comment "nullable"
        DateTime createdAt "default now"
    }

    TrainingExample {
        String id PK "cuid"
        String fileName
        Int fileSizeBytes "nullable"
        TrainingExampleType type "GOOD | BAD; indexed"
        TrainingExampleStatus status "PENDING | TRAINED | FAILED; default PENDING"
        Int issueCount "default 0"
        DateTime uploadedAt "default now"
        Int uploadedById FK "users.id; indexed"
        String extractedText "nullable text"
    }

    AdminFeedback {
        String id PK "cuid"
        String reportId FK "Report.id; indexed"
        FeedbackRating rating "CORRECT | NEEDS_IMPROVEMENT"
        String comment "nullable text"
        DateTime createdAt "default now"
        Int createdById FK "users.id; indexed"
    }

    TrainingRun {
        String id PK "cuid"
        DateTime startedAt "default now"
        DateTime completedAt "nullable"
        Int examplesUsed "default 0"
        Float modelAccuracy "nullable"
        String status "default COMPLETED"
    }

    users |o--o{ users : "manages via managed_by_user_id"
    Team |o--o{ users : "has members via teamId"
    users |o--o| Team : "manages via managerUserId"

    users |o--o{ Report : "uploads"
    users ||--o{ ReportSession : "owns active sessions"
    ReportSession |o--o| Report : "logical session link only"

    Report ||--o{ Issue : "has persisted QC issues"
    Report ||--o{ AiIssue : "has AI issues"
    AiIssue ||--o{ Feedback : "receives issue feedback"

    users ||--o{ TrainingExample : "uploads training examples"
    users ||--o{ AdminFeedback : "creates report feedback"
    Report ||--o{ AdminFeedback : "receives admin feedback"
```

## Relationship Notes

- `users` is the physical table for the Prisma `UserAccount` model. `user_type` stores role codes: `adm` for Admin, `tm` for Team Manager, and `usr` for Consultant.
- A consultant can be connected to a team in two ways: `users.teamId` points to `Team.id`, and `users.managed_by_user_id` points to the manager user. Team service code keeps these in sync when team membership changes.
- `Team.managerUserId` is unique, so a team manager can manage at most one team and a team can have at most one manager.
- `ReportSession` stores short-lived extracted report text. After a report is persisted, the session row is deleted and `Report.reportSessionId` remains as a unique logical link. There is no database FK from `Report.reportSessionId` to `ReportSession.id`.
- `Issue` is the main persisted QC issue table used for report history, exports, analytics, and issue review status.
- `AiIssue` plus `Feedback` is a separate AI issue feedback path used by legacy/admin metrics code. The main AI learning dashboard uses `AdminFeedback` against `Report`.
- `TrainingRun` is standalone in the current schema. It stores run-level summary fields only and has no FK to `TrainingExample`.

## Current Schema Caveats

- `npx prisma validate` passes, but Prisma warns that `TrainingExample.uploadedById` and `AdminFeedback.createdById` are required while their relations specify `onDelete: SetNull`. To make the referential action coherent, either make those FK fields nullable or use a non-null action such as `Restrict`/`Cascade`.
- The current Prisma schema includes `users.mfaEnabled`, `users.mfaSecret`, `users.mfaBackupCodes`, `AiIssue`, and `Feedback`. The committed migration SQL in `backend/prisma/migrations` does not currently create those columns/tables. If a fresh environment is built with `prisma migrate deploy`, add a migration before relying on them.
- [backend/src/services/vector.service.ts](../backend/src/services/vector.service.ts) queries `AiIssue.embedding`, and [backend/src/repositories/issue.repository.ts](../backend/src/repositories/issue.repository.ts) accepts an optional `embedding` field, but `embedding` is not defined in `schema.prisma` or migrations. It is not included in the ERD until the schema confirms its type.
