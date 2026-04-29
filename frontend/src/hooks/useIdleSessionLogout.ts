import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getSessionTimeoutMinutesFromStorage } from "../utils/systemSettingsStorage.ts";

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

/**
 * Logs the user out after the configured idle period (Settings → Security → Session timeout).
 * Re-reads localStorage on each reset so changes apply without a full reload.
 */
export function useIdleSessionLogout(onLogout: () => void | Promise<void>, enabled: boolean) {
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  useEffect(() => {
    if (!enabled) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let throttleUntil = 0;

    const clearTimer = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    const schedule = () => {
      clearTimer();
      const minutes = getSessionTimeoutMinutesFromStorage();
      if (minutes === "never") return;
      const ms = minutes * 60 * 1000;
      timeoutId = setTimeout(() => {
        toast.info("You were logged out due to inactivity.");
        void Promise.resolve(onLogoutRef.current());
      }, ms);
    };

    const onActivity = () => {
      const now = Date.now();
      if (now < throttleUntil) return;
      throttleUntil = now + 750;
      schedule();
    };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    schedule();

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [enabled]);
}
