// Same rules as the server (Backend auth.controllers.js checkPassword), checked
// in the browser too so people don't wait for a round trip to see them.
export const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";

/** What's wrong with the password, or "" when it's fine. */
export function passwordProblem(password) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (new TextEncoder().encode(password).length > 72) return "Password must be at most 72 characters.";
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return "Password must contain a letter and a number.";
  return "";
}
