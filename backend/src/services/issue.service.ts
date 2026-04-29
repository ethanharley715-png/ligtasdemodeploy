import { prisma } from "../db/prisma";


const allowedTypes = [
    "TEMPLATE_ARTIFACT",
    "UNREMOVED_GUIDANCE",
    "MISSING_INFORMATION",
    "CONTRADICTION",
    "LIMITATION_CONTRADICTION",
    "INCOMPLETE_LIMITATIONS"
];

export async function saveIssues(reportId: string, issues: any[]) {
    const cleaned = issues.map(issue => ({
        reportId,
        type: allowedTypes.includes(issue.type)
            ? issue.type
            : "MISSING_INFORMATION",
        description: issue.description || "",
        confidence: Math.min(Math.max(Number(issue.confidence) || 0, 0), 1)
    }));

    await prisma.aiIssue.createMany({ data: cleaned });
}