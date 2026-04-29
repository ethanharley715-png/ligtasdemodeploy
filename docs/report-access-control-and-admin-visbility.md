# Report Access Control and Admin Visibility System

This document explains the design, implementation, and usage of the Report Access Control feature, including the extended Admin Visibility functionality introduced during development.

It is intended for both developers maintaining the system and users interacting with report data under different permission levels.

---

# Overview

The Report Access Control system ensures that report data is securely partitioned across users based on role and team association. This feature was extended to support more granular visibility for administrative users, while maintaining strict isolation for consultants.

The primary goal of this feature is to:

* Prevent unauthorised access to report data
* Align system behaviour with real-world organisational structures
* Support scalable team-based workflows
* Enable administrative oversight without compromising data separation

This feature is a core part of the overall Ligtas QC system, which focuses on assisting report quality control through structured issue detection, review workflows, and analytics.

---

# Relationship to the Overall System

Within the wider application, report access control operates alongside several key workflows:

* **Report Upload and Analysis**
  Users upload PDF reports which are processed and analysed using rule-based and AI-assisted scanning.

* **Issue Detection and Review**
  Identified issues are stored and reviewed by users depending on their role.

* **Analytics and Reporting**
  Aggregated data is used to generate insights at both team and system level.

The access control feature ensures that all of the above workflows operate within correct permission boundaries, preventing cross-user data exposure.

---

# Feature Contribution Summary

This feature introduces a structured visibility model integrated across both backend and frontend layers.

Key contributions include:

* Implementation of role-based report filtering at the API level
* Integration of team-scoped access logic for team managers
* Extension of administrator privileges to support full system visibility
* Consistent enforcement of access rules across all report endpoints
* Synchronisation of backend filtering with frontend UI rendering
* Improved error handling for unauthorised access attempts

Additionally, this feature required linking backend data access logic with frontend state management to ensure that visible reports accurately reflect user permissions at all times.

This contribution also involved refining how data flows between layers of the system, ensuring that security constraints are enforced as early as possible in the request lifecycle.

---

# System Design

## Role-Based Access Model

The system defines three primary roles:

* Consultant
* Team Manager
* Administrator

Each role determines the scope of accessible report data.

| Role          | Access Scope                 |
| ------------- | ---------------------------- |
| Consultant    | Own reports only             |
| Team Manager  | Reports within assigned team |
| Administrator | All reports                  |

This model reflects real-world organisational hierarchies and ensures that access control remains intuitive for users.

---

## Backend Implementation

### Core Logic Location

The access control logic is primarily implemented within:

```text
backend/src/services/reportService.ts
backend/src/services/reportAnalysisService.ts
backend/src/repositories/
```

Filtering is applied before any report data is returned to the client.

---

### Report Query Filtering

When fetching reports, the system dynamically adjusts database queries based on the authenticated user:

* Consultants: filtered by `createdById`
* Team Managers: filtered by `teamId`
* Administrators: no filtering applied

This ensures that users only receive authorised data directly from the database layer, reducing the risk of over-fetching sensitive data.

---

### Endpoint Enforcement

The following endpoints enforce access control:

* `GET /api/reports`
* `GET /api/reports/:id`
* `GET /api/users/:id/reports`

Before returning data, each request passes through:

* authentication middleware
* role validation logic
* scoped query filtering

This layered approach ensures that security is not dependent on a single component.

---

### Error Handling

If a user attempts to access a report outside their permission scope:

```json
{
  "code": "unauthorized_access",
  "message": "You do not have permission to access this report."
}
```

This provides clear feedback while preventing leakage of sensitive information.

---

## Frontend Integration

### UI Behaviour

The frontend dynamically adapts based on user role:

* Report lists only display permitted reports
* Navigation options are role-aware
* Restricted data is never rendered in the UI

This improves usability by ensuring users only see relevant information.

---

### Data Synchronisation

Frontend API calls are aligned with backend filtering:

* No client-side filtering is relied upon for security
* All filtering is server-driven
* The frontend simply renders returned data

