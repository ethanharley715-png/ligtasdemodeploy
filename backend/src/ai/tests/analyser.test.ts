import { analyzeSections } from "../analyser";
import { buildPrompt } from "../promptBuilder";
import { safeParse } from "../parser";

const mockGenerate = jest.fn();

jest.mock("../providers", () => ({
  getAiTextProvider: jest.fn(() => ({
    name: "ollama",
    generate: mockGenerate,
  })),
  getProviderMaxCharsPerChunk: jest.fn(() => 3000),
}));
jest.mock("../promptBuilder");
jest.mock("../parser");

jest.mock("p-limit", () => {
  return () => <T>(fn: () => Promise<T> | T) => fn();
});

type Section = {
  id: number;
  title: string;
  content: string;
};

describe("analyzeSections", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("processes sections and returns merged issues", async () => {
    const sections: Section[] = [
      { id: 1, title: "1. Intro", content: "content A" },
    ];

    (buildPrompt as jest.Mock).mockReturnValue("mock-prompt");
    mockGenerate.mockResolvedValue("raw-response");
    (safeParse as jest.Mock).mockReturnValue({ issues: [{ id: "issue1" }] });

    const result = await analyzeSections(sections);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      issues: [{ id: "issue1" }],
    });
  });

  it("filters out sections starting with 4.", async () => {
    const sections: Section[] = [
      { id: 1, title: "1. Intro", content: "A" },
      { id: 2, title: "4. Skip me", content: "B" },
    ];

    (buildPrompt as jest.Mock).mockReturnValue("mock-prompt");
    mockGenerate.mockResolvedValue("raw-response");
    (safeParse as jest.Mock).mockReturnValue({ issues: [{ id: "issue1" }] });

    await analyzeSections(sections);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("throws when one section provider call fails", async () => {
    const sections: Section[] = [
      { id: 1, title: "1. A", content: "A" },
      { id: 2, title: "2. B", content: "B" },
    ];

    (buildPrompt as jest.Mock).mockReturnValue("mock-prompt");
    mockGenerate
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("ok-response");
    (safeParse as jest.Mock).mockReturnValue({ issues: [{ id: "issueX" }] });

    await expect(analyzeSections(sections)).rejects.toThrow("timeout");
  });

  it("handles multiple batches", async () => {
    const sections: Section[] = Array.from({ length: 10 }).map((_, i) => ({
      id: i,
      title: `${i}. Section`,
      content: "x".repeat(2000),
    }));

    (buildPrompt as jest.Mock).mockReturnValue("mock-prompt");
    mockGenerate.mockResolvedValue("response");
    (safeParse as jest.Mock).mockReturnValue({ issues: [{ id: "issue" }] });

    const result = await analyzeSections(sections);

    expect(mockGenerate).toHaveBeenCalled();
    expect(result.issues).toBeDefined();
  });

  it("throws error if single-section batch fails", async () => {
    const sections: Section[] = [
      { id: 1, title: "1. Only", content: "A" },
    ];

    (buildPrompt as jest.Mock).mockReturnValue("mock-prompt");
    mockGenerate.mockRejectedValue(new Error("fatal"));

    await expect(analyzeSections(sections)).rejects.toThrow("fatal");
  });

  it("returns no issues for empty extracted sections", async () => {
    const sections: Section[] = [
      { id: 1, title: "Section 1", content: "" },
    ];

    const result = await analyzeSections(sections);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(result).toEqual({ issues: [] });
  });
});
