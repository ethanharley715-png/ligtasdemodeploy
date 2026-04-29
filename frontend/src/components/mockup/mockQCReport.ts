import { type QCReport } from "../types/qc";

export const mockQCReport: QCReport = {
  summary: {
    totalIssues: 12,
    passed: false
},

issues: [
    {
        id: "ISSUE-001",
        type: "Missing Mandatory Information",
        message:
            "Fire safety strategy section is incomplete and missing required subsections.",
        location: "Section 4.2"
    },

    {
        id: "ISSUE-002",
        type: "Contradictions Detected",
        message:
            "Conflicting information about building occupancy levels.",
        location: "Section 2.1 / Section 5.3"
    },

    {
        id: "ISSUE-003",
        type: "Appendix D Non-Compliance",
        message:
            "Fire alarm system category required by Appendix D is not specified.",
        location: "Appendix D"
    },

    {
        id: "ISSUE-004",
        type: "Missing Mandatory Information",
        message:
            "Means of escape analysis is referenced but not documented.",
        location: "Section 4.2"
    },

    {
        id: "ISSUE-005",
        type: "Missing Mandatory Information",
        message:
            "Emergency lighting provisions are not described.",
        location: "Section 4.5"
    },

    {
        id: "ISSUE-006",
        type: "Contradictions Detected",
        message:
            "Two different fire compartmentation ratings are specified for the same wall.",
        location: "Section 7.3"
    },

    {
        id: "ISSUE-007",
        type: "Appendix D Non-Compliance",
        message:
            "Smoke control strategy does not reference Appendix D requirements.",
        location: "Appendix D"
    },

    {
        id: "ISSUE-008",
        type: "Template Placeholder Errors",
        message:
            "Placeholder text 'XXXXX' detected in the fire detection section.",
        location: "Section 3.4"
    },

    {
        id: "ISSUE-009",
        type: "Template Placeholder Errors",
        message:
            "Template instruction '[Insert evacuation strategy]' was not removed.",
        location: "Section 6"
    },

    {
        id: "ISSUE-010",
        type: "Missing Mandatory Information",
        message:
            "Fire door schedule referenced but not included.",
        location: "Appendix A"
    },

    {
        id: "ISSUE-011",
        type: "Appendix D Non-Compliance",
        message:
            "Appendix D table formatting does not match regulatory template.",
        location: "Appendix D"
    },

    {
        id: "ISSUE-012",
        type: "Contradictions Detected",
        message:
            "Evacuation strategy differs between executive summary and main report.",
        location: "Executive Summary / Section 6"
    }
]
};