This ensures consistency and avoids duplication of logic.

---

# Admin Visibility Extension (Your Feature)

## Motivation

During development, it was identified that administrators required a complete system overview for:

* auditing report quality
* monitoring system usage
* managing users and teams effectively

However, earlier implementations did not consistently provide full visibility across all report-related flows.

---

## Implementation

The Admin Visibility extension introduces:

* unrestricted report access across all teams
* consistent admin access across all report endpoints
* integration with analytics and export workflows

Changes included:

* removing team-based filtering conditions for admin users
* ensuring admin role bypasses all scope restrictions
* updating frontend views to reflect full dataset visibility

This required careful coordination between backend services and frontend components to avoid inconsistencies.

---

## Impact

This enhancement allows administrators to:

* view all reports in the system
* analyse cross-team trends
* export system-wide report data
* perform quality assurance at scale

It also improves maintainability by centralising role logic rather than duplicating conditions across components.

---

# Security Considerations

The feature enforces strict server-side access control:

* all requests require authentication
* role checks are performed before database access
* sensitive data is never exposed to unauthorised users

This ensures that:

* frontend manipulation cannot bypass restrictions
* API endpoints remain secure under direct access
* data privacy is maintained across all roles

From a design perspective, prioritising backend enforcement significantly reduces the attack surface of the application.

---

# Example Workflow

A typical system interaction:

1. A consultant uploads a report.
2. The report is stored with a user and team association.
3. The consultant can access and review the report.
4. A team manager can access the report if within their team.
5. An administrator can access the report regardless of ownership.

Attempting to access a report outside of permissions results in a controlled error response.

---

# Design Decisions

## Server-Side Enforcement

While server side enforcement provides strong security guarantees, it introduces additional complexity in service layer logic and requires careful testing to ensure all endpoints consistently apply filtering.

Access control is handled exclusively on the backend to:

* ensure security
* prevent reliance on frontend logic
* maintain a single source of truth

---

## Role-Based Query Filtering

Applying filtering at the database query level:

* improves performance
* reduces unnecessary data transfer
* simplifies frontend logic

---

## Separation of Concerns

Access logic is contained within services and repositories rather than route handlers, allowing:

* easier testing
* improved maintainability
* cleaner architecture

---

# Limitations

* Access control depends on correct team assignment
* No full audit trail of access attempts is stored
* Role changes require re-authentication to reflect updated permissions

---

# Future Improvements

The current role based model provides a scalable foundation, although future growth in user roles or organisational complexity may require more flexible permission systems such as attribute based access control (ABAC). 

Potential enhancements include:

* fine-grained permissions (e.g. per-report sharing)
* audit logging for access tracking
* configurable role hierarchies
* temporary access grants for collaboration

---

# Reflection on Implementation

The implementation of this feature highlighted the importance of integrating security considerations early in the design process. Rather than treating access control as a frontend concern, enforcing it at the backend level ensured consistency and robustness across all application flows.

Additionally, extending administrator visibility required careful consideration to avoid unintended data exposure while still enabling meaningful system oversight. This reinforced the need for clear role definitions and centralised logic.

The process also involved significant coordination between backend and frontend layers, particularly in ensuring that UI behaviour accurately reflected backend constraints.

One key learning from this implementation was the importance of designing access control as a first class architectural concern rather than an afterthought. Earlier iterations of the system exposed inconsistencies in how visibility was handled across endpoints, reinforcing the need for centralised enforcement. This experience highlighted how security related features often require cross cutting changes across multiple layers of the system.

---

# Handover Summary

The Report Access Control and Admin Visibility feature provides a secure and scalable method for managing report access across different user roles.

It ensures:

* consultants are restricted to their own data
* team managers have team-level oversight
* administrators have full system visibility

The feature is implemented consistently across backend services and frontend views, with server-side enforcement ensuring security and reliability.

It forms a fundamental part of the system’s overall architecture, supporting both usability and data protection requirements in a production-ready environment.

---
