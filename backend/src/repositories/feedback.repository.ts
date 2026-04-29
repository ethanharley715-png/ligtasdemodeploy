import { prisma } from "../db/prisma";

// services/feedback.service.ts
export interface FeedbackInput {
    issueId: string;
    rating: "CORRECT" | "NEEDS_IMPROVEMENT";
    comment?: string;
}

export async function createFeedback(data: FeedbackInput) {
    return await prisma.feedback.create({ data });
}