/**
 * NotificationBell.tsx
 * Author: Abdulaziz Albaiji
 *
 * In-app notification bell that displays system announcements in a popover.
 *
 * Behaviour:
 *  - Polls GET /api/notifications every 30 seconds for fresh announcements.
 *  - Falls back to a static list (FALLBACK_ANNOUNCEMENTS) if the API is unavailable.
 *  - Read state is stored in localStorage, keyed per user email, so different
 *    users on the same browser maintain independent read histories.
 *  - Legacy read IDs (unkeyed) are migrated to the per-user key on first load.
 *  - Unread count badge updates in real-time; timestamps refresh every second
 *    via useLiveClock so "Xm ago" labels stay accurate without re-fetching.
 *  - "Mark all read" button clears the unread badge without a server round-trip.
 *
 * Announcement kinds: "admin", "team_manager", "feature" — each has a distinct
 * icon and colour to help users quickly identify the source.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Megaphone, Shield, Sparkles } from "lucide-react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import {
  notificationsApi,
  type InAppAnnouncementDto,
  type InAppAnnouncementKind,
} from "../../services/api.ts";
import { FALLBACK_ANNOUNCEMENTS } from "../../data/inAppAnnouncements.ts";

/** Legacy localStorage key used before per-user keying was introduced. */
const LEGACY_READ_IDS_KEY = "ligtas-announcement-read-ids";

/** Returns the localStorage key for a specific user's read announcement IDs. */
function readStorageKey(userEmail: string): string {
  const safe = userEmail.trim() || "anonymous";
  return `ligtas-announcement-read-ids:${encodeURIComponent(safe)}`;
}

/**
 * Parses a JSON-serialised array of string IDs from localStorage.
 * Returns an empty Set if the value is missing, malformed, or not an array.
 */
function parseReadIds(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

/**
 * Loads the set of announcement IDs that the user has already read.
 * Migrates legacy unkeyed read IDs to the per-user key on first call.
 */
function loadReadIdsForUser(userEmail: string): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  const key = readStorageKey(userEmail);
  const direct = parseReadIds(localStorage.getItem(key));
  if (direct.size > 0) return direct;
  // Migrate from the old unkeyed storage key so existing read state is preserved.
  const legacy = parseReadIds(localStorage.getItem(LEGACY_READ_IDS_KEY));
  if (legacy.size > 0) {
    localStorage.setItem(key, JSON.stringify([...legacy]));
    localStorage.removeItem(LEGACY_READ_IDS_KEY);
    return legacy;
  }
  return new Set();
}

/** Persists the user's current read announcement IDs to localStorage. */
function saveReadIdsForUser(userEmail: string, ids: Set<string>) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(readStorageKey(userEmail), JSON.stringify([...ids]));
}

/**
 * Returns display metadata for an announcement kind:
 * label text, icon component, and icon tile CSS classes.
 */
function kindMeta(kind: InAppAnnouncementKind): {
  label: string;
  Icon: typeof Megaphone;
  className: string;
} {
  switch (kind) {
    case "team_manager":
      return { label: "Team manager", Icon: Megaphone, className: "bg-gray-800 text-white" };
    case "admin":
      return { label: "Admin", Icon: Shield, className: "bg-black text-white" };
    case "feature":
      return { label: "New feature", Icon: Sparkles, className: "bg-gray-600 text-white" };
  }
}

/** Forces a re-render every second so relative timestamps (“Xm ago”) stay current. */
function useLiveClock() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
}

/**
 * Converts an ISO timestamp to a human-readable relative string.
 * Granularity: “just now” → minutes → hours → days → locale date.
 */
function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** How often (in ms) to re-fetch announcements from the server. */
const POLL_MS = 30_000;

interface NotificationBellProps {
  readonly userEmail: string;
}

export function NotificationBell({ userEmail }: NotificationBellProps) {
  const [announcements, setAnnouncements] = useState<InAppAnnouncementDto[]>(FALLBACK_ANNOUNCEMENTS);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIdsForUser(userEmail));

  useLiveClock();

  useEffect(() => {
    setReadIds(loadReadIdsForUser(userEmail));
  }, [userEmail]);

  useEffect(() => {
    saveReadIdsForUser(userEmail, readIds);
  }, [readIds, userEmail]);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      setAnnouncements(data.announcements);
      setServerTime(data.serverTime);
    } catch {
      setAnnouncements(FALLBACK_ANNOUNCEMENTS);
      setServerTime(new Date().toISOString());
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
    const id = window.setInterval(() => void refreshNotifications(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshNotifications]);

  /** Number of announcements the user has not yet opened. Drives the badge counter. */
  const unreadCount = useMemo(
    () => announcements.filter((a) => !readIds.has(a.id)).length,
    [announcements, readIds],
  );

  /** Marks a single announcement as read; no-ops if it was already read. */
  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds(new Set(announcements.map((a) => a.id)));
  }, [announcements]);

  const lastSyncedLabel = serverTime ? formatRelativeTime(serverTime) : null;

  return (
    <Popover className="relative">
      <PopoverButton
        type="button"
        className="relative rounded-lg p-2 outline-none transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-black dark:hover:bg-gray-800 dark:focus-visible:ring-white"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell className="size-5 text-gray-700 dark:text-gray-200" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-0.5 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </PopoverButton>

      <PopoverPanel
        modal={false}
        portal
        anchor="bottom end"
        transition
        className="z-[100] w-[min(100vw-2rem,22rem)] origin-top-right rounded-xl border-2 border-gray-200 bg-white py-2 shadow-xl [--anchor-gap:8px] focus:outline-none data-closed:scale-95 data-closed:opacity-0 dark:border-gray-600 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-3 pb-2 dark:border-gray-700">
          <div>
            <p className="text-sm font-bold text-black dark:text-white">Notifications</p>
            {lastSyncedLabel ? (
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Live · synced {lastSyncedLabel}</p>
            ) : null}
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-gray-700 underline decoration-gray-400 underline-offset-2 hover:text-black dark:text-gray-300 dark:hover:text-white"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                markAllRead();
              }}
            >
              Mark all read
            </button>
          ) : null}
        </div>

        <div className="max-h-[min(70vh,24rem)] overflow-y-auto px-1 py-1">
          {announcements.map((a) => {
            const unread = !readIds.has(a.id);
            const { label, Icon, className } = kindMeta(a.kind);
            const rel = formatRelativeTime(a.createdAt);
            return (
              <button
                key={a.id}
                type="button"
                className={`flex w-full gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  unread ? "bg-gray-50/80 dark:bg-gray-800/60" : ""
                }`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  markRead(a.id);
                }}
              >
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${className}`}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{rel}</span>
                    {unread ? (
                      <span className="size-1.5 rounded-full bg-black dark:bg-white" aria-label="Unread" />
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{a.title}</p>
                  <p className="mt-0.5 text-xs leading-snug text-gray-600 dark:text-gray-400">{a.body}</p>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverPanel>
    </Popover>
  );
}
