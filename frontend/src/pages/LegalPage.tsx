import { ArrowLeft, Cookie, FileText, Scale, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "../components/layout/Footer";

type LegalPageContent = {
  title: string;
  eyebrow: string;
  summary: string;
  icon: typeof ShieldCheck;
  sections: Array<{
    title: string;
    body: string;
  }>;
};

const pages = {
  privacy: {
    title: "Privacy Policy",
    eyebrow: "Data and privacy",
    summary:
      "This page explains the practical privacy position for the Ligtas QC handover build. It should be reviewed and replaced with the client's approved policy before production use.",
    icon: ShieldCheck,
    sections: [
      {
        title: "Information used by the app",
        body:
          "Ligtas QC uses account details, role information, uploaded report content, analysis results, review status, and basic security-event data to provide report upload, QC review, analytics, and administration workflows.",
      },
      {
        title: "Uploaded reports",
        body:
          "Uploaded reports are processed so the system can extract text, run QC checks, and display findings to authorised users. Any final retention rules should be agreed with the client before production deployment.",
      },
      {
        title: "Access and security",
        body:
          "Access is controlled through authenticated user accounts and role-based permissions. Password reset and email-sharing features depend on the email provider configured by the client.",
      },
      {
        title: "Client responsibility",
        body:
          "This project handover page is not a formal legal policy. The client should replace it with their own data protection, retention, and contact details before public or production use.",
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    eyebrow: "Use of Ligtas QC",
    summary:
      "These terms summarise sensible use of the handover build. They are intentionally simple and should be replaced by client-approved terms before production use.",
    icon: Scale,
    sections: [
      {
        title: "Purpose of the system",
        body:
          "Ligtas QC supports quality-control review of fire risk assessment reports by surfacing likely issues and organising review work. It is a decision-support tool, not a replacement for professional judgement.",
      },
      {
        title: "User responsibilities",
        body:
          "Users should review findings in context, check the original report, and decide whether each issue is valid, complete, or a false positive before taking action.",
      },
      {
        title: "Authorised access",
        body:
          "The application is intended for authorised users only. Users should not share accounts, bypass role restrictions, or upload documents they are not permitted to process.",
      },
      {
        title: "Production terms",
        body:
          "Availability, support, liability, data-retention commitments, and formal service terms should be defined by the client as part of production deployment.",
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    eyebrow: "Cookies and local storage",
    summary:
      "This page explains the simple cookie and browser-storage usage in the handover build. The client should update it if analytics, tracking, or extra integrations are added.",
    icon: Cookie,
    sections: [
      {
        title: "Essential authentication cookies",
        body:
          "Ligtas QC uses essential authentication cookies so signed-in users can access protected app areas. These cookies support login, session handling, and logout behaviour.",
      },
      {
        title: "Local browser preferences",
        body:
          "The frontend may store user interface preferences such as display mode, language, and accessibility preferences in the browser so the app can remember them between visits.",
      },
      {
        title: "No advertising cookies",
        body:
          "The handover build does not intentionally use advertising cookies or third-party marketing trackers. If the client adds analytics later, this page should be updated.",
      },
      {
        title: "Managing cookies",
        body:
          "Users can manage cookies and local storage through their browser settings, but disabling essential cookies may prevent login and protected workflows from working correctly.",
      },
    ],
  },
} satisfies Record<string, LegalPageContent>;

function LegalPage({ content }: { readonly content: LegalPageContent }) {
  const Icon = content.icon;

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7f9] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/about" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <img src="/ligtas-logo.png" alt="Ligtas QC" className="h-9 w-9 object-contain mix-blend-multiply" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-950">Ligtas QC</p>
              <p className="text-sm text-slate-500">{content.eyebrow}</p>
            </div>
          </Link>
          <Link
            to="/help"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            <ArrowLeft className="size-4" />
            Help Center
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Icon className="size-7" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{content.eyebrow}</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">{content.title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{content.summary}</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5">
          {content.sections.map((section) => (
            <article key={section.title} className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <FileText className="size-4" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-950">{section.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{section.body}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}

export function PrivacyPage() {
  return <LegalPage content={pages.privacy} />;
}

export function TermsPage() {
  return <LegalPage content={pages.terms} />;
}

export function CookiesPage() {
  return <LegalPage content={pages.cookies} />;
}
