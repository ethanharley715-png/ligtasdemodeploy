# User Documentation

Ligtas QC formal user documentation.

## What Ligtas QC Is

Ligtas QC helps users review professional reports before formal quality control. It highlights common non-technical issues such as missing information, contradictions, and template artefacts, then presents the findings in a workflow that supports upload, review, correction, and export.

Ligtas supports user review by highlighting likely non-technical issues. Final judgement remains the responsibility of the reviewer.

## Who This Guide Is For

This guide is for people using the application, including:

- consultants uploading and reviewing reports
- team managers reviewing team-level activity
- administrators managing users, teams, analytics, and operational controls

This guide does not cover local setup, API usage, or developer workflows.

## Roles and Access

The navigation you see depends on your role. If you do not see an area described in this guide, it may not be available for your role or in your current environment.

### Consultant

Typical navigation includes:

- Dashboard
- Upload Report
- QC Results
- Report History
- Settings
- My Profile

### Team Manager

Typical navigation includes:

- Dashboard
- Upload Report
- QC Results
- Report History
- My Team Analytics
- AI Learning
- My Team
- Settings
- My Profile

### Admin

Typical navigation includes:

- Dashboard
- Upload Report
- QC Results
- Report History
- QC Trend Dashboard
- Team Analytics
- AI Learning
- Teams
- User Management
- Security Events
- Settings
- My Profile

## Getting Started

### Signing In

- Open the sign-in page and enter your email address and password.
- If your organization supports password recovery, use **Forgot your password?** to request a reset link.
- If repeated sign-in attempts fail, you may be temporarily locked out before trying again.
- Some environments may require additional CAPTCHA verification after repeated failed attempts.

After sign-in, Ligtas opens your dashboard or the default landing view saved in your user settings.

### Password Recovery

If you cannot remember your password:

- select **Forgot your password?** from the sign-in page
- enter your email address
- submit the form to request reset instructions

The page confirms that reset instructions will be sent if an account exists for that email address.

### Support Surfaces

Ligtas QC also provides:

- an **About** page for high-level product context
- a **Help Center** page for concise operational guidance

This markdown document remains the fuller formal user documentation artefact, while the in-app Help Center is the shorter product-facing guide.

### Getting Around

The main application layout has three consistent areas:

- a top header for profile access, settings, notifications, and sign out
- a left sidebar for the main sections available to your role
- a main content area where pages such as Upload Report, Report History, and analytics views open

### Notifications

The header notification bell shows in-app announcements and updates.

You can:

- open the notification panel from the bell icon
- see unread counts on the bell
- review recent announcements
- mark individual announcements as read
- use **Mark all read** to clear the current unread list

## Daily Workflow

### Dashboard

The dashboard provides a quick overview of recent report activity and summary metrics.

Depending on your role, you may see:

- report totals and pass-rate indicators
- recent reports
- quick actions for Upload Report and Report History
- shortcuts to analytics or team views

Use the dashboard as the starting point for day-to-day work, not as the permanent home for detailed report review.

### Upload Report

Use **Upload Report** to submit a PDF for analysis.

#### Before You Upload

- Only PDF files are accepted.
- The current file size limit is 50 MB.
- You must be signed in to upload.

#### Upload Workflow

1. Open **Upload Report** from the sidebar.
2. Drag and drop a PDF onto the upload area, or click to browse.
3. Confirm the selected file name.
4. Click **Upload Report** to begin processing.

#### What Happens During Upload

While a report is being processed, the page shows:

- an upload button in progress state
- a progress bar
- progress text such as upload percentage and processing status
- a **Cancel** action

#### Cancel and Clear

- **Cancel** stops the active upload or scan after confirmation.
- **Clear** removes the selected file from the page when no upload is in progress.

If you cancel an upload, no success result is shown and you can start again with a new upload.

#### After a Successful Upload

After a successful upload, the app returns to the dashboard and opens the **QC Results** view automatically.

This is the main immediate review surface after upload.

Users should still treat QC Results as a review aid rather than a final release decision.

### QC Results

