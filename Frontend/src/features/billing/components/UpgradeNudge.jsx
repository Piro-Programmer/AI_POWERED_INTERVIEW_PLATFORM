import { Link } from "react-router-dom";
import "../billing.scss";

const NEXT = { free: "Pro", pro: "Premium" };

/**
 * Shown where an allowance ran out: the next plan up, if there is one.
 * `usage` is an allowance from the API ({ plan, limitedBy, ... }).
 */
const UpgradeNudge = ({ usage }) => {
  const next = NEXT[usage?.plan];
  if (!next) return null;
  const when = usage.limitedBy === "month" ? "this month" : "today";
  return (
    <p className="upgrade-nudge">
      Need more {when}? {next} raises every limit.{" "}
      <Link className="text-link" to="/pricing">See plans →</Link>
    </p>
  );
};

export default UpgradeNudge;
