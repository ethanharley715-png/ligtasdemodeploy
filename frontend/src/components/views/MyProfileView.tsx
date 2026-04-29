/**
 * MyProfileView.tsx: Responsible for handling user profile display, password security, recent reports and
 * password editing. Includes integration for backend APIs for statistics and reports.
 * Includes advanced password strength validation for improved security.
 * Recent reports are layed out in a scrollable format and live data is fetched from the backend API to ensure accuracy.
 */

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Pencil, Save, X } from "lucide-react";
//Utilities for password strength analysis (custom security feature)
import { analyzePassword } from "../../utils/passwordSecurity";
import { reportsApi, authApi, usersApi, type ProfileStats, type ReportListItem } from "../../services/api";
import { loadPasswordPolicyFromStorage, validatePasswordAgainstPolicy } from "../../utils/systemSettingsStorage.ts";
import { useLanguage } from "../../context/useLanguage";
interface User {
  name: string;
  email: string;
  role: "admin" | "team_manager" | "consultant";
}
// Defines the structure for password strength analysis and validation checks.
type PasswordAnalysis = {
  strength: "weak" | "medium" | "strong";
  checks: {
    lengthValid: boolean;
    uppercase: boolean;
    number: boolean;
    special: boolean;
    notCommon: boolean;
  };
};

interface MyProfileViewProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

