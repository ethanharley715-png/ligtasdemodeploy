import { intersectIssues } from "../intersection";
import { Issue } from "../types";

describe("intersectIssues", () => {
    const makeIssue = (
        type: Issue["type"],
        section: string,
        description: string
    ): Issue => ({
        type,
        section,
        description,
    });

    it("returns empty array if no runs provided", () => {
        expect(intersectIssues([])).toEqual([]);
    });

    it("returns common issues across all runs", () => {
        const issueA = makeIssue("INCOMPLETE_LIMITATIONS", "1", "Same issue");
        const issueB = makeIssue("INCOMPLETE_LIMITATIONS", "2", "Another issue");

        const runs = [
            { issues: [issueA, issueB] },
            { issues: [issueA] },
            { issues: [issueA, makeIssue("UNREMOVED_GUIDANCE", "3", "Different")] },
        ];

        const result = intersectIssues(runs);

        expect(result).toEqual([issueA]);
    });

    it("returns empty array if no common issues", () => {
        const runs = [
            { issues: [makeIssue("LIMITATION_CONTRADICTION", "1", "A")] },
            { issues: [makeIssue("CONTRADICTION", "1", "B")] },
        ];

        const result = intersectIssues(runs);

        expect(result).toEqual([]);
    });

    it("trims descriptions before comparison", () => {
        const issue1 = makeIssue("LIMITATION_CONTRADICTION", "1", "Same issue");
        const issue2 = makeIssue("CONTRADICTION", "1", "Same issue   "); // trailing spaces

        const runs = [
            { issues: [issue1] },
            { issues: [issue2] },
        ];

        const result = intersectIssues(runs);

        expect(result).toEqual([
            {
                type: "error",
                section: "1",
                description: "Same issue",
            },
        ]);
    });

    it("matches on type + section + description", () => {
        const runs = [
            { issues: [makeIssue("CONTRADICTION", "1", "Issue")] },
            { issues: [makeIssue("CONTRADICTION", "1", "Issue")] }, // different type
        ];

        const result = intersectIssues(runs);

        expect(result).toEqual([]);
    });

    it("deduplicates issues within a single run", () => {
        const issue = makeIssue("CONTRADICTION", "1", "Duplicate");

        const runs = [
            { issues: [issue, issue] }, // duplicate
            { issues: [issue] },
        ];

        const result = intersectIssues(runs);

        expect(result).toEqual([issue]);
    });

    it("handles multiple common issues", () => {
        const issueA = makeIssue("CONTRADICTION", "1", "A");
        const issueB = makeIssue("INCOMPLETE_LIMITATIONS", "2", "B");

        const runs = [
            { issues: [issueA, issueB] },
            { issues: [issueA, issueB] },
            { issues: [issueA, issueB] },
        ];

        const result = intersectIssues(runs);

        expect(result).toHaveLength(2);
        expect(result).toEqual(
            expect.arrayContaining([issueA, issueB])
        );
    });
});