// Google Identity Services is a script Google hosts (it draws the "Sign in
// with Google" button and returns a signed ID token). Loaded only on the
// sign-in pages, once per page.
const SRC = "https://accounts.google.com/gsi/client";
let loading = null;

/** Resolves to window.google.accounts.id. */
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google didn't load")));
    script.onerror = () => {
      loading = null; // let a later visit try again
      reject(new Error("Google didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
