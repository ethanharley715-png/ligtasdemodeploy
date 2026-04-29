import { describe, expect, it, jest } from "@jest/globals";
import { replayReportIssueLocations } from "../reportLocationReplayService";

describe("replayReportIssueLocations", () => {
  it("replays stored issue locations against an uploaded PDF extract", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-1",
            type: "UNREMOVED_GUIDANCE",
            description: "Instructional text found.",
            context: "This section should contain the final approved wording.",
            location: "Page 1 - SECTION 23",
            pageNumber: 1,
            sectionName: "SECTION 23",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: "1. Summary\nThis section should contain the final approved wording.",
          pages: [
            {
              pageNumber: 1,
              text: "1. Summary\nThis section should contain the final approved wording.",
            },
          ],
        })),
      },
    );

    expect(result.changedIssues).toBe(1);
    expect(result.issues[0]).toEqual(
      expect.objectContaining({
        type: "UNREMOVED_GUIDANCE",
        original: expect.objectContaining({
          sectionName: "SECTION 23",
        }),
        replayed: expect.objectContaining({
          pageNumber: 1,
          sectionName: "1. Summary",
          location: "Page 1 - 1. Summary",
        }),
        changed: {
          location: true,
          pageNumber: false,
          sectionName: true,
        },
      }),
    );
  });

  it("rejects missing files before replay", async () => {
    await expect(
      replayReportIssueLocations(
        {
          reportId: "rep-1",
          actor: { userAccountId: 9, role: "ADMIN" },
        },
        {
          findReportById: jest.fn(async () => null),
        },
      ),
    ).rejects.toMatchObject({
      code: "file_required",
      status: 400,
    });
  });

  it("keeps the original approved section when a repeated weak quote is ambiguous", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-1",
            type: "UNREMOVED_GUIDANCE",
            description: "Instructional text found.",
            context: "The template text is:",
            location: "Page 1 - 5.9. Fire Evacuation Policy",
            pageNumber: 1,
            sectionName: "5.9. Fire Evacuation Policy",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: "5.8. Building Classification\nThe template text is:\n\n5.9. Fire Evacuation Policy\nThe template text is:",
          pages: [
            {
              pageNumber: 1,
              text: "5.8. Building Classification\nThe template text is:\n\n5.9. Fire Evacuation Policy\nThe template text is:",
            },
          ],
        })),
      },
    );

    expect(result.issues[0]).toEqual(
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 1,
          sectionName: "5.9. Fire Evacuation Policy",
          location: "Page 1 - 5.9. Fire Evacuation Policy",
        }),
      }),
    );
  });

  it("skips merged table headers and replays tenant issues to the real section heading", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-1",
            type: "TEMPLATE_ARTIFACT",
            description: "Tenant placeholder detected.",
            context: "[XXXX] people are employed on site by the tenant.",
            location: "Page 47 - TenantExisting Control Measure / RemarksAction RequiredL/R",
            pageNumber: 47,
            sectionName: "TenantExisting Control Measure / RemarksAction RequiredL/R",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: "10. Tenant(s) Monitoring\nTenantExisting Control Measure / RemarksAction RequiredL/R\n[XXXX] people are employed on site by the tenant.",
          pages: [
            {
              pageNumber: 47,
              text: "10. Tenant(s) Monitoring\nTenantExisting Control Measure / RemarksAction RequiredL/R\n[XXXX] people are employed on site by the tenant.",
            },
          ],
        })),
      },
    );

    expect(result.issues[0]).toEqual(
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 47,
          sectionName: "10. Tenant(s) Monitoring",
          location: "Page 47 - 10. Tenant(s) Monitoring",
        }),
      }),
    );
  });

  it("inherits the last real heading when a continuation page has no valid section heading", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-1",
            type: "MISSING_INFORMATION",
            description: "Tenant issue detected.",
            context: "fsdhjfhs",
            location: "Page 46 - TenantExisting Control Measure / RemarksAction RequiredL/R",
            pageNumber: 46,
            sectionName: "TenantExisting Control Measure / RemarksAction RequiredL/R",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: "10. Tenant(s) Monitoring\nSome tenant intro\n\nTenantExisting Control Measure / RemarksAction RequiredL/R\nfsdhjfhs",
          pages: [
            {
              pageNumber: 45,
              text: "10. Tenant(s) Monitoring\nSome tenant intro",
            },
            {
              pageNumber: 46,
              text: "TenantExisting Control Measure / RemarksAction RequiredL/R\nfsdhjfhs",
            },
          ],
        })),
      },
    );

    expect(result.issues[0]).toEqual(
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 46,
          sectionName: "10. Tenant(s) Monitoring",
          location: "Page 46 - 10. Tenant(s) Monitoring",
        }),
      }),
    );
  });

  it("does not inherit a previous-page heading when the stored section is already valid", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-1",
            type: "TEMPLATE_ARTIFACT",
            description: "Delete as applicable detected.",
            context: "***Delete as applicable***",
            location: "Page 14 - 5.9. Fire Evacuation Policy",
            pageNumber: 14,
            sectionName: "5.9. Fire Evacuation Policy",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: "8. Fire Risk Assessment\nSome summary text\n\n***Delete as applicable***",
          pages: [
            {
              pageNumber: 13,
              text: "8. Fire Risk Assessment\nSome summary text",
            },
            {
              pageNumber: 14,
              text: "***Delete as applicable***",
            },
          ],
        })),
      },
    );

    expect(result.issues[0]).toEqual(
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 14,
          sectionName: "5.9. Fire Evacuation Policy",
          location: "Page 14 - 5.9. Fire Evacuation Policy",
        }),
      }),
    );
  });

  it("maps legacy risk assessment subsection labels to the approved parent section", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-0",
            type: "TEMPLATE_ARTIFACT",
            description: "Risk summary block detected.",
            context: "The following risks were identified during the assessment:",
            location: "Page 4 - Risk Assessment Findings",
            pageNumber: 4,
            sectionName: "Risk Assessment Findings",
          },
          {
            id: "issue-1",
            type: "TEMPLATE_ARTIFACT",
            description: "High risk template block detected.",
            context: "High Risk Action(s) requiring immediate attention are as follows:",
            location: "Page 5 - High Risk Action(s) requiring immediate attention",
            pageNumber: 5,
            sectionName: "High Risk Action(s) requiring immediate attention",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: "1. Summary\nRisk Assessment Findings\n\nHigh Risk Action(s) requiring immediate attention are as follows:",
          pages: [
            {
              pageNumber: 4,
              text: "1. Summary\nRisk Assessment Findings",
            },
            {
              pageNumber: 5,
              text: "High Risk Action(s) requiring immediate attention are as follows:",
            },
          ],
        })),
      },
    );

    expect(result.issues[0]).toEqual(
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 4,
          sectionName: "8. Fire Risk Assessment",
          location: "Page 4 - 8. Fire Risk Assessment",
        }),
      }),
    );

    expect(result.issues[1]).toEqual(
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 5,
          sectionName: "8. Fire Risk Assessment",
          location: "Page 5 - 8. Fire Risk Assessment",
        }),
      }),
    );
  });

  it("maps tenant continuation pages back to tenant monitoring even when the row label is not approved", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-1",
            type: "TEMPLATE_ARTIFACT",
            description: "Tenant placeholder detected.",
            context: "[XXXX] people are employed on site by the tenant.",
            location: "Page 47 - Ground floor shop unit",
            pageNumber: 47,
            sectionName: "Ground floor shop unit",
          },
          {
            id: "issue-2",
            type: "INCOMPLETE_LIMITATIONS",
            description: "Tenant maintenance timing issue detected.",
            context:
              "Thorough examinations and tests should be done at least once in every five year period, or as recommended by a NICEIC contractor and any necessary maintenance work carried out.",
            location: "Page 47 - TenantExisting Control Measure / RemarksAction RequiredL/R",
            pageNumber: 47,
            sectionName: "TenantExisting Control Measure / RemarksAction RequiredL/R",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: [
            "10. Tenant(s) Monitoring\nSome tenant intro",
            "Tenant\nExisting Control Measure / Remarks\nAction Required\nGround floor shop unit\n[XXXX] people are employed on site by the tenant.\nThorough examinations and tests should be done at least once in every five year period, or as recommended by a NICEIC contractor and any necessary maintenance work carried out.",
          ].join("\n\n"),
          pages: [
            {
              pageNumber: 45,
              text: "10. Tenant(s) Monitoring\nSome tenant intro",
            },
            {
              pageNumber: 47,
              text: "Tenant\nExisting Control Measure / Remarks\nAction Required\nGround floor shop unit\n[XXXX] people are employed on site by the tenant.\nThorough examinations and tests should be done at least once in every five year period, or as recommended by a NICEIC contractor and any necessary maintenance work carried out.",
            },
          ],
        })),
      },
    );

    expect(result.issues).toEqual([
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 47,
          sectionName: "10. Tenant(s) Monitoring",
          location: "Page 47 - 10. Tenant(s) Monitoring",
        }),
      }),
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 47,
          sectionName: "10. Tenant(s) Monitoring",
          location: "Page 47 - 10. Tenant(s) Monitoring",
        }),
      }),
    ]);
  });

  it("converts unresolved non-approved section names to Unknown", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-1",
            type: "MISSING_INFORMATION",
            description: "Gibberish issue detected.",
            context: "sojsnsdk",
            location: "TenantExisting Control Measure / RemarksAction RequiredL/R",
            pageNumber: null,
            sectionName: "TenantExisting Control Measure / RemarksAction RequiredL/R",
          },
          {
            id: "issue-2",
            type: "TEMPLATE_ARTIFACT",
            description: "Table header issue detected.",
            context: "Quote: ''",
            location: "Item Description",
            pageNumber: null,
            sectionName: "Item Description",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: "1. Summary\nReal report text",
          pages: [
            {
              pageNumber: 1,
              text: "1. Summary\nReal report text",
            },
          ],
        })),
      },
    );

    expect(result.issues).toEqual([
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: null,
          sectionName: "Unknown",
          location: "Unknown",
        }),
      }),
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: null,
          sectionName: "Unknown",
          location: "Unknown",
        }),
      }),
    ]);
  });

  it("canonicalizes shorthand or noisy approved references without replaying them", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-1",
            type: "MISSING_INFORMATION",
            description: "Electrical issue detected.",
            context: "Short section label from AI output.",
            location: "Page 24 - 9.3ruwihaurawhruaw",
            pageNumber: 24,
            sectionName: "9.3ruwihaurawhruaw",
          },
          {
            id: "issue-2",
            type: "TEMPLATE_ARTIFACT",
            description: "Main section issue detected.",
            context: "Short parent section label from AI output.",
            location: "Page 22 - 9.",
            pageNumber: 22,
            sectionName: "9.",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: "1. Summary\nUnrelated report text",
          pages: [
            {
              pageNumber: 24,
              text: "1. Summary\nUnrelated report text",
            },
          ],
        })),
      },
    );

    expect(result.issues).toEqual([
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 24,
          sectionName: "9.3. Electrical Matters",
          location: "Page 24 - 9.3. Electrical Matters",
        }),
        changed: expect.objectContaining({
          pageNumber: false,
          sectionName: true,
        }),
      }),
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 22,
          sectionName: "9. Risk Assessment and Action Plan",
          location: "Page 22 - 9. Risk Assessment and Action Plan",
        }),
        changed: expect.objectContaining({
          pageNumber: false,
          sectionName: true,
        }),
      }),
    ]);
  });

  it("keeps the original approved section when replay is ambiguous", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-1",
            type: "UNREMOVED_GUIDANCE",
            description: "The template text is:",
            context: "The template text is:",
            location: "Page 13 - 5.9. Fire Evacuation Policy",
            pageNumber: 13,
            sectionName: "5.9. Fire Evacuation Policy",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: [
            "5.8. Building Classification\nThe template text is:",
            "5.9. Fire Evacuation Policy\nThe template text is:",
          ].join("\n\n"),
          pages: [
            {
              pageNumber: 13,
              text: "5.8. Building Classification\nThe template text is:\n\n5.9. Fire Evacuation Policy\nThe template text is:",
            },
          ],
        })),
      },
    );

    expect(result.issues[0]).toEqual(
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 13,
          sectionName: "5.9. Fire Evacuation Policy",
          location: "Page 13 - 5.9. Fire Evacuation Policy",
        }),
      }),
    );
  });

  it("keeps the original page when replay keeps the same approved section but cannot re-verify the page", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-1",
            type: "TEMPLATE_ARTIFACT",
            description: "Delete as applicable detected.",
            context: "Delete as applicable***",
            location: "Page 13 - 5.8. Building Classification",
            pageNumber: 13,
            sectionName: "5.8. Building Classification",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: [
            "5.8. Building Classification\nDelete as applicable***",
            "5.9. Fire Evacuation Policy\nDelete as applicable***",
          ].join("\n\n"),
          pages: [
            {
              pageNumber: 13,
              text: "5.8. Building Classification\nDelete as applicable***",
            },
            {
              pageNumber: 14,
              text: "5.9. Fire Evacuation Policy\nDelete as applicable***",
            },
          ],
        })),
      },
    );

    expect(result.issues[0]).toEqual(
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 13,
          sectionName: "5.8. Building Classification",
          location: "Page 13 - 5.8. Building Classification",
        }),
      }),
    );
  });

  it("preserves an already-approved saved section instead of downgrading it to a weaker matched heading", async () => {
    const repository = {
      findReportById: jest.fn(async () => ({
        id: "rep-1",
        fileName: "sample-report.pdf",
        issues: [
          {
            id: "issue-1",
            type: "TEMPLATE_ARTIFACT",
            description: "Risk summary intro detected.",
            context: "The following risks were identified during the assessment:",
            location: "Page 4 - 8. Fire Risk Assessment",
            pageNumber: 4,
            sectionName: "8. Fire Risk Assessment",
          },
        ],
      })),
    };

    const result = await replayReportIssueLocations(
      {
        reportId: "rep-1",
        actor: { userAccountId: 9, role: "ADMIN" },
        file: {
          buffer: Buffer.from("%PDF-1.4"),
          mimetype: "application/pdf",
          originalname: "sample-report.pdf",
        },
      },
      repository,
      {
        extractPages: jest.fn(async () => ({
          text: "1. Summary\nThe following risks were identified during the assessment:",
          pages: [
            {
              pageNumber: 4,
              text: "1. Summary\nThe following risks were identified during the assessment:",
            },
          ],
        })),
      },
    );

    expect(result.issues[0]).toEqual(
      expect.objectContaining({
        replayed: expect.objectContaining({
          pageNumber: 4,
          sectionName: "8. Fire Risk Assessment",
          location: "Page 4 - 8. Fire Risk Assessment",
        }),
        changed: expect.objectContaining({
          sectionName: false,
          location: false,
        }),
      }),
    );
  });
});
