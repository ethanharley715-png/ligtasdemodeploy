/*import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { runAnalysis, ReportInput } from "../analysis.service";
import * as promptService from "../prompt.service";
import * as jsonParser from "../../utils/jsonParser";
import { ai } from "../../config/ai.config";

// Mock dependencies
jest.mock("../prompt.service");
jest.mock("../../utils/jsonParser");
jest.mock("../../config/ai.config");
jest.mock("p-limit", () => {
    // bypass concurrency
    return jest.fn(() => (fn: any) => fn());
});

describe("analysis.service", () => {

    jest.setTimeout(60000); 

    const mockReport: ReportInput = {
        id: "report-1",
        observations: "Obs text",
        findings: "Findings text",
        limitations: "Limitations text",
        conclusion: "Conclusion text",
        full: "Full report text",
    };

    const mockIssues = [
        { "description": "### SECTION 0: Section 1",
         "section": "Multiple Sections Analysis",
         "type": "TEMPLATE_ARTIFACT",
       },
        {
         "description": "Full report text",
         "section": "Multiple Sections Analysis",
         "type": "TEMPLATE_ARTIFACT",
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns issues when AI responds correctly", async () => {
        (promptService.buildPrompt as jest.Mock).mockReturnValue("PROMPT_TEXT");

        const mockedAiChat = ai.chat.completions.create as jest.MockedFunction<any>;

        mockedAiChat.mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify({ issues: mockIssues }) } }],
        });

        
        (jsonParser.parseJSON as jest.Mock).mockReturnValue({ issues: mockIssues });

        const issues = await runAnalysis(mockReport);

        expect(issues).toEqual(mockIssues);
    });

});*/