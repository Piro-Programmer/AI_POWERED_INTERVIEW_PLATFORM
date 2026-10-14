import { useState } from "react";
import { shareReport, unshareReport } from "../../ai/services/interview.api";
import { shareUrl } from "../shareUrl";
import "../share.scss";

/** Owner's controls for a report's read-only link: create, copy, revoke. */
const SharePanel = ({ reportId, token, onChange }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const run = async (action) => {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      await action();
    } catch (err) {
      setError(err.response?.data?.message || "That didn’t work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const turnOn = () => run(async () => onChange((await shareReport(reportId)).shareToken));
  const turnOff = () =>
    run(async () => {
      await unshareReport(reportId);
      onChange(null);
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopied(true);
    } catch {
      setError("Couldn’t copy. Select the link and copy it yourself.");
    }
  };

  return (
    <section className="share-panel" aria-labelledby="share-heading">
      <div>
        <h3 id="share-heading">Share this report</h3>
        <p>
          {token
            ? "Anyone with this link can read the report without signing in. They can’t see your profile, your plan progress or your practice."
            : "Make a read-only link to send to a mentor or a friend. You can turn it off any time."}
        </p>
      </div>

      {token ? (
        <div className="share-panel__link">
          <label className="sr-only" htmlFor="share-link">Share link</label>
          <input id="share-link" readOnly value={shareUrl(token)} onFocus={(e) => e.target.select()} />
          <button type="button" className="button primary-button" onClick={copy} disabled={busy}>
            {copied ? "Copied" : "Copy link"}
          </button>
          <button type="button" className="button danger-button" onClick={turnOff} disabled={busy}>
            Stop sharing
          </button>
        </div>
      ) : (
        <button type="button" className="button primary-button" onClick={turnOn} disabled={busy}>
          {busy ? "Creating link…" : "Create share link"}
        </button>
      )}

      {error && <p className="share-panel__error" role="alert">{error}</p>}
    </section>
  );
};

export default SharePanel;
