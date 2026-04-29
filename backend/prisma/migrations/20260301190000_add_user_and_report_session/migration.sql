-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "IssueSeverity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "IssueType" AS ENUM ('TEMPLATE_ARTIFACT', 'UNREMOVED_GUIDANCE', 'MISSING_INFORMATION', 'CONTRADICTION', 'LIMITATION_CONTRADICTION', 'INCOMPLETE_LIMITATIONS');

-- CreateTable (users table for UserAccount - RSA + PBKDF2 auth)
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "user_type" TEXT NOT NULL,
    "reset_token_hash" TEXT,
    "reset_token_expires_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "status" "ReportStatus" NOT NULL DEFAULT 'PROCESSING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzedAt" TIMESTAMP(3),
    "processingTimeSeconds" INTEGER,
    "userAccountId" INTEGER,
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "criticalIssues" INTEGER NOT NULL DEFAULT 0,
    "mediumIssues" INTEGER NOT NULL DEFAULT 0,
    "lowIssues" INTEGER NOT NULL DEFAULT 0,
    "passedQC" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "type" "IssueType" NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportId" TEXT NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSession" (
    "id" TEXT NOT NULL,
    "userAccountId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "estimatedPages" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "ReportSession_userAccountId_expiresAt_idx" ON "ReportSession"("userAccountId", "expiresAt");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userAccountId_fkey" FOREIGN KEY ("userAccountId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSession" ADD CONSTRAINT "ReportSession_userAccountId_fkey" FOREIGN KEY ("userAccountId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
