import { useSyncExternalStore } from "react";
import { isServerWaking, onServerWaking } from "../lib/api";

// Shown while the first request waits on a sleeping backend (Render free plan).
const ServerWakeNotice = () => {
  const waking = useSyncExternalStore(onServerWaking, isServerWaking);
  if (!waking) return null;

  return (
    <div className="wake-notice" role="status" aria-live="polite">
      <span className="wake-notice__dot" aria-hidden="true" />
      Waking up the server… the first request after a quiet spell can take up to a minute.
    </div>
  );
};

export default ServerWakeNotice;
