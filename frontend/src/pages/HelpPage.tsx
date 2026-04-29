import {
  ArrowRight,
  FileText,
  HelpCircle,
  History,
  Search,
  Shield,
  UploadCloud,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "../components/layout/Footer";

interface HelpPageProps {
  readonly isAuthenticated?: boolean;
}

const helpSections = [
  {
    id: "getting-started",
    label: "Getting Started",
    description: "Sign in, recover access, and understand what Ligtas QC is for.",
    icon: HelpCircle,
  },
  {
    id: "uploading-a-report",
    label: "Uploading a Report",
    description: "Accepted files, what happens after upload, and how processing behaves.",
    icon: UploadCloud,
  },
  {
    id: "understanding-qc-results",
    label: "Understanding QC Results",
    description: "How to interpret flagged findings and move through review safely.",
    icon: Search,
  },
  {
    id: "report-history",
    label: "Report History",
    description: "Return to saved reports and continue review without losing context.",
    icon: History,
  },
  {
    id: "pdf-review",
    label: "PDF Review / Issue Highlighting",
    description: "Why highlights appear, and why some issues may not show page anchors.",
    icon: FileText,
  },
  {
    id: "roles-and-access",
    label: "Roles and Access",
    description: "Public, role-safe explanation of what different users can expect.",
    icon: Shield,
  },
];

function SectionShell({
  id,
  title,
  eyebrow,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly eyebrow: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[1.75rem] border border-stone-200 bg-white p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{title}</h2>
        </div>
        <a
          href="#top"
          className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
        >
          Top
        </a>
      </div>
      <div className="mt-6 space-y-5 text-sm leading-7 text-slate-700">{children}</div>
    </section>
  );
}

function BulletList({ items }: { readonly items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-sky-600" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function FaqCard({
  question,
  answer,
}: {
  readonly question: string;
  readonly answer: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
      <p className="font-semibold text-slate-950">{question}</p>
      <p className="mt-2 text-sm leading-7 text-slate-700">{answer}</p>
    </div>
  );
}

export default function HelpPage({ isAuthenticated = false }: HelpPageProps) {
  return (
    <div id="top" className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to={isAuthenticated ? "/" : "/login"} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <img src="/ligtas-logo.png" alt="Ligtas QC" className="h-9 w-9 object-contain mix-blend-multiply" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-950">Ligtas QC</p>
              <p className="text-sm text-slate-500">Help Center</p>
            </div>
          </Link>

          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link
              to="/about"
              className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              About
            </Link>
            <Link
              to={isAuthenticated ? "/" : "/login"}
              className="rounded-full bg-slate-950 px-4 py-2 text-white transition hover:bg-slate-800"
            >
              {isAuthenticated ? "Return to app" : "Sign in"}
            </Link>
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="public-page-reveal rounded-[2rem] border border-slate-200 bg-white p-8 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-5">
              <span className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700">
                Public help
              </span>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
                  Hi. How can we help?
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-600">
                  This Help Center explains the everyday product workflow: signing in, uploading reports, reading QC
                  results, returning to report history, and understanding why PDF highlighting can sometimes be limited.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#getting-started"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
                >
                  Get started
                  <ArrowRight className="size-4" />
                </a>
                <a
                  href="#user-documentation"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  User Documentation
                </a>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                <Search className="size-5 text-slate-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-950">Popular questions</p>
                  <p className="text-sm text-slate-500">Use the topic cards below to jump straight to the right section.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href="#uploading-a-report" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
                  Uploading a report
                </a>
                <a href="#understanding-qc-results" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
                  QC results
                </a>
                <a href="#pdf-review" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
                  PDF highlighting
                </a>
                <a href="#troubleshooting" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
                  Troubleshooting
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="public-page-reveal reveal-delay-1 mt-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {helpSections.map(({ id, label, description, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className="public-page-scale-in group rounded-[1.5rem] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 text-xl font-bold tracking-tight text-slate-950">{label}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition group-hover:text-slate-950">
                  Jump to section
                  <ArrowRight className="size-4" />
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="public-page-reveal reveal-delay-2 space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Browse topics</p>
              <div className="mt-4 space-y-2">
                {[
                  ...helpSections.map(({ id, label }) => ({ id, label })),
                  { id: "contact-support", label: "Contact / Support" },
                ].map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                  >
                    {section.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-800 bg-slate-950 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Public guidance rules</p>
              <BulletList
                items={[
                  "This page omits internal debugging, admin-only controls, and hidden operational procedures.",
                  "Role labels are only used where they help users understand the normal product flow.",
                  "The separate User Documentation artefact stays broader and more formal than this in-app Help Center.",
                ]}
              />
              <Link
                to="/about"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Read About Ligtas QC
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </aside>

          <div className="public-page-reveal reveal-delay-3 space-y-8">
            <SectionShell id="getting-started" title="Getting Started" eyebrow="Start here">
              <p>
                Ligtas QC supports review of fire risk assessment reports by surfacing likely non-technical issues and
                organising them into a clearer follow-up workflow.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <p className="font-semibold text-slate-950">Who can use it</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    The product supports consultants, team managers, and administrators. This public page focuses only on
                    general and role-safe workflows.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <p className="font-semibold text-slate-950">Signing in and recovery</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Sign in with your work account. If you forget your password, use the password-reset flow from the
                    sign-in page to request a reset link.
                  </p>
                </div>
              </div>
              <BulletList
                items={[
                  "Open the sign-in page and enter your email address and password.",
                  "If you cannot sign in, use the forgot-password page to request a reset link.",
                  "Follow the reset link and choose a new password if access recovery is needed.",
                ]}
              />
            </SectionShell>

            <SectionShell id="uploading-a-report" title="Uploading a Report" eyebrow="Core workflow">
              <p>
                Upload is the normal starting point for report review. The system accepts PDF files and processes them so
                the results can be checked in the QC workflow.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <p className="font-semibold text-slate-950">Accepted upload type</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Uploads are expected to be PDF files. Users should select the final report document they want checked.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <p className="font-semibold text-slate-950">What happens after upload</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    After upload, the report is processed and the user is taken toward QC review so the findings can be inspected.
                  </p>
                </div>
              </div>
              <BulletList
                items={[
                  "Select a PDF report from the upload page.",
                  "Start the upload and wait for processing to complete.",
                  "Use the results view to review issues rather than assuming the document is ready for release.",
                  "If the upload is cancelled, start again with the same or a different PDF.",
                ]}
              />
            </SectionShell>

            <SectionShell id="understanding-qc-results" title="Understanding QC Results" eyebrow="Review workflow">
              <p>
                QC results show likely review items that need human judgement. They exist to help reviewers focus on what
                needs checking first rather than replacing the reviewer's responsibility.
              </p>
              <BulletList
                items={[
                  "Issue categories group findings by the kind of problem detected, such as likely missing information or template artefacts.",
                  "Counts and review states help users understand whether a report appears clear, needs follow-up, or has already been reviewed.",
                  "Findings should be checked in context. A flagged issue may be valid, incomplete, or a false positive depending on the report.",
                  "After review, issues can be marked complete or treated as false positives where appropriate.",
                ]}
              />
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                <p className="font-semibold text-slate-950">After review</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  Use the saved report flow to revisit earlier results, continue review work, or inspect issue status again later.
                </p>
              </div>
            </SectionShell>

            <SectionShell id="report-history" title="Report History" eyebrow="Returning to saved work">
              <p>
                Report History is the normal route back into previously processed reports. It allows users to revisit saved
                results instead of depending on the immediate post-upload screen.
              </p>
              <BulletList
                items={[
                  "Open the history area to browse saved reports.",
                  "Use report detail pages to revisit results, inspect issues, and continue review work.",
                  "History is useful when a report needs a second pass or when teams need to return to earlier analysis outcomes.",
                ]}
              />
            </SectionShell>

            <SectionShell id="pdf-review" title="PDF Review / Issue Highlighting" eyebrow="Document inspection">
              <p>
                PDF review exists to keep the report document and the issue list visible together. It helps reviewers inspect
                where a finding sits within the uploaded report.
              </p>
            <BulletList
              items={[
                "Open PDF review when you want to check an issue against the report text on its page.",
                "The document is not already present in the viewer, so you need to upload the same PDF again before checking issues against the report text.",
                "Some findings may not show a page highlight if reliable page or text-location data is not available for that issue.",
                "Page-aware review depends on the issue data available for the saved report, so a missing highlight does not automatically mean the issue is invalid.",
              ]}
            />
            </SectionShell>

            <SectionShell id="roles-and-access" title="Roles and Access" eyebrow="Role-safe overview">
              <p>
                The platform supports different roles. This section only explains access at a safe public level and does not
                expose internal tooling or privileged operational procedures.
              </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">For all users</p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Sign in, upload reports where permitted, review results, and return to saved report history.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">For consultants</p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    Normal consultant work focuses on report upload, QC review, PDF review, and saved report follow-up.
                  </p>
                </div>
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">For team managers</p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  Team managers may also have access to team-scoped oversight features, but public guidance here remains intentionally high level.
                </p>
              </div>
            </div>
            </SectionShell>

            <SectionShell id="troubleshooting" title="Troubleshooting / FAQ" eyebrow="Common questions">
              <div className="grid gap-4 md:grid-cols-2">
                <FaqCard
                  question="My upload is not starting or was rejected."
                  answer="Check that you selected a PDF and that the file is suitable for upload. If the problem continues, retry the upload or contact support."
                />
                <FaqCard
                  question="No issues were found. Is that a problem?"
                  answer="Not necessarily. A clean result may simply mean no supported review signals were detected. The report still needs normal human review before release."
                />
                <FaqCard
                  question="Why is a page highlight missing?"
                  answer="Some issues do not have enough reliable page or text-location data to support a highlight. Use the issue text, report section, and review context instead of assuming the issue is incorrect."
                />
                <FaqCard
                  question="I cannot sign in or reset my password."
                  answer="Use the password-reset flow first. If access still cannot be recovered, contact your administrator or support route."
                />
              </div>
            </SectionShell>

            <SectionShell id="user-documentation" title="User Documentation" eyebrow="Formal artefact">
              <p>
                Full user documentation is maintained separately as a project documentation artefact. This Help Center acts as
                the concise operational version, while the markdown document remains the fuller formal guide.
              </p>
              <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                <p className="font-semibold text-slate-950">What the separate artefact covers</p>
                <BulletList
                  items={[
                    "The main user workflows in greater detail.",
                    "Role-based access at a broader documentation level.",
                    "Guidance for upload, QC review, saved-report review, settings, and account use.",
                  ]}
                />
              </div>
              <p>
                Because there is no stable in-app published documentation route yet, this page is the canonical in-app reference
                point for the separate user documentation artefact.
              </p>
            </SectionShell>

            <SectionShell id="contact-support" title="Contact / Support" eyebrow="Need further help?">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <p className="font-semibold text-slate-950">Support route</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    For account access or workflow questions, contact the support route shown in the footer or speak to your
                    normal internal contact for Ligtas QC support.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <p className="font-semibold text-slate-950">Suggested first step</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    Check the relevant Help section first, then return to your report or history view with that guidance in mind.
                  </p>
                </div>
              </div>
              <BulletList
                items={[
                  "Support email: support@ligtas.com",
                  "Use Help Center guidance for routine workflow questions before escalating.",
                  "Do not expect public help pages to explain internal admin tooling or privileged operational processes.",
                ]}
              />
            </SectionShell>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
