/*
  Warnings:

  - You are about to drop the column `severity` on the `Issue` table. All the data in the column will be lost.
  - You are about to drop the column `lowIssues` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `mediumIssues` on the `Report` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Issue" DROP COLUMN "severity";

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "lowIssues",
DROP COLUMN "mediumIssues";

-- DropEnum
DROP TYPE "IssueSeverity";
