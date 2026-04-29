import { Request, Response } from "express";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

import { getMetrics } from "../metrics.controller";
import { prisma } from "../../db/prisma";

// ✅ Mock prisma
jest.mock("../../db/prisma", () => ({
    prisma: {
        feedback: {
            count: jest.fn(),
        },
    },
}));

// ✅ Proper typing for mocked function
const mockedCount = prisma.feedback.count as jest.MockedFunction<typeof prisma.feedback.count>;

describe("getMetrics controller", () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Response;
    let jsonMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();

        mockRequest = {};

        mockResponse = {
            json: jsonMock,
        } as unknown as Response;

        jest.clearAllMocks();
    });

    it("should return correct metrics when data exists", async () => {
        // total, positive, negative (order matters!)
        mockedCount
            .mockResolvedValueOnce(10) // total
            .mockResolvedValueOnce(7)  // positive
            .mockResolvedValueOnce(3); // negative

        await getMetrics(
            mockRequest as Request,
            mockResponse
        );

        expect(mockedCount).toHaveBeenNthCalledWith(1);
        expect(mockedCount).toHaveBeenNthCalledWith(2, {
            where: { rating: "Correct" },
        });
        expect(mockedCount).toHaveBeenNthCalledWith(3, {
            where: { rating: "Needs Improvement" },
        });

        expect(jsonMock).toHaveBeenCalledWith({
            total: 10,
            positive: 7,
            negative: 3,
            satisfaction: 0.7,
        });
    });

    it("should return 0 satisfaction when total is 0", async () => {
        mockedCount
            .mockResolvedValueOnce(0) // total
            .mockResolvedValueOnce(0) // positive
            .mockResolvedValueOnce(0); // negative

        await getMetrics(
            mockRequest as Request,
            mockResponse
        );

        expect(jsonMock).toHaveBeenCalledWith({
            total: 0,
            positive: 0,
            negative: 0,
            satisfaction: 0,
        });
    });

    it("should throw if prisma fails", async () => {
        mockedCount.mockRejectedValue(new Error("DB error"));

        await expect(
            getMetrics(
                mockRequest as Request,
                mockResponse
            )
        ).rejects.toThrow("DB error");
    });
});