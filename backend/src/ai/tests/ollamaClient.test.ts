// callOllama.test.ts
import { callOllama } from "../ollamaClient";

describe("callOllama", () => {
    const mockResponse = { response: "Hello from Ollama!" };

    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("returns the response text when API succeeds", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const result = await callOllama("test prompt");

        expect(result).toBe("Hello from Ollama!");
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
            "http://127.0.0.1:11434/api/generate",
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: expect.stringContaining("test prompt"),
            })
        );
    });

    it("throws an error when API responds with non-ok status", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => "Internal Server Error",
        });

        await expect(callOllama("fail prompt")).rejects.toThrow(
            "Ollama API error: 500 - Internal Server Error"
        );
    });

    it("throws an error if fetch itself fails", async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

        await expect(callOllama("network fail")).rejects.toThrow("Network error");
    });
});