QC Results is the main place to review the latest uploaded report result immediately after upload, inside the dashboard experience.

Typical information available here includes:

- overall pass or fail status
- total issue counts
- issue breakdown by category
- review status per issue
- filters and sorting controls
- an **Open PDF review** action for page-based review

You can use this view to focus on specific issue types, narrow to a review status, and work through findings more efficiently.

QC Results is also tied to the saved report record, so review actions can carry through into the persisted report flow.

### How to Read Findings

Findings are grouped by issue category to help reviewers prioritize what to check first.

- findings are indicators for review, not automatic truth
- some findings may be genuine issues
- some findings may turn out to be false positives after review
- each issue should be checked in context before taking action

### Review Statuses

- **Open** means the finding still needs review
- **Complete** means the finding has been reviewed and handled
- **False positive** means the finding was reviewed and judged not to be a real issue
- reopened issues return to an active review state

### PDF Review

Use **Open PDF review** from QC Results or the report detail page to open the PDF review workspace.

In this workspace, you can:

- open the report document alongside the issue list
- inspect issue placement against report pages
- move through pages without leaving the QC review flow

The document is not already present in the viewer. To use PDF review, upload the same report PDF again so the saved issue list can be checked against the report text.

Page-aware highlighting depends on the page and location data available for a saved issue. A missing highlight does not automatically mean the issue is wrong.

### Report History

Use **Report History** to browse analyzed reports that have already been persisted.

The history table shows information such as:

- report file name
- analyst
- upload date and time
- number of issues found
- analysis status
- review status summary

Select a report name to open its full detail page.

Report History is the usual way to reopen older reports after the initial post-upload review.

Saved report results remain available here so you can return to earlier reviews.

This is the normal place to revisit reports after the immediate post-upload QC Results workflow.

### Report Detail and Review

The report detail page is the persisted report view you open from Report History.

You can:

- view report metadata and QC outcome
- filter issues by type, page, and review status
- sort issues by type or location
- mark issues as **Complete**
- mark issues as **False positive**
- reopen reviewed issues if needed

This page supports the same core review work as QC Results, but it is reached through the report-history flow rather than the immediate post-upload flow.

### Export and Email Shortcuts

From the report detail page, completed reports can be exported in:

- CSV
- PDF

If a report is still processing, export actions stay unavailable until the analysis is complete.

The export dialog also provides email shortcuts that open a draft in:

- the default email app
- Gmail
- Outlook Web

These shortcuts prepare a draft message. You still need to attach the downloaded export manually.

## Account and Preferences

### Settings

All users can open **Settings**, but available tabs depend on role.

#### Available to All Users

##### Notifications

Users can choose which email alerts they want to receive, including:

- report completion alerts
- failed QC alerts
- weekly summary alerts
- new user registration alerts where relevant

Use **Save Changes** after updating notification preferences.

##### User Defaults

User Defaults control display and navigation preferences such as:

- dark mode
- colour-blind-friendly QC indicators
- text size
- default landing view after sign-in

The default landing view can be set to:

- Dashboard
- Upload Report
- Report History

Some preferences may apply only on the browser where they were set.

#### Available to Admins and Team Managers

##### Security

The Security tab includes:

- session timeout preferences for inactivity sign-out
- password policy controls used when changing passwords

These settings are intended for operational control and may affect how password changes are validated.

##### Data and Backup

The Data & Backup tab includes:

- backup and export scope
- manual backup
- automatic backup schedule preference
- bulk data export

Role-specific behaviour:

- admins can scope backup and export to all teams or a selected team
- team managers are limited to their managed team

Bulk export options include:

- CSV
- ZIP

CSV produces one combined file. ZIP produces one CSV per report.

### My Profile

Use **My Profile** from the header menu to manage your personal account information.

The profile page includes:

- your name, email address, and role
- profile statistics
- recent reports
- edit profile controls
- change password controls

When changing your password, the app enforces the active password policy available in Settings.

## Role-Specific Areas

### QC Trend Dashboard (Admin)

Administrators can use the **QC Trend Dashboard** to review organization-wide analysis trends.

Available capabilities include:

