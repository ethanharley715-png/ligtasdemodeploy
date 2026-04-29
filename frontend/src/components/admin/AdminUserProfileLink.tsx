import { Link } from "react-router-dom";
import { adminUserAnalyticsHref } from "../../utils/adminUserAnalytics";

type Props = {
  userId: string | number | null | undefined;
  isAdmin: boolean;
  className?: string;
  children: React.ReactNode;
};

/**
 * Renders a link to the admin user analytics profile when the viewer is an admin
 * and a stable user id is available; otherwise renders plain text.
 */
export function AdminUserProfileLink({ userId, isAdmin, className, children }: Props) {
  if (!isAdmin || userId == null || userId === "") {
    return <span className={className}>{children}</span>;
  }

  const id = typeof userId === "number" ? userId : Number(userId);
  if (!Number.isFinite(id)) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      to={adminUserAnalyticsHref(id)}
      className={
        className ??
        "font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
      }
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}
