-- AlterTable
ALTER TABLE "Report" ADD COLUMN "reportSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Report_reportSessionId_key" ON "Report"("reportSessionId");