const ROLE_LABELS: Record<User["role"], "admin" | "teamManager" | "consultant"> = {
  admin: "admin",
  team_manager: "teamManager",
  consultant: "consultant",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function MyProfileView({ user, onUserUpdate }: MyProfileViewProps) {
  const { t } = useLanguage();
  const initials = getInitials(user.name || user.email);

  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [recentReports, setRecentReports] = useState<
    Array<Pick<ReportListItem, "id" | "fileName" | "uploadDate" | "status" | "issuesFound">>
  >([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedName, setEditedName] = useState(user.name);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // Stores real time password strength analysis for the UX feedback
  const [passwordAnalysis, setPasswordAnalysis] = useState<PasswordAnalysis | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const openProfileEditor = () => {
    setIsEditingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);
    setEditedName(user.name);
  };

  const cancelProfileEditor = () => {
    setIsEditingProfile(false);
    setProfileError(null);
    setEditedName(user.name);
  };

  const resetPasswordFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordAnalysis(null);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const openPasswordForm = () => {
    setShowPasswordForm(true);
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const cancelPasswordForm = () => {
    setShowPasswordForm(false);
    setPasswordError(null);
    resetPasswordFields();
  };
  
  // Loads the user statistics and recent reports from the backend APIs
  useEffect(() => {
    setEditedName(user.name);
  }, [user.name]);

  useEffect(() => { // Loads the user stats and recent reports asynchronously on component mount.
    let cancelled = false;

    async function loadStats() {
      setStatsLoading(true);
      setStatsError(null);

      try {
        const data = await reportsApi.stats();
        if (!cancelled) {
          setStats(data);
        }
      } catch (e) {
        if (!cancelled) {
          setStatsError(e instanceof Error ? e.message : t("failedToLoadProfileStats"));
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    }

    async function loadRecentReports() {
      setRecentLoading(true);
      setRecentError(null);

      try {
        const data = await reportsApi.recent();
        if (!cancelled) {
          setRecentReports(data);
        }
      } catch (e) {
        if (!cancelled) {
          setRecentError(e instanceof Error ? e.message : t("failedToLoadRecentReports"));
        }
      } finally {
        if (!cancelled) {
          setRecentLoading(false);
        }
      }
    }

    void Promise.all([loadStats(), loadRecentReports()]);

    return () => {
      cancelled = true;
    };
  }, [t]);
  
  // Handles the updated user profile information via the backend API
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const trimmedName = editedName.trim();

    if (!trimmedName) {
      setProfileError(t("nameRequired"));
      return;
    }

    if (trimmedName.length < 2) {
      setProfileError(t("nameTooShort"));
      return;
    }

    if (trimmedName.length > 100) {
      setProfileError(t("nameTooLong"));
      return;
    }

    setProfileLoading(true);

    try {
      const updated = await usersApi.updateMe({ name: trimmedName });

      const updatedUser: User = {
        name: updated.name,
        email: updated.email,
        role:
          updated.userType === "adm"
            ? "admin"
            : updated.userType === "tm"
              ? "team_manager"
              : "consultant",
      };

      onUserUpdate(updatedUser);
      setProfileSuccess(t("profileUpdatedSuccessfully"));
      setIsEditingProfile(false);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : t("failedToUpdateProfile"));
    } finally {
      setProfileLoading(false);
    }
  };

  // Handles secure password updates with validation and policy enforcement
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t("allPasswordFieldsRequired"));
      return; // All password fields are filled.
    }

    const policyError = validatePasswordAgainstPolicy(newPassword, loadPasswordPolicyFromStorage());
    if (policyError) {
      setPasswordError(policyError);
      return; // Validate password against the system wide security policy as shown.
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordConfirmationMismatch"));
      return; // Makes sure that the new passwords matches the confirmation.
    }

    if (currentPassword === newPassword) {
      setPasswordError(t("newPasswordMustBeDifferent"));
      return; // Doesn't allow the same password which is current to be reused.
    }

    if (passwordAnalysis?.strength === "weak") { // Prevents weak passwords to overall improve account security.
      setPasswordError("Password is too weak.");
      return; // Blocks weak passwords based on the local strength analysis.
    }

    setPasswordLoading(true);

    try {
      const response = await authApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      // Sends password update to the backend.

      setPasswordSuccess(response.message || t("passwordUpdatedSuccessfully")); 
      resetPasswordFields();
      setShowPasswordForm(false);
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : t("failedToUpdatePassword"));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-10 dark:bg-gray-950">
      <div className="mx-auto max-w-[1400px] space-y-10">
        <div>
          <h1 className="mb-2 text-4xl font-bold text-black dark:text-white">{t("myProfile")}</h1>
        </div>

        <section className="rounded-2xl border-2 border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black text-2xl font-bold text-white">
                {initials || "U"}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black dark:text-white">{user.name}</h2>
                <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                    {t(ROLE_LABELS[user.role])}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
          <div className="space-y-8 xl:col-span-2">
            <section className="rounded-2xl border border-gray-200 bg-white shadow-md transition-shadow duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-col gap-3 border-b-2 border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xl font-bold text-black dark:text-white">{t("personalInformation")}</h3>
                {!isEditingProfile && (
                  <button
                    type="button"
                    onClick={openProfileEditor}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    {t("editProfile")}
                  </button>
                )}
              </div>

              <div className="p-6">
                {profileSuccess && (
                  <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-700">{profileSuccess}</p>
                  </div>
                )}

                {profileError && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-600">{profileError}</p>
                  </div>
                )}

                {isEditingProfile ? (
                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700">
                        {t("fullName")}
                      </label>
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="block w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-white"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                        <p className="mb-1 text-sm font-semibold text-gray-500">{t("emailAddress")}</p>
                        <p className="text-base font-medium text-black dark:text-white">{user.email}</p>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                        <p className="mb-1 text-sm font-semibold text-gray-500">{t("role")}</p>
                        <p className="text-base font-medium text-black dark:text-white">{t(ROLE_LABELS[user.role])}</p>
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={cancelProfileEditor}
                        disabled={profileLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                      >
                        <X className="size-4" aria-hidden="true" />
                        {t("cancel")}
                      </button>
                      <button
                        type="submit"
                        disabled={profileLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                      >
                        <Save className="size-4" aria-hidden="true" />
                        {profileLoading ? t("saving") : t("saveProfile")}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                      <p className="mb-1 text-sm font-semibold text-gray-500">{t("fullName")}</p>
                      <p className="text-base font-medium text-black dark:text-white">{user.name}</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                      <p className="mb-1 text-sm font-semibold text-gray-500">{t("emailAddress")}</p>
                      <p className="text-base font-medium text-black dark:text-white">{user.email}</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                      <p className="mb-1 text-sm font-semibold text-gray-500">{t("role")}</p>
                      <p className="text-base font-medium text-black dark:text-white">{t(ROLE_LABELS[user.role])}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white shadow-md transition-shadow duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-col gap-3 border-b-2 border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xl font-bold text-black dark:text-white">{t("accountSecurity")}</h3>
                {!showPasswordForm && (
                  <button
                    type="button"
                    onClick={openPasswordForm}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    <KeyRound className="size-4" aria-hidden="true" />
                    {t("changePassword")}
                  </button>
                )}
              </div>

  
              <div className="space-y-4 p-6">
                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                  <div>
                    <p className="font-semibold text-black dark:text-white">{t("password")}</p>
                  </div>
                </div>

                {passwordSuccess && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-700">{passwordSuccess}</p>
                  </div>
                )}

                {showPasswordForm && (
                  <form
                    onSubmit={handlePasswordSubmit}
                    className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80"
                  >
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700">
                        {t("currentPassword")}
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="block w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2.5 pr-12 text-gray-900 focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-white"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-black"
                          aria-label={showCurrentPassword ? t("hideCurrentPassword") : t("showCurrentPassword")}
                        >
                          {showCurrentPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                        </button>
                      </div>
                    </div>
                
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700">
                        {t("newPassword")}
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => { // Updates the password and run strength analysis on every change.
                            const value = e.target.value;
                            setNewPassword(value); // Performs real time password strength analysis to guide user input.
                            setPasswordAnalysis(analyzePassword(value) as PasswordAnalysis);
                          }}
                          className="block w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2.5 pr-12 text-gray-900 focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-white"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-black"
                          aria-label={showNewPassword ? t("hideNewPassword") : t("showNewPassword")}
                        >
                          {showNewPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                        </button>
                      </div>

                      {passwordAnalysis?.checks && ( // Displays real time password strength and validation checks for user guidance.
                        <div className="mt-3 rounded-lg border bg-gray-50 p-3 dark:bg-gray-800/60">
                          <p className="font-semibold">
                            Strength:{" "}
                            <span
                              className={
                                passwordAnalysis.strength === "strong"
                                  ? "text-green-600"
                                  : passwordAnalysis.strength === "medium"
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }
                            >
                              {passwordAnalysis.strength.toUpperCase()}
                            </span>
                          </p>

                          <ul className="mt-2 space-y-1 text-sm">
                            <li>{passwordAnalysis.checks.lengthValid ? "✔" : "✖"} 8+ characters</li>
                            <li>{passwordAnalysis.checks.uppercase ? "✔" : "✖"} Uppercase letter</li>
                            <li>{passwordAnalysis.checks.number ? "✔" : "✖"} Number</li>
                            <li>{passwordAnalysis.checks.special ? "✔" : "✖"} Special character</li>
                            <li>{passwordAnalysis.checks.notCommon ? "✔" : "✖"} Not a common password</li>
                          </ul>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700">
                        {t("confirmNewPassword")}
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="block w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2.5 pr-12 text-gray-900 focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-white"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-black"
                          aria-label={showConfirmPassword ? t("hideConfirmPassword") : t("showConfirmPassword")}
                        >
                          {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                        </button>
                      </div>
                    </div>

                    {passwordError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                        <p className="text-sm font-medium text-red-600">{passwordError}</p>
                      </div>
                    )}

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={cancelPasswordForm}
                        disabled={passwordLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                      >
                        <X className="size-4" aria-hidden="true" />
                        {t("cancel")}
                      </button>
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                      >
                        <Save className="size-4" aria-hidden="true" />
                        {passwordLoading ? t("saving") : t("savePassword")}
                      </button>
                    </div>
                  </form>
                )}

              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white shadow-md transition-shadow duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900">
              <div className="border-b-2 border-gray-200 px-6 py-5">
                <h3 className="text-xl font-bold text-black dark:text-white">{t("recentReports")}</h3>
              </div> 

              <div className="flex gap-4 overflow-x-auto p-6">
                {recentLoading ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t("loadingRecentReports")}</p>
                  </div>
                ) : recentError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-600">{recentError}</p>
                  </div>
                ) : recentReports.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t("noReportsUploadedYet")}</p>
                  </div>
                ) : (
                  recentReports.map((report) => ( // Renders recent reports with status indicators for a quick user insight.
                    <div
                      key={report.id}
                      className="min-w-[280px] flex-shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="break-words font-semibold text-black dark:text-white">{report.fileName}</p>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {new Date(report.uploadDate).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                          <p className="mt-2 text-sm text-gray-500">
                            {t("issuesFound")}: {report.issuesFound}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            report.status === "passed"
                              ? "bg-green-100 text-green-700"
                              : report.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {report.status === "passed"
                            ? t("passed").toUpperCase()
                            : report.status === "failed"
                              ? t("failed").toUpperCase()
                              : t("processing").toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className="rounded-2xl border border-gray-200 bg-white shadow-md hover:shadow-lg transition-shadow duration-200 dark:border-gray-700 dark:bg-gray-900">
              <div className="border-b-2 border-gray-200 px-6 py-5">
                <h3 className="text-xl font-bold text-black dark:text-white">{t("myStats")}</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-1">
                {statsLoading ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t("loadingStats")}</p>
                  </div>
                ) : statsError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-600">{statsError}</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                      <p className="text-sm font-semibold text-gray-500">{t("reportsUploaded")}</p>
                      <p className="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white">{stats?.totalReports ?? 0}</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                      <p className="text-sm font-semibold text-gray-500">{t("completedReports")}</p>
                      <p className="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white">{stats?.completedReports ?? 0}</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                      <p className="text-sm font-semibold text-gray-500">{t("failedReports")}</p>
                      <p className="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white">{stats?.failedReports ?? 0}</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                      <p className="text-sm font-semibold text-gray-500">{t("reportsProcessing")}</p>
                      <p className="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white">{stats?.processingReports ?? 0}</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                      <p className="text-sm font-semibold text-gray-500">{t("issuesDetected")}</p>
                      <p className="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white">{stats?.totalIssues ?? 0}</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/80">
                      <p className="text-sm font-semibold text-gray-500">{t("passRate")}</p>
                      <p className="mt-2 text-3xl font-extrabold tracking-tight text-black dark:text-white">
                        {stats ? `${stats.passRate.toFixed(2)}%` : "0.00%"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>

            
          </div>
        </div>
      </div>
    </div>
  );
}
