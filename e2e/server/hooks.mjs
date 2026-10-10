// Node module hook: whenever the backend imports its AI service, hand it the
// fake instead. The backend's own code stays untouched.
const fakeAi = new URL("./fake-ai.mjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith("/services/ai.service.js")) {
    return { url: fakeAi, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
