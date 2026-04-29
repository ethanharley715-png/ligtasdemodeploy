import { User, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";
import { Link } from "react-router-dom";
import { NotificationBell } from "./NotificationBell.tsx";
import { useLanguage } from "../../context/useLanguage";

interface HeaderProps {
  userName: string;
  userEmail: string;
  userRole: "admin" | "team_manager" | "consultant";
  onLogout: () => void;
  onNavigate: (view: string) => void;
  onLogoNavigateHome: () => void;
}

const ROLE_LABELS: Record<string, "admin" | "teamManager" | "consultant"> = {
  admin: "admin",
  team_manager: "teamManager",
  consultant: "consultant",
};

export function Header({
  userName,
  userEmail,
  userRole,
  onLogout,
  onNavigate,
  onLogoNavigateHome,
}: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-border bg-card px-6 py-4 text-card-foreground">
      <div className="flex items-center justify-between">
        {/* LEFT SIDE */}
        <Link
          to="/"
          onClick={(e) => {
            e.preventDefault();
            onLogoNavigateHome();
          }}
          className="flex cursor-pointer items-center gap-4 rounded-lg outline-none ring-offset-2 ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("dashboard")}
        >
          <img
            src="/ligtas-logo.png"
            alt=""
            className="h-12 w-12 shrink-0 object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
          />
          <div>
            <h1 className="text-xl font-bold text-card-foreground">Ligtas QC</h1>
            <p className="text-xs text-muted-foreground">{t("qualityControlSystem")}</p>
          </div>
        </Link>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{t("language")}</span>

            <div className="flex items-center overflow-hidden rounded-lg border border-border">
              {/* EN */}
              <button
                type="button"
                onClick={() => setLanguage("en")}
                aria-label={t("english")}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                  language === "en"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-foreground hover:bg-muted/70"
                }`}
              >
                <img
                  src="/flags/gb.svg"
                  alt="English"
                  className="h-4 w-6 rounded-sm object-cover"
                />
                EN
              </button>

              {/* CY */}
              <button
                type="button"
                onClick={() => setLanguage("cy")}
                aria-label={t("welsh")}
                className={`flex items-center gap-2 border-l border-border px-3 py-1.5 text-sm font-medium transition-colors ${
                  language === "cy"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 text-foreground hover:bg-muted/70"
                }`}
              >
                <img
                  src="/flags/wales.svg"
                  alt="Welsh"
                  className="h-4 w-6 rounded-sm object-cover"
                />
                CY
              </button>
            </div>
          </div>

          
          <NotificationBell userEmail={userEmail} />

          
          <Menu as="div" className="relative">
            <MenuButton className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/60">
              <div className="text-right">
                <p className="text-sm font-semibold text-card-foreground">{userName}</p>
                <p className="text-xs text-muted-foreground">{t(ROLE_LABELS[userRole] ?? "consultant")}</p>
              </div>
              <div className="rounded-full bg-primary p-2 text-primary-foreground">
                <User className="size-5" />
              </div>
            </MenuButton>

            <MenuItems className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-lg border-2 border-border bg-popover text-popover-foreground shadow-lg focus:outline-none">
              <div className="border-b border-border px-4 py-3">
                <p className="font-semibold text-popover-foreground">{userName}</p>
                <p className="text-xs font-normal text-muted-foreground">{userEmail}</p>
              </div>

              <MenuItem>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={() => onNavigate("profile")}
                    className={`flex w-full items-center px-4 py-2 text-sm text-popover-foreground ${
                      focus ? "bg-muted/80" : ""
                    }`}
                  >
                    <User className="mr-2 size-4" />
                    {t("myProfile")}
                  </button>
                )}
              </MenuItem>

              <MenuItem>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={() => onNavigate("settings")}
                    className={`flex w-full items-center px-4 py-2 text-sm text-popover-foreground ${
                      focus ? "bg-muted/80" : ""
                    }`}
                  >
                    <SettingsIcon className="mr-2 size-4" />
                    {t("settings")}
                  </button>
                )}
              </MenuItem>

              <MenuItem>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={onLogout}
                    className={`flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 ${
                      focus ? "bg-red-50 dark:bg-red-950/50" : ""
                    }`}
                  >
                    <LogOut className="mr-2 size-4" />
                    {t("signOut")}
                  </button>
                )}
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>
      </div>
    </header>
  );
}