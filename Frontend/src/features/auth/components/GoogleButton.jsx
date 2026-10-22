import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getProviders } from "../services/auth.api";
import { loadGoogleIdentity } from "../loadGoogleIdentity";

/**
 * "Continue with Google", drawn by Google itself, with an "or" rule under it.
 * Renders nothing while loading, when the server has Google sign-in turned
 * off, or when Google's script is blocked, so the email form always works.
 *   text: "continue_with" | "signup_with" | "signin_with"
 */
const GoogleButton = ({ text = "continue_with" }) => {
  const { handleGoogle } = useAuth();
  const navigate = useNavigate();
  const slot = useRef(null);
  const [clientId, setClientId] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Google's callback is registered once; it calls whatever handler is current
  const onCredential = useRef(null);
  useEffect(() => {
    onCredential.current = async ({ credential }) => {
      setBusy(true);
      setError("");
      const result = await handleGoogle(credential);
      if (result.ok) {
        navigate("/dashboard");
      } else {
        setError(result.message);
        setBusy(false);
      }
    };
  });

  useEffect(() => {
    let cancelled = false;
    getProviders()
      .then((data) => !cancelled && setClientId(data?.google || null))
      .catch(() => {}); // no Google button, the form still works
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    loadGoogleIdentity()
      .then((id) => {
        if (cancelled || !slot.current) return;
        id.initialize({
          client_id: clientId,
          callback: (response) => onCredential.current(response),
          ux_mode: "popup",
          context: text === "signup_with" ? "signup" : "signin"
        });
        id.renderButton(slot.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text,
          logo_alignment: "center",
          width: Math.min(400, Math.max(200, Math.round(slot.current.offsetWidth || 320)))
        });
        setReady(true);
      })
      .catch(() => {}); // an ad blocker or offline: just the email form
    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (!clientId) return null;

  return (
    <div className="google-signin" hidden={!ready} aria-busy={busy}>
      <div ref={slot} className="google-signin__button" />
      {busy && <p className="google-signin__status" role="status">Signing you in…</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p className="auth-divider"><span>or with email</span></p>
    </div>
  );
};

export default GoogleButton;
