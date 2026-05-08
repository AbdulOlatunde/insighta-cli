const http = require("http");
const crypto = require("crypto");
const axios = require("axios");
const open = (...args) => import("open").then((module) => module.default(...args));
const chalk = require("chalk");

const { saveCredentials, clearCredentials, loadCredentials } = require("../utils/credentials");
const { BACKEND_URL } = require("../utils/apiClient");

const GITHUB_CLIENT_ID_CLI = "Ov23lii6KoWGOStqrOjx";
const CALLBACK_PORT = 9876;
const CALLBACK_PATH = "/callback";

// PKCE helpers
const generateCodeVerifier = () => crypto.randomBytes(32).toString("base64url");
const generateCodeChallenge = (verifier) =>
  crypto.createHash("sha256").update(verifier).digest("base64url");

const login = async () => {
  const creds = loadCredentials();
  if (creds) {
    console.log(chalk.yellow(`Already logged in as @${creds.user?.username}. Run 'insighta logout' first.`));
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const redirectUri = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;

  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${GITHUB_CLIENT_ID_CLI}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent("read:user user:email")}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  console.log(chalk.cyan("Opening GitHub in your browser..."));

  let server;

  try {
    await new Promise((resolve, reject) => {
      server = http.createServer(async (req, res) => {
        // Only handle the callback path
        if (!req.url.startsWith(CALLBACK_PATH)) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        // GitHub uses GET for callback
        if (req.method !== "GET") {
          res.writeHead(405, { "Allow": "GET" });
          res.end("Method Not Allowed");
          return;
        }

        try {
          const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
          const code = url.searchParams.get("code");
          const retState = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          if (error) {
            throw new Error(`GitHub OAuth error: ${error}`);
          }

          if (!code) {
            throw new Error("No authorization code received");
          }

          // Send success page to browser
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <head><meta charset="utf-8"><title>Login Successful</title></head>
              <body>
                <h2>Login successful!</h2>
                <p>You can now close this tab and return to the terminal.</p>
              </body>
            </html>
          `);

          // Validate state
          if (retState !== state) {
            console.error(chalk.red("State mismatch. Possible CSRF attack."));
            throw new Error("State mismatch");
          }

          console.log(chalk.gray("Exchanging code for token..."));

          // Send code to backend
          const response = await axios.post(`${BACKEND_URL}/auth/github/cli-callback`, {
            code,
            code_verifier: codeVerifier,
            state,
          });

          const { access_token, refresh_token, user } = response.data;

          saveCredentials({ access_token, refresh_token, user });
          
          console.log(chalk.green(`\n✓ Successfully logged in as @${user.username}`));
          console.log(chalk.gray(`   Role: ${user.role || 'N/A'}`));
          
          resolve();

        } catch (err) {
          console.error(chalk.red("Login failed:"), err.response?.data?.message || err.message);
          reject(err);
        } finally {
          // Close server after a short delay so browser can load the success page
          setTimeout(() => server?.close(), 800);
        }
      });

      server.listen(CALLBACK_PORT, "127.0.0.1", () => {
        console.log(chalk.gray(`Local callback server running on http://localhost:${CALLBACK_PORT}`));
        
        open(authUrl).catch((err) => {
          console.log(chalk.yellow("Could not auto-open browser."));
          console.log(chalk.yellow("Please visit this URL manually:\n") + authUrl);
        });
      });

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(chalk.red(`Port ${CALLBACK_PORT} is already in use.`));
        }
        reject(err);
      });

      // Timeout safety
      setTimeout(() => {
        reject(new Error("Login timed out. Please try again."));
      }, 5 * 60 * 1000); // 5 minutes
    });
  } catch (err) {
    console.error(chalk.red("Authentication failed:"), err.message);
  } finally {
    if (server) server.close();
  }
};

// (logout and whoami functions)
const logout = async () => { /* your existing code */ };
const whoami = () => { /* your existing code */ };

module.exports = { login, logout, whoami };