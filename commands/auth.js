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
  console.log(chalk.gray(`Using redirect URI: ${redirectUri}`));

  let server;

  try {
    await new Promise((resolve, reject) => {
      server = http.createServer(async (req, res) => {
        const fullUrl = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
        
        // === DEBUG LOGS ===
        console.log(chalk.blue(`→ Incoming ${req.method} ${fullUrl.pathname}${fullUrl.search}`));

        if (!fullUrl.pathname.includes(CALLBACK_PATH)) {
          console.log(chalk.yellow(`Path mismatch: ${fullUrl.pathname}`));
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const code = fullUrl.searchParams.get("code");
        const retState = fullUrl.searchParams.get("state");
        const error = fullUrl.searchParams.get("error");

        if (error) {
          console.error(chalk.red(`GitHub Error: ${error}`));
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h2>OAuth Error: ${error}</h2>`);
          return reject(new Error(error));
        }

        if (!code) {
          console.error(chalk.red("No code received from GitHub"));
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h2>No authorization code received</h2>");
          return reject(new Error("No code"));
        }

        console.log(chalk.green("Authorization code received!"));

        // Send success page to browser
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body>
              <h2>Login successful!</h2>
              <p>You can now close this tab and return to the terminal.</p>
            </body>
          </html>
        `);

        if (retState !== state) {
          console.error(chalk.red("State mismatch!"));
          return reject(new Error("State mismatch"));
        }

        try {
          console.log(chalk.gray("Sending code to backend..."));
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
          console.error(chalk.red("Backend error:"), err.response?.data?.message || err.message);
          reject(err);
        } finally {
          setTimeout(() => server?.close(), 1500);
        }
      });

      server.listen(CALLBACK_PORT, "127.0.0.1", () => {
        console.log(chalk.green(`Local server ready on http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`));
        
        open(authUrl).catch(() => {
          console.log(chalk.yellow("Failed to open browser. Please open this URL manually:"));
          console.log(authUrl);
        });
      });

    });
  } catch (err) {
    console.error(chalk.red("Authentication failed:"), err.message);
  } finally {
    if (server) server.close();
  }
};

// logout and whoami functions
const logout = async () => { /* your existing code */ };
const whoami = () => { /* your existing code */ };

module.exports = { login, logout, whoami };