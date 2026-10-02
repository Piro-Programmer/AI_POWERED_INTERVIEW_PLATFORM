import { Link } from "react-router-dom";

const Wordmark = ({ to = "/" }) => (
  <Link to={to} className="wordmark" aria-label="Interview Lab home">
    Interview <em className="hl">Lab</em>
  </Link>
);

export default Wordmark;
