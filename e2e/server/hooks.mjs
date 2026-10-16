// Node module hook: whenever the backend imports its AI or mail service, hand
// it a fake instead. The backend's own code stays untouched.
const fakes = {
  "/services/ai.service.js": new URL("./fake-ai.mjs", import.meta.url).href,
  "/services/mail.service.js": new URL("./fake-mail.mjs", import.meta.url).href
};

export async function resolve(specifier, context, nextResolve) {
  for (const [suffix, url] of Object.entries(fakes)) {
    if (specifier.endsWith(suffix)) return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