- date-range filtering
- consultant filtering
- issue-category filtering
- KPI summaries
- trend charts
- issue-type breakdowns
- section-density and recurring-issue views
- consultant quality signals

Admins can also export a weekly digest in CSV or PDF for the selected completed week and current filters.

The weekly digest dialog also provides email shortcuts for:

- the default email app
- Gmail
- Outlook Web

These shortcuts prepare a draft message. You still need to attach the downloaded digest manually.

### Team Analytics (Admin and Team Manager)

**Team Analytics** shows persisted report quality data at team scope.

- Admins can review organization-wide team performance or narrow to a specific team.
- Team managers are automatically limited to their own managed team.
- When a team is selected, consultant-level performance becomes available for that team.

If a team manager is not assigned to a team, the app shows an empty state instead of team data.

### AI Learning

Admins and team managers can access **AI Learning & Training**.

This area includes:

- summary cards for model accuracy, training examples, last training activity, and feedback received
- a **How AI Learning Works** explainer
- training tabs for uploads, dataset review, and user feedback
- training-data guidance
- satisfaction trend and distribution charts

#### Upload Training Examples

The upload tab lets users submit:

- good example PDFs
- bad example PDFs

Current upload rules in this area:

- PDF only
- 50 MB maximum file size

#### Training Dataset

The dataset tab shows the current uploaded training examples and their metadata, including:

- file name
- example ID
- upload date
- issue count
- good or bad label
- current status

#### Provide Feedback

The feedback tab lets users review a pending report and say whether the AI result was:

- correct
- needs improvement

This area also shows feedback statistics such as positive feedback, negative feedback, and satisfaction rate.

If there is nothing waiting for review, the page shows a no-pending-review message.

Use this area only if your role includes responsibility for model-improvement workflows.

### Teams and User Administration

#### My Team (Team Manager)

Team managers can open **My Team** to see:

- the team they manage
- the assigned team manager
- team members
- member email addresses, roles, and report counts

If no team has been assigned yet, the view explains that an administrator must assign one.

#### Teams (Admin)

Administrators can use **Teams** to manage team structure, including:

- creating teams
- naming or renaming teams
- assigning a team manager
- adding or removing consultants
- deleting eligible teams

#### User Management (Admin)

Administrators can use **User Management** to:

- search users
- add users
- edit user details
- change roles
- delete users where permitted
- open a selected user's report list for further review

### Security Events

Administrators can open **Security Events** to review recent authentication and security activity.

This view is intended for operational awareness and includes:

- recent sign-in successes and failures
- lockout events
- CAPTCHA escalation events
- logout activity
- masked actor, route, and IP details shown in the interface

This is a recent operational window, not a permanent compliance archive.

## Common Troubleshooting

### I cannot sign in

- Check that your email address and password are correct.
- If you recently failed several sign-in attempts, wait for the lockout period to finish.
- Complete CAPTCHA verification if the page asks for it.
- If you still cannot sign in, contact an administrator.

### My upload was rejected

Check the file before trying again:

- make sure it is a PDF
- make sure it is under the size limit
- make sure you are signed in

### I cancelled the upload by mistake

Select the file again and restart the upload. Cancelling stops the active upload or scan and does not keep a completed result.

### I cannot export a report yet

Exports are only available when the report has finished processing. If the report still shows a processing state, wait until analysis completes.

### I cannot see team information

If you are a team manager and the app says no team is assigned, an administrator needs to assign you to one before team-scoped features will work.

### Why might PDF highlighting or page anchors be missing?

- Some issues may not have enough reliable page or text-location data to support a highlight.
- Use the issue text, report section, and saved review context to continue review where needed.
- Missing page highlighting should be treated as a display limitation, not automatic proof that a finding is incorrect.

### I changed settings but do not see the effect

- Use **Save Changes** in Settings.
- Some preferences are stored in the current browser only.
- Some session-related changes apply after the next interaction or sign-in.

## Document Scope

This guide covers current user-facing application behaviour in the repository. It does not document:

- local project setup
- backend or frontend implementation
- API contracts
- CI/CD
- developer workflows
