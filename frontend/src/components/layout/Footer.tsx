import { Mail, MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/useLanguage";

interface FooterProps {
  readonly onNavigate?: (view: string) => void;
  readonly userRole?: "admin" | "team_manager" | "consultant";
}

export function Footer({ onNavigate, userRole }: FooterProps) {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();
  const isAuthenticatedFooter = Boolean(userRole);

  return (
    <footer className="mt-auto border-t-2 border-border bg-card text-card-foreground">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <img
                src="/ligtas-logo.png"
                alt=""
                className="h-10 w-10 object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
              />
              <span className="text-lg font-bold text-card-foreground">Ligtas QC</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("footerDescription")}</p>
          </div>

          <div>
            <h3 className="mb-4 font-bold text-card-foreground">{t("quickLinks")}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {isAuthenticatedFooter ? (
                <>
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigate?.("dashboard")}
                      className="text-left transition-colors hover:text-foreground"
                    >
                      {t("dashboard")}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigate?.("upload")}
                      className="text-left transition-colors hover:text-foreground"
                    >
                      {t("uploadReport")}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => onNavigate?.("history")}
                      className="text-left transition-colors hover:text-foreground"
                    >
                      {t("reportHistory")}
                    </button>
                  </li>
                  {userRole === "admin" && (
                    <li>
                      <button
                        type="button"
                        onClick={() => onNavigate?.("analytics")}
                        className="text-left transition-colors hover:text-foreground"
                      >
                        {t("qcTrendDashboard")}
                      </button>
                    </li>
                  )}
                </>
              ) : (
                <>
                  <li>
                    <Link to="/about" className="transition-colors hover:text-foreground">
                      About
                    </Link>
                  </li>
                  <li>
                    <Link to="/help" className="transition-colors hover:text-foreground">
                      {t("helpCenter")}
                    </Link>
                  </li>
                  <li>
                    <Link to="/login" className="transition-colors hover:text-foreground">
                      {t("login")}
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-bold text-card-foreground">{t("support")}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/help#user-documentation" className="transition-colors hover:text-foreground">
                  {t("documentation")}
                </Link>
              </li>
              <li>
                <Link to="/help" className="transition-colors hover:text-foreground">
                  {t("helpCenter")}
                </Link>
              </li>
              <li>
                <Link to="/about" className="transition-colors hover:text-foreground">
                  About
                </Link>
              </li>
              <li>
                <a href="mailto:support@ligtas.com" className="transition-colors hover:text-foreground">
                  {t("contactUs")}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-bold text-card-foreground">{t("contactUs")}</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 size-4 shrink-0" />
                <a href="mailto:support@ligtas.com" className="transition-colors hover:text-foreground">
                  support@ligtas.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 size-4 shrink-0" />
                <a href="tel:+442012345678" className="transition-colors hover:text-foreground">
                  +44 (0) 20 1234 5678
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>{t("londonUnitedKingdom")}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © {currentYear} Ligtas QC. {t("allRightsReserved")}
          </p>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Link to="/about" className="transition-colors hover:text-foreground">
              About
            </Link>
            <Link to="/help" className="transition-colors hover:text-foreground">
              {t("helpCenter")}
            </Link>
            <Link to="/help#user-documentation" className="transition-colors hover:text-foreground">
              {t("documentation")}
            </Link>
            <Link to="/privacy" className="transition-colors hover:text-foreground">
              {t("privacy")}
            </Link>
            <Link to="/terms" className="transition-colors hover:text-foreground">
              {t("terms")}
            </Link>
            <Link to="/cookies" className="transition-colors hover:text-foreground">
              {t("cookies")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
