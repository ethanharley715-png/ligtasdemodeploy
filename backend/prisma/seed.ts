import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPasswordWithUsername } from "../src/utils/passwordHasher";

const prisma = new PrismaClient();

type SeedUser = {
  name: string;
  email: string;
  userType: "adm" | "tm" | "usr";
  teamName?: string;
};

type SeedReport = {
  id: string;
  consultantEmail: string;
  fileName: string;
  analyzedAt: string;
  processingTimeSeconds: number;
  totalIssues: number;
  criticalIssues: number;
  passedQC: boolean;
  issues: Array<{
    type:
      | "TEMPLATE_ARTIFACT"
      | "UNREMOVED_GUIDANCE"
      | "MISSING_INFORMATION"
      | "CONTRADICTION"
      | "LIMITATION_CONTRADICTION"
      | "INCOMPLETE_LIMITATIONS";
    description: string;
    location: string;
    context: string;
    suggestion: string;
    pageNumber?: number;
    sectionName?: string;
  }>;
};

async function main() {
  const seedUsers: SeedUser[] = [
    { name: "Admin User", email: "admin@ligtas.com", userType: "adm" },
    { name: "Team Manager", email: "teammanager@ligtas.com", userType: "tm", teamName: "Operations Team" },
    { name: "Sarah Coleman", email: "sarah.manager@ligtas.com", userType: "tm", teamName: "Compliance Team" },
    { name: "James Turner", email: "james.manager@ligtas.com", userType: "tm", teamName: "Field Review Team" },
    { name: "Priya Nair", email: "priya.manager@ligtas.com", userType: "tm", teamName: "Northern Review Team" },
    { name: "Tom Wallace", email: "tom.manager@ligtas.com", userType: "tm", teamName: "South West Team" },
    { name: "Elena Rossi", email: "elena.manager@ligtas.com", userType: "tm", teamName: "Residential Safety Team" },
    { name: "Imran Khan", email: "imran.manager@ligtas.com", userType: "tm", teamName: "Commercial Audit Team" },
    { name: "Rachel Owens", email: "rachel.manager@ligtas.com", userType: "tm", teamName: "Rapid Response Team" },
    { name: "Lewis Hart", email: "lewis.manager@ligtas.com", userType: "tm", teamName: "Template Review Team" },
    { name: "Standby Manager", email: "standby.manager@ligtas.com", userType: "tm", teamName: "Escalations Team" },
    { name: "Consultant User", email: "consultant@ligtas.com", userType: "usr", teamName: "Operations Team" },
    { name: "Ava Patel", email: "ava.patel@ligtas.com", userType: "usr", teamName: "Operations Team" },
    { name: "Marcus Lee", email: "marcus.lee@ligtas.com", userType: "usr", teamName: "Operations Team" },
    { name: "Noah Price", email: "noah.price@ligtas.com", userType: "usr", teamName: "Compliance Team" },
    { name: "Grace Morgan", email: "grace.morgan@ligtas.com", userType: "usr", teamName: "Compliance Team" },
    { name: "Olivia Brooks", email: "olivia.brooks@ligtas.com", userType: "usr", teamName: "Compliance Team" },
    { name: "Mia Foster", email: "mia.foster@ligtas.com", userType: "usr", teamName: "Field Review Team" },
    { name: "Daniel Reed", email: "daniel.reed@ligtas.com", userType: "usr", teamName: "Field Review Team" },
    { name: "Ethan Shaw", email: "ethan.shaw@ligtas.com", userType: "usr", teamName: "Field Review Team" },
    { name: "Holly Bennett", email: "holly.bennett@ligtas.com", userType: "usr", teamName: "Northern Review Team" },
    { name: "Lewis Grant", email: "lewis.grant@ligtas.com", userType: "usr", teamName: "Northern Review Team" },
    { name: "Rosa Diaz", email: "rosa.diaz@ligtas.com", userType: "usr", teamName: "Northern Review Team" },
    { name: "Ben Carter", email: "ben.carter@ligtas.com", userType: "usr", teamName: "South West Team" },
    { name: "Lucy Harper", email: "lucy.harper@ligtas.com", userType: "usr", teamName: "South West Team" },
    { name: "Ivy Simmons", email: "ivy.simmons@ligtas.com", userType: "usr", teamName: "Residential Safety Team" },
    { name: "Max Porter", email: "max.porter@ligtas.com", userType: "usr", teamName: "Residential Safety Team" },
    { name: "Nina Shah", email: "nina.shah@ligtas.com", userType: "usr", teamName: "Commercial Audit Team" },
    { name: "Owen Mills", email: "owen.mills@ligtas.com", userType: "usr", teamName: "Commercial Audit Team" },
    { name: "Cara Hughes", email: "cara.hughes@ligtas.com", userType: "usr", teamName: "Commercial Audit Team" },
    { name: "Mason Bell", email: "mason.bell@ligtas.com", userType: "usr", teamName: "Rapid Response Team" },
    { name: "Sophie Ward", email: "sophie.ward@ligtas.com", userType: "usr", teamName: "Template Review Team" },
    { name: "Ella James", email: "ella.james@ligtas.com", userType: "usr", teamName: "Escalations Team" },
    { name: "Unassigned Consultant", email: "unassigned.consultant@ligtas.com", userType: "usr" },
  ];

  const createdUsers = new Map<string, { id: number; userType: "adm" | "tm" | "usr"; teamName?: string }>();

  for (const user of seedUsers) {
    const passwordHash = hashPasswordWithUsername(user.email, "admin123");
    const savedUser = await prisma.userAccount.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password_hash: passwordHash,
        user_type: user.userType,
      },
      create: {
        name: user.name,
        email: user.email,
        password_hash: passwordHash,
        user_type: user.userType,
      },
    });

    createdUsers.set(user.email, {
      id: savedUser.id,
      userType: user.userType,
      teamName: user.teamName,
    });
  }

  const managerByTeam = new Map<string, number>([
    ["Operations Team", createdUsers.get("teammanager@ligtas.com")!.id],
    ["Compliance Team", createdUsers.get("sarah.manager@ligtas.com")!.id],
    ["Field Review Team", createdUsers.get("james.manager@ligtas.com")!.id],
    ["Northern Review Team", createdUsers.get("priya.manager@ligtas.com")!.id],
    ["South West Team", createdUsers.get("tom.manager@ligtas.com")!.id],
    ["Residential Safety Team", createdUsers.get("elena.manager@ligtas.com")!.id],
    ["Commercial Audit Team", createdUsers.get("imran.manager@ligtas.com")!.id],
    ["Rapid Response Team", createdUsers.get("rachel.manager@ligtas.com")!.id],
    ["Template Review Team", createdUsers.get("lewis.manager@ligtas.com")!.id],
    ["Escalations Team", createdUsers.get("standby.manager@ligtas.com")!.id],
  ]);

  const teams = new Map<string, string>();

  const teamNames = [
    "Operations Team",
    "Compliance Team",
    "Field Review Team",
    "Northern Review Team",
    "South West Team",
    "Residential Safety Team",
    "Commercial Audit Team",
    "Rapid Response Team",
    "Template Review Team",
    "Escalations Team",
  ];

  for (const teamName of teamNames) {
    const managerUserId = managerByTeam.get(teamName) ?? null;
    const team = await prisma.team.upsert({
      where: { name: teamName },
      update: {
        managerUserId,
      },
      create: {
        name: teamName,
        managerUserId,
      },
    });

    teams.set(teamName, team.id);
  }

  for (const user of seedUsers.filter((entry) => entry.userType === "usr")) {
    const userRecord = createdUsers.get(user.email);
    if (!userRecord) {
      continue;
    }

    const teamId = user.teamName ? teams.get(user.teamName) ?? null : null;
    const managerUserId = user.teamName ? managerByTeam.get(user.teamName) ?? null : null;

    await prisma.userAccount.update({
      where: { id: userRecord.id },
      data: {
        teamId,
        managed_by_user_id: managerUserId,
      },
    });
  }

  const now = new Date();
  function daysAgo(days: number, hour: number, minute: number): string {
    const value = new Date(now);
    value.setUTCDate(value.getUTCDate() - days);
    value.setUTCHours(hour, minute, 0, 0);
    return value.toISOString();
  }

  const seedReports: SeedReport[] = [
    {
      id: "seed-report-ops-1",
      consultantEmail: "consultant@ligtas.com",
      fileName: "operations-hub-fra-march.pdf",
      analyzedAt: daysAgo(27, 9, 30),
      processingTimeSeconds: 54,
      totalIssues: 3,
      criticalIssues: 1,
      passedQC: false,
      issues: [
        {
          type: "TEMPLATE_ARTIFACT",
          description: "Template placeholder text remains in the executive summary.",
          location: "Executive summary",
          context: "Insert building name and scope of assessment here.",
          suggestion: "Replace the placeholder with the actual building summary.",
          pageNumber: 1,
          sectionName: "Executive Summary",
        },
        {
          type: "MISSING_INFORMATION",
          description: "Responsible person contact details are missing.",
          location: "Responsible person section",
          context: "Responsible person: ",
          suggestion: "Add the responsible person name, role, and contact information.",
          pageNumber: 2,
          sectionName: "Management Responsibilities",
        },
        {
          type: "CONTRADICTION",
          description: "The evacuation strategy conflicts with the sleeping risk profile.",
          location: "Evacuation strategy",
          context: "Simultaneous evacuation is stated despite phased evacuation later in the report.",
          suggestion: "Align the stated evacuation strategy across the report.",
          pageNumber: 5,
          sectionName: "Means of Escape",
        },
      ],
    },
    {
      id: "seed-report-ops-2",
      consultantEmail: "ava.patel@ligtas.com",
      fileName: "warehouse-a-quarterly-review.pdf",
      analyzedAt: daysAgo(23, 10, 15),
      processingTimeSeconds: 47,
      totalIssues: 1,
      criticalIssues: 0,
      passedQC: false,
      issues: [
        {
          type: "UNREMOVED_GUIDANCE",
          description: "Author guidance note remains in the findings section.",
          location: "Findings section",
          context: "Delete guidance note before final issue.",
          suggestion: "Remove the drafting guidance before publishing the report.",
          pageNumber: 6,
          sectionName: "Findings",
        },
      ],
    },
    {
      id: "seed-report-ops-3",
      consultantEmail: "marcus.lee@ligtas.com",
      fileName: "logistics-centre-review.pdf",
      analyzedAt: daysAgo(18, 11, 45),
      processingTimeSeconds: 39,
      totalIssues: 0,
      criticalIssues: 0,
      passedQC: true,
      issues: [],
    },
    {
      id: "seed-report-comp-1",
      consultantEmail: "noah.price@ligtas.com",
      fileName: "care-home-compliance-check.pdf",
      analyzedAt: daysAgo(21, 13, 20),
      processingTimeSeconds: 63,
      totalIssues: 4,
      criticalIssues: 2,
      passedQC: false,
      issues: [
        {
          type: "MISSING_INFORMATION",
          description: "Fire alarm maintenance interval is not recorded.",
          location: "Alarm maintenance",
          context: "Alarm maintenance interval: ",
          suggestion: "Record the maintenance interval and provider details.",
          pageNumber: 4,
          sectionName: "Fire Detection and Warning",
        },
        {
          type: "MISSING_INFORMATION",
          description: "Personal emergency evacuation plan arrangements are not described.",
          location: "PEEP arrangements",
          context: "PEEP arrangements were not documented.",
          suggestion: "State how PEEP requirements are managed for residents and visitors.",
          pageNumber: 7,
          sectionName: "Means of Escape",
        },
        {
          type: "CONTRADICTION",
          description: "The limitations note says roof voids were not inspected, but findings refer to roof void protection.",
          location: "Limitations and findings",
          context: "Roof voids inaccessible / roof void compartmentation acceptable.",
          suggestion: "Resolve the contradiction between limitations and findings.",
          pageNumber: 9,
          sectionName: "Limitations",
        },
        {
          type: "INCOMPLETE_LIMITATIONS",
          description: "The report states access restrictions without explaining their impact on conclusions.",
          location: "Limitations",
          context: "Some areas were inaccessible.",
          suggestion: "Describe which areas were inaccessible and how this affects the assessment.",
          pageNumber: 9,
          sectionName: "Limitations",
        },
      ],
    },
    {
      id: "seed-report-comp-2",
      consultantEmail: "grace.morgan@ligtas.com",
      fileName: "student-accommodation-fra.pdf",
      analyzedAt: daysAgo(15, 8, 10),
      processingTimeSeconds: 58,
      totalIssues: 2,
      criticalIssues: 1,
      passedQC: false,
      issues: [
        {
          type: "CONTRADICTION",
          description: "The report describes simultaneous evacuation but later recommends stay-put signage updates.",
          location: "Evacuation strategy",
          context: "Simultaneous evacuation / stay-put signage improvements.",
          suggestion: "Reconcile the evacuation strategy and related recommendations.",
          pageNumber: 5,
          sectionName: "Means of Escape",
        },
        {
          type: "TEMPLATE_ARTIFACT",
          description: "A sample recommendation heading remains in the recommendations table.",
          location: "Recommendations table",
          context: "Sample recommendation heading.",
          suggestion: "Replace the sample heading with the actual recommendation title.",
          pageNumber: 11,
          sectionName: "Recommendations",
        },
      ],
    },
    {
      id: "seed-report-comp-3",
      consultantEmail: "olivia.brooks@ligtas.com",
      fileName: "office-block-review.pdf",
      analyzedAt: daysAgo(10, 14, 5),
      processingTimeSeconds: 44,
      totalIssues: 0,
      criticalIssues: 0,
      passedQC: true,
      issues: [],
    },
    {
      id: "seed-report-field-1",
      consultantEmail: "mia.foster@ligtas.com",
      fileName: "hotel-annex-review.pdf",
      analyzedAt: daysAgo(20, 16, 40),
      processingTimeSeconds: 61,
      totalIssues: 3,
      criticalIssues: 1,
      passedQC: false,
      issues: [
        {
          type: "UNREMOVED_GUIDANCE",
          description: "Reviewer instruction text remains in the conclusion.",
          location: "Conclusion",
          context: "Review and tailor conclusion before issue.",
          suggestion: "Remove the instruction text before finalising the report.",
          pageNumber: 12,
          sectionName: "Conclusion",
        },
        {
          type: "MISSING_INFORMATION",
          description: "Travel distance measurements are not provided for the annex corridors.",
          location: "Travel distances",
          context: "Travel distances not recorded for annex corridors.",
          suggestion: "Add the measured travel distances and basis for assessment.",
          pageNumber: 7,
          sectionName: "Means of Escape",
        },
        {
          type: "TEMPLATE_ARTIFACT",
          description: "A default assessor note remains in the appendix.",
          location: "Appendix",
          context: "Default assessor note.",
          suggestion: "Remove the default note from the appendix.",
          pageNumber: 18,
          sectionName: "Appendix",
        },
      ],
    },
    {
      id: "seed-report-field-2",
      consultantEmail: "daniel.reed@ligtas.com",
      fileName: "retail-park-inspection.pdf",
      analyzedAt: daysAgo(8, 9, 55),
      processingTimeSeconds: 42,
      totalIssues: 1,
      criticalIssues: 0,
      passedQC: false,
      issues: [
        {
          type: "MISSING_INFORMATION",
          description: "Final risk rating rationale is missing.",
          location: "Risk rating",
          context: "Risk rating recorded without rationale.",
          suggestion: "Explain how the final risk rating was determined.",
          pageNumber: 13,
          sectionName: "Assessment Summary",
        },
      ],
    },
    {
      id: "seed-report-north-1",
      consultantEmail: "holly.bennett@ligtas.com",
      fileName: "school-campus-review.pdf",
      analyzedAt: daysAgo(13, 15, 15),
      processingTimeSeconds: 52,
      totalIssues: 2,
      criticalIssues: 1,
      passedQC: false,
      issues: [
        {
          type: "INCOMPLETE_LIMITATIONS",
          description: "Out-of-hours inspection restrictions are mentioned but not explained.",
          location: "Limitations",
          context: "Out-of-hours access not available.",
          suggestion: "Explain what was not inspected and the impact on conclusions.",
          pageNumber: 3,
          sectionName: "Limitations",
        },
        {
          type: "MISSING_INFORMATION",
          description: "Assembly point capacity assumptions are missing.",
          location: "Assembly points",
          context: "Assembly point arrangement recorded without capacity assumptions.",
          suggestion: "Add the occupancy assumptions behind the assembly point recommendations.",
          pageNumber: 10,
          sectionName: "Emergency Planning",
        },
      ],
    },
    {
      id: "seed-report-south-1",
      consultantEmail: "ben.carter@ligtas.com",
      fileName: "industrial-unit-review.pdf",
      analyzedAt: daysAgo(6, 7, 50),
      processingTimeSeconds: 36,
      totalIssues: 0,
      criticalIssues: 0,
      passedQC: true,
      issues: [],
    },
    {
      id: "seed-report-south-2",
      consultantEmail: "lucy.harper@ligtas.com",
      fileName: "harbour-estate-review.pdf",
      analyzedAt: daysAgo(3, 10, 5),
      processingTimeSeconds: 41,
      totalIssues: 2,
      criticalIssues: 1,
      passedQC: false,
      issues: [
        {
          type: "MISSING_INFORMATION",
          description: "The fire door inspection regime is referenced but not described.",
          location: "Fire door management",
          context: "Fire door regime in place.",
          suggestion: "Explain the inspection interval, ownership, and escalation process.",
          pageNumber: 6,
          sectionName: "Fire Safety Management",
        },
        {
          type: "CONTRADICTION",
          description: "The report states smoking is prohibited but later mentions a designated smoking area.",
          location: "External areas",
          context: "Smoking prohibited / smoking shelter maintained in rear yard.",
          suggestion: "Clarify the smoking arrangements and associated controls.",
          pageNumber: 11,
          sectionName: "External Risks",
        },
      ],
    },
    {
      id: "seed-report-north-2",
      consultantEmail: "lewis.grant@ligtas.com",
      fileName: "civic-centre-follow-up.pdf",
      analyzedAt: daysAgo(4, 14, 25),
      processingTimeSeconds: 33,
      totalIssues: 0,
      criticalIssues: 0,
      passedQC: true,
      issues: [],
    },
    {
      id: "seed-report-res-1",
      consultantEmail: "ivy.simmons@ligtas.com",
      fileName: "tower-block-weekly-review.pdf",
      analyzedAt: daysAgo(12, 9, 10),
      processingTimeSeconds: 49,
      totalIssues: 3,
      criticalIssues: 1,
      passedQC: false,
      issues: [
        {
          type: "MISSING_INFORMATION",
          description: "The waking-watch arrangement is mentioned without shift coverage details.",
          location: "Interim measures",
          context: "Waking watch in place pending remediation.",
          suggestion: "State the provider, hours covered, and review arrangement.",
          pageNumber: 4,
          sectionName: "Interim Fire Safety Measures",
        },
        {
          type: "INCOMPLETE_LIMITATIONS",
          description: "The report notes restricted access to service risers without explaining the impact.",
          location: "Limitations",
          context: "Service risers not inspected.",
          suggestion: "Describe the missed areas and how the limitation affects confidence in the assessment.",
          pageNumber: 9,
          sectionName: "Limitations",
        },
        {
          type: "UNREMOVED_GUIDANCE",
          description: "A drafting note remains in the residential evacuation section.",
          location: "Evacuation strategy",
          context: "Tailor the evacuation wording to the resident profile before issue.",
          suggestion: "Remove the drafting note and finalise the section text.",
          pageNumber: 12,
          sectionName: "Evacuation Strategy",
        },
      ],
    },
    {
      id: "seed-report-res-2",
      consultantEmail: "max.porter@ligtas.com",
      fileName: "supported-living-scheme-review.pdf",
      analyzedAt: daysAgo(2, 8, 35),
      processingTimeSeconds: 37,
      totalIssues: 1,
      criticalIssues: 0,
      passedQC: false,
      issues: [
        {
          type: "CONTRADICTION",
          description: "The report says bedroom checks were out of scope but later comments on bedroom detection coverage.",
          location: "Scope and findings",
          context: "Bedrooms excluded from inspection / detectors in bedrooms are suitable.",
          suggestion: "Align the scope statement with the conclusions drawn in the findings.",
          pageNumber: 10,
          sectionName: "Scope and Limitations",
        },
      ],
    },
    {
      id: "seed-report-commercial-1",
      consultantEmail: "nina.shah@ligtas.com",
      fileName: "shopping-arcade-audit.pdf",
      analyzedAt: daysAgo(16, 11, 0),
      processingTimeSeconds: 57,
      totalIssues: 4,
      criticalIssues: 2,
      passedQC: false,
      issues: [
        {
          type: "TEMPLATE_ARTIFACT",
          description: "A generic tenancy note remains in the introduction.",
          location: "Introduction",
          context: "Insert tenant mix summary here.",
          suggestion: "Replace the placeholder text with the actual tenant overview.",
          pageNumber: 1,
          sectionName: "Introduction",
        },
        {
          type: "MISSING_INFORMATION",
          description: "Fire warden arrangements for retail units are not described.",
          location: "Management arrangements",
          context: "Retail unit evacuation relies on local management.",
          suggestion: "Explain who acts as fire warden and how coordination is managed.",
          pageNumber: 3,
          sectionName: "Fire Safety Management",
        },
        {
          type: "CONTRADICTION",
          description: "The report refers to a simultaneous evacuation strategy and phased tenant evacuation in different sections.",
          location: "Evacuation strategy",
          context: "Simultaneous evacuation / phased tenant evacuation.",
          suggestion: "Use one consistent evacuation strategy description throughout the report.",
          pageNumber: 6,
          sectionName: "Means of Escape",
        },
        {
          type: "MISSING_INFORMATION",
          description: "The final action tracker omits target completion dates.",
          location: "Action plan",
          context: "Action tracker lists owners without timescales.",
          suggestion: "Add target completion dates for each outstanding action.",
          pageNumber: 13,
          sectionName: "Action Plan",
        },
      ],
    },
    {
      id: "seed-report-commercial-2",
      consultantEmail: "owen.mills@ligtas.com",
      fileName: "high-street-portfolio-review.pdf",
      analyzedAt: daysAgo(9, 15, 20),
      processingTimeSeconds: 46,
      totalIssues: 2,
      criticalIssues: 0,
      passedQC: false,
      issues: [
        {
          type: "UNREMOVED_GUIDANCE",
          description: "Sample landlord guidance text remains in the recommendations summary.",
          location: "Recommendations summary",
          context: "Landlord-only wording should be tailored before issue.",
          suggestion: "Remove the guidance note and tailor the recommendation summary.",
          pageNumber: 8,
          sectionName: "Recommendations",
        },
        {
          type: "MISSING_INFORMATION",
          description: "No maintenance contact is provided for the shared alarm panel.",
          location: "Fire alarm systems",
          context: "Alarm panel maintained under landlord contract.",
          suggestion: "State the responsible maintenance provider and contact details.",
          pageNumber: 9,
          sectionName: "Fire Alarm",
        },
      ],
    },
    {
      id: "seed-report-commercial-3",
      consultantEmail: "cara.hughes@ligtas.com",
      fileName: "city-centre-office-podium.pdf",
      analyzedAt: daysAgo(1, 13, 40),
      processingTimeSeconds: 31,
      totalIssues: 0,
      criticalIssues: 0,
      passedQC: true,
      issues: [],
    },
    {
      id: "seed-report-rapid-1",
      consultantEmail: "mason.bell@ligtas.com",
      fileName: "post-incident-response-review.pdf",
      analyzedAt: daysAgo(5, 12, 35),
      processingTimeSeconds: 34,
      totalIssues: 2,
      criticalIssues: 1,
      passedQC: false,
      issues: [
        {
          type: "MISSING_INFORMATION",
          description: "The temporary control measures are listed without review dates.",
          location: "Temporary measures",
          context: "Temporary measures implemented after the incident.",
          suggestion: "Add review dates and responsible owners for each interim control.",
          pageNumber: 2,
          sectionName: "Temporary Measures",
        },
        {
          type: "CONTRADICTION",
          description: "The report says the incident area was inaccessible but later rates that area as satisfactory.",
          location: "Incident area findings",
          context: "Area inaccessible / controls satisfactory.",
          suggestion: "Remove the unsupported finding or update the limitation note.",
          pageNumber: 7,
          sectionName: "Incident Findings",
        },
      ],
    },
    {
      id: "seed-report-template-1",
      consultantEmail: "sophie.ward@ligtas.com",
      fileName: "template-governance-sample.pdf",
      analyzedAt: daysAgo(7, 9, 5),
      processingTimeSeconds: 45,
      totalIssues: 5,
      criticalIssues: 0,
      passedQC: false,
      issues: [
        {
          type: "TEMPLATE_ARTIFACT",
          description: "Placeholder building profile text remains in the summary.",
          location: "Summary",
          context: "Insert site profile and occupancy description.",
          suggestion: "Replace the placeholder with the completed report summary.",
          pageNumber: 1,
          sectionName: "Summary",
        },
        {
          type: "UNREMOVED_GUIDANCE",
          description: "Internal drafting guidance remains in the compartmentation section.",
          location: "Compartmentation",
          context: "Delete one of the sample paragraphs below before issue.",
          suggestion: "Remove the guidance text from the final report.",
          pageNumber: 5,
          sectionName: "Compartmentation",
        },
        {
          type: "TEMPLATE_ARTIFACT",
          description: "A sample recommendation label remains in the action table.",
          location: "Action table",
          context: "Sample recommendation label.",
          suggestion: "Replace the sample label with the real recommendation title.",
          pageNumber: 9,
          sectionName: "Action Plan",
        },
        {
          type: "MISSING_INFORMATION",
          description: "The completed draft does not identify the nominated responsible person.",
          location: "Responsible person details",
          context: "Responsible person details omitted from the final draft.",
          suggestion: "Add the nominated responsible person details before issue.",
          pageNumber: 2,
          sectionName: "Management Responsibilities",
        },
        {
          type: "CONTRADICTION",
          description: "The template states both stay-put and simultaneous evacuation in different sections.",
          location: "Evacuation strategy",
          context: "Stay-put strategy / simultaneous evacuation wording retained.",
          suggestion: "Select and retain only the correct evacuation strategy wording.",
          pageNumber: 6,
          sectionName: "Evacuation Strategy",
        },
      ],
    },
    {
      id: "seed-report-escalations-1",
      consultantEmail: "ella.james@ligtas.com",
      fileName: "portfolio-escalation-review.pdf",
      analyzedAt: daysAgo(11, 16, 5),
      processingTimeSeconds: 53,
      totalIssues: 3,
      criticalIssues: 1,
      passedQC: false,
      issues: [
        {
          type: "MISSING_INFORMATION",
          description: "The escalation note references unresolved actions without listing them.",
          location: "Escalation summary",
          context: "Unresolved actions remain open.",
          suggestion: "List the unresolved actions and why escalation was required.",
          pageNumber: 2,
          sectionName: "Escalation Summary",
        },
        {
          type: "INCOMPLETE_LIMITATIONS",
          description: "Access restrictions are referenced without stating which buildings were excluded.",
          location: "Limitations",
          context: "Some portfolio sites were inaccessible.",
          suggestion: "Name the affected sites and explain the impact on the report conclusions.",
          pageNumber: 4,
          sectionName: "Limitations",
        },
        {
          type: "CONTRADICTION",
          description: "The escalation report says remedial works are complete while the action register still shows open items.",
          location: "Action register",
          context: "Works complete / action register still open.",
          suggestion: "Update the action register or revise the completion statement.",
          pageNumber: 10,
          sectionName: "Action Register",
        },
      ],
    },
  ];

  for (const report of seedReports) {
    const consultant = createdUsers.get(report.consultantEmail);
    if (!consultant) {
      continue;
    }

    const analyzedAt = new Date(report.analyzedAt);
    const uploadedAt = new Date(analyzedAt);
    uploadedAt.setMinutes(uploadedAt.getMinutes() - 12);

    await prisma.report.upsert({
      where: { id: report.id },
      update: {
        fileName: report.fileName,
        fileSizeBytes: 180000 + report.totalIssues * 1200,
        status: "COMPLETED",
        uploadedAt,
        analyzedAt,
        processingTimeSeconds: report.processingTimeSeconds,
        userAccountId: consultant.id,
        totalIssues: report.totalIssues,
        criticalIssues: report.criticalIssues,
        passedQC: report.passedQC,
        issues: {
          deleteMany: {},
          create: report.issues,
        },
      },
      create: {
        id: report.id,
        fileName: report.fileName,
        fileSizeBytes: 180000 + report.totalIssues * 1200,
        status: "COMPLETED",
        uploadedAt,
        analyzedAt,
        processingTimeSeconds: report.processingTimeSeconds,
        userAccountId: consultant.id,
        totalIssues: report.totalIssues,
        criticalIssues: report.criticalIssues,
        passedQC: report.passedQC,
        issues: {
          create: report.issues,
        },
      },
    });
  }

  console.log("Seeded demo users with password admin123:");
  for (const user of seedUsers) {
    console.log(`- ${user.email} (${user.userType})${user.teamName ? ` -> ${user.teamName}` : ""}`);
  }
  console.log(`Seeded ${seedReports.length} demo reports across team-managed consultants.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
