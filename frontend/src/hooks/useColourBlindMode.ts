import { useEffect, useState } from "react";
import { USER_DISPLAY_PREFS_CHANGED } from "../utils/userDisplayPreferences";

/** Re-reads when display prefs are applied or saved (same tab). */
export function useColourBlindMode(): boolean {
  const [v, setV] = useState(() => document.documentElement.dataset.colourBlind === "true");
  useEffect(() => {
    const sync = () => setV(document.documentElement.dataset.colourBlind === "true");
    sync();
    window.addEventListener(USER_DISPLAY_PREFS_CHANGED, sync);
    return () => window.removeEventListener(USER_DISPLAY_PREFS_CHANGED, sync);
  }, []);
  return v;
}
