import { useEffect, useState } from "react";
import { USER_DISPLAY_PREFS_CHANGED } from "../utils/userDisplayPreferences";

export function useIsDarkMode(): boolean {
  const [v, setV] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const sync = () => setV(document.documentElement.classList.contains("dark"));
    sync();
    window.addEventListener(USER_DISPLAY_PREFS_CHANGED, sync);
    return () => window.removeEventListener(USER_DISPLAY_PREFS_CHANGED, sync);
  }, []);
  return v;
}
