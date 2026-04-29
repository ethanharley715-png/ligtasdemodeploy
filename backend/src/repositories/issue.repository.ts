import { prisma } from "../db/prisma";

export interface AIssueInput {
    reportId: string;
    type: "TEMPLATE_ARTIFACT"
    | "UNREMOVED_GUIDANCE"
    | "MISSING_INFORMATION"
    | "CONTRADICTION"
    | "LIMITATION_CONTRADICTION"
    | "INCOMPLETE_LIMITATIONS";
    description: string;
    confidence: number;
    embedding?: any; // optional if you store vector
}

export async function createIssue(data: AIssueInput) {
    return await prisma.aiIssue.create({ data });
}