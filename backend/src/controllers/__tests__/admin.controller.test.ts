import { Request, Response } from "express";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

import { submitFeedback } from "../admin.controller";
import { prisma } from "../../db/prisma";

jest.mock("../../db/prisma", () => ({
    prisma: {
        feedback: {
            create: jest.fn(),
        },
    },
}));

const mockedCreate = prisma.feedback.create as jest.MockedFunction<typeof prisma.feedback.create>;

describe("submitFeedback controller", () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Response;
    let jsonMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();

        mockRequest = {
            body: {
                issueId: "issue-1",
                rating: "Correct", 
                comment: "Great fix",
            },
        };

        mockResponse = {
            json: jsonMock,
        } as unknown as Response;

        jest.clearAllMocks();
    });

    it("should save feedback and return success", async () => {
        mockedCreate.mockResolvedValue({} as any);

        await submitFeedback(
            mockRequest as Request,
            mockResponse
        );

        expect(mockedCreate).toHaveBeenCalledWith({
            data: {
                issueId: "issue-1",
                rating: "Correct",
                comment: "Great fix",
            },
        });

        expect(jsonMock).toHaveBeenCalledWith({ success: true });
    });

    it("should throw if prisma fails", async () => {
        mockedCreate.mockRejectedValue(new Error("DB error"));

        await expect(
            submitFeedback(
                mockRequest as Request,
                mockResponse
            )
        ).rejects.toThrow("DB error");
    });
});