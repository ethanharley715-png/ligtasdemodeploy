import { ArrowRight, CheckCircle2, Compass, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "../components/layout/Footer";

interface AboutPageProps {
  readonly isAuthenticated?: boolean;
}

const capabilityCards = [
  {
    title: "Report upload and analysis",
    description:
      "Submit report PDFs for automated quality checks that surface likely issues before final review.",
    icon: Compass,
  },
  {
    title: "QC issue identification",
    description:
      "Highlight likely missing information, contradictions, template artefacts, and other review signals in one place.",
    icon: Sparkles,
  },
  {
    title: "Review history and oversight",
    description:
      "Return to previous reports, revisit findings, and keep review workflows visible across the wider team.",
    icon: Users,
  },
];

export default function AboutPage({ isAuthenticated = false }: AboutPageProps) {
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <div className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.18),_transparent_34%),linear-gradient(135deg,_#0f172a,_#111827_52%,_#1f2937)] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link to={isAuthenticated ? "/" : "/login"} className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white">
              <img src="/ligtas-logo.png" alt="Ligtas QC" className="h-10 w-10 object-contain mix-blend-multiply" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">Ligtas QC</p>
              <p className="text-sm text-slate-300">Public product information</p>
            </div>
          </Link>

          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link
              to="/help"
              className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/45 hover:bg-white/10"
            >
              Help Center
            </Link>
            <Link
              to={isAuthenticated ? "/" : "/login"}
              className="rounded-full bg-white px-4 py-2 text-slate-950 transition hover:bg-slate-100"
            >
              {isAuthenticated ? "Return to app" : "Sign in"}
            </Link>
          </nav>
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 px-6 pb-16 pt-8 lg:grid-cols-[1.35fr_0.9fr] lg:items-end lg:pb-20">
          <div className="public-page-reveal space-y-6">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200">
              About Ligtas QC
            </span>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
                Quality control support for report review, without burying teams in manual checks.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-200">
                Ligtas QC helps review teams inspect fire risk assessment reports faster by surfacing likely non-technical
                issues, organising findings clearly, and keeping review work visible from upload through saved report history.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/help"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Visit Help Center
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to={isAuthenticated ? "/" : "/login"}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
              >
                {isAuthenticated ? "Go to dashboard" : "Sign in to continue"}
              </Link>
            </div>
          </div>

          <div className="public-page-scale-in reveal-delay-1 grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="flex items-start gap-4 rounded-3xl border border-white/10 bg-white/5 p-5">
              <ShieldCheck className="mt-1 size-5 text-slate-200" />
              <div>
                <p className="font-semibold text-white">Trustworthy review support</p>
                <p className="mt-2 text-sm leading-7 text-slate-200">
                  Ligtas QC is designed to improve visibility and consistency in report checking. It supports human review
                  rather than replacing reviewer judgement.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-3xl border border-white/10 bg-slate-950/25 p-5">
              <CheckCircle2 className="mt-1 size-5 text-slate-200" />
              <div>
                <p className="font-semibold text-white">Built for day-to-day operations</p>
                <p className="mt-2 text-sm leading-7 text-slate-200">
                  Upload, results review, PDF review, and report history sit in one workflow so teams can move from
                  detection to action without losing context.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="public-page-reveal reveal-delay-2 space-y-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.05)]">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">What the system does</p>
              <h2 className="text-3xl font-black tracking-tight text-slate-950">A clearer review workflow for professional reports</h2>
              <p className="max-w-2xl text-base leading-8 text-slate-600">
                Ligtas QC automates quality-control support around fire risk assessment reports. It reduces repetitive manual
                checking, improves visibility of likely issues, and helps teams keep report review decisions organised across
                current and past work.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Who it is for</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
                  <li>
                    <span className="font-semibold text-slate-950">Consultants:</span> upload reports, review results, inspect PDF context,
                    and revisit saved reports.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-950">Team managers:</span> oversee team report quality at a high level and
                    support consistent review practice.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-950">Admins and operations:</span> maintain oversight of platform usage and
                    overall quality trends without exposing internal operational controls here.
                  </li>
                </ul>
              </div>

              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Why it matters</p>
                <p className="mt-4 text-sm leading-7 text-slate-700">
                  Review teams need a reliable way to spot likely issues quickly, revisit past work confidently, and keep
                  review workflows consistent. Ligtas QC improves operational efficiency while preserving the role of the
                  reviewer in deciding what action to take.
                </p>
              </div>
            </div>
          </section>

          <section className="public-page-reveal reveal-delay-3 space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Core capabilities</p>
              <h2 className="text-3xl font-black tracking-tight text-slate-950">What users can expect from the product</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {capabilityCards.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="public-page-scale-in flex h-full flex-col rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.04)]"
                >
                  <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-950">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
                </article>
              ))}
            </div>

            <div className="rounded-[2rem] bg-slate-950 p-8 text-white">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Next step</p>
              <h3 className="mt-3 text-3xl font-black tracking-tight">Need practical guidance rather than product overview?</h3>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                The Help Center explains how to sign in, upload a report, understand QC results, use report history, interpret
                PDF review behaviour, and find the separate user documentation artefact.
              </p>
              <div className="mt-6">
                <Link
                  to="/help"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Open Help Center
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
