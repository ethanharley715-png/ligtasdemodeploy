import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { createEmbedding } from "../embedding.service";
import { ai } from "../../config/ai.config";

jest.mock("../../config/ai.config");

describe("createEmbedding", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return the embedding vector from the AI response", async () => {
        const mockEmbedding = [0.1, 0.2, 0.3];

        // ✅ Cast as jest.MockedFunction to fix TS "never" issue
        (ai.embeddings.create as jest.MockedFunction<any>).mockResolvedValue({
            data: [{ embedding: mockEmbedding }],
        });

        const result = await createEmbedding("Hello world");

        expect(ai.embeddings.create).toHaveBeenCalledWith({
            model: "text-embedding-3-small",
            input: "Hello world",
        });
        expect(result).toEqual(mockEmbedding);
    });

    it("should throw if the AI response is empty", async () => {
        (ai.embeddings.create as jest.MockedFunction<any>).mockResolvedValue({
            data: [],
        });

        await expect(createEmbedding("Hello world")).rejects.toThrow();
    });
});