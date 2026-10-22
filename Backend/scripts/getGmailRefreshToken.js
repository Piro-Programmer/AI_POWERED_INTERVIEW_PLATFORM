// One-off: get the Gmail refresh token that lets the server send reset emails
// from your Gmail account.
//   cd Backend && node scripts/getGmailRefreshToken.js
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (the Web OAuth client,
// with http://localhost:5555/oauth2callback as an authorized redirect URI).
// Open the printed link, sign in with the Gmail account that should send the
// emails, and copy the printed GOOGLE_REFRESH_TOKEN line into .env and Render.
import "dotenv/config";
import http from "node:http";

const PORT = 5555;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/gmail.send"; // send only: it can't read your mail

const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = process.env;
if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Backend/.env first.");
  process.exit(1);
}

const consentUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline", // ask for a refresh token
    prompt: "consent" // always return one, even if you've approved before
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/oauth2callback") return res.writeHead(404).end();

  const code = url.searchParams.get("code");
  if (!code) {
    res.end(`No code received (${url.searchParams.get("error") || "unknown error"}). Run the script again.`);
    return server.close();
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });
  const data = await response.json();

  if (!data.refresh_token) {
    res.end("Google didn't return a refresh token. See the terminal.");
    console.error("No refresh token in Google's answer:", data);
  } else {
    res.end("Done. You can close this tab and go back to the terminal.");
    console.log("\nAdd this to Backend/.env and to Render:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}\n`);
    console.log("Keep it secret: it lets this app send email as you.");
  }
  server.close();
});

server.listen(PORT, () => {
  console.log("Open this link, sign in with the Gmail account that should send the emails, and allow access:\n");
  console.log(consentUrl);
});
