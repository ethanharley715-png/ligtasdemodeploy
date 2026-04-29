import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { saveIssues } from "../issue.service";
import { prisma } from "../../db/prisma";

jest.mock("../../db/prisma", () => ({
    prisma: {
        aiIssue: {
            createMany: jest.fn(),
        },
    },
}));

describe("saveIssues", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should save valid issues with allowed types", async () => {
        const mockIssues = [
            { type: "TEMPLATE_ARTIFACT", description: "Template issue", confidence: 0.8 },
            { type: "UNKNOWN_TYPE", description: "Unknown issue", confidence: 1.2 }, // invalid type and over 1 confidence
            { type: "UNREMOVED_GUIDANCE" }, // missing confidence & description
        ];

        await saveIssues("report-123", mockIssues);

        expect(prisma.aiIssue.createMany).toHaveBeenCalledWith({
            data: [
                {
                    reportId: "report-123",
                    type: "TEMPLATE_ARTIFACT",
                    description: "Template issue",
                    confidence: 0.8,
                },
                {
                    reportId: "report-123",
                    type: "MISSING_INFORMATION", // replaced invalid type
                    description: "Unknown issue",
                    confidence: 1, // capped at 1
                },
                {
                    reportId: "report-123",
                    type: "UNREMOVED_GUIDANCE",
                    description: "", // default
                    confidence: 0,   // default
                },
            ],
        });
    });

    it("should handle empty issues array without error", async () => {
        await saveIssues("report-456", []);
        expect(prisma.aiIssue.createMany).toHaveBeenCalledWith({ data: [] });
    });
});