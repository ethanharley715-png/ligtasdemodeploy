-- CreateEnum
CREATE TYPE "TrainingExampleType" AS ENUM ('GOOD', 'BAD');

-- CreateEnum
CREATE TYPE "TrainingExampleStatus" AS ENUM ('PENDING', 'TRAINED', 'FAILED');

-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('CORRECT', 'NEEDS_IMPROVEMENT');

-- CreateTable
CREATE TABLE "TrainingExample" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "type" "TrainingExampleType" NOT NULL,
    "status" "TrainingExampleStatus" NOT NULL DEFAULT 'PENDING',
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" INTEGER NOT NULL,
    "extractedText" TEXT,

    CONSTRAINT "TrainingExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminFeedback" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "AdminFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "examplesUsed" INTEGER NOT NULL DEFAULT 0,
    "modelAccuracy" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT "TrainingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingExample_type_idx" ON "TrainingExample"("type");

-- CreateIndex
CREATE INDEX "TrainingExample_uploadedById_idx" ON "TrainingExample"("uploadedById");

-- CreateIndex
CREATE INDEX "AdminFeedback_reportId_idx" ON "AdminFeedback"("reportId");

-- CreateIndex
CREATE INDEX "AdminFeedback_createdById_idx" ON "AdminFeedback"("createdById");

-- AddForeignKey
ALTER TABLE "TrainingExample" ADD CONSTRAINT "TrainingExample_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminFeedback" ADD CONSTRAINT "AdminFeedback_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminFeedback" ADD CONSTRAINT "AdminFeedback_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

