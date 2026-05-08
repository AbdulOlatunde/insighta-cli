const http = require("http");
const crypto = require("crypto");
const axios = require("axios");
const open = (...args) =>
  import("open").then((module) => module.default(...args));
const chalk = require("chalk");
const { saveCredentials, clearCredentials, loadCredentials } = require("../utils/credentials");
const { BACKEND_URL } = require("../utils/apiClient");

const GITHUB_CLIENT_ID_CLI = "Ov23lii6KoWGOStqrOjx";
const CALLBACK_PORT = 9876;

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

  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${GITHUB_CLIENT_ID_CLI}` +
    `&redirect_uri=${encodeURIComponent(`http://localhost:${CALLBACK_PORT}/callback`)}` +
    `&scope=${encodeURIComponent("read:user user:email")}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  console.log(chalk.cyan("Opening GitHub in your browser..."));

  // Start local callback server
  await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url.startsWith("/callback")) return;

      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
      const code = url.searchParams.get("code");
      const retState = url.searchParams.get("state");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html><body><h2>Login successful! You can close this tab.</h2></body></html>`);
      server.close();

      if (retState !== state) {
        console.error(chalk.red("State mismatch. Possible CSRF attack."));
        return reject(new Error("State mismatch"));
      }

      try {
        const response = await axios.post(`${BACKEND_URL}/auth/github/cli-callback`, {
          code,
          code_verifier: codeVerifier,
          state,
        });

        const { access_token, refresh_token, user } = response.data;
        saveCredentials({ access_token, refresh_token, user });
        console.log(chalk.green(`\n✓ Logged in as @${user.username}`));
        console.log(chalk.gray(`  Role: ${user.role}`));
        resolve();
      } catch (err) {
        console.error(chalk.red("Login failed:"), err.response?.data?.message || err.message);
        reject(err);
      }
    });

    server.listen(CALLBACK_PORT, () => {
      open(authUrl).catch(() => {
        console.log(chalk.yellow(`Could not open browser. Visit this URL manually:\n${authUrl}`));
      });
    });

    server.on("error", reject);
  });
};

const logout = async () => {
  const creds = loadCredentials();
  if (!creds) {
    console.log(chalk.yellow("Not logged in."));
    return;
  }

  try {
    await axios.post(
      `${BACKEND_URL}/auth/logout`,
      { refresh_token: creds.refresh_token },
      { headers: { Authorization: `Bearer ${creds.access_token}` } }
    );
  } catch (_) { }

  clearCredentials();
  console.log(chalk.green("✓ Logged out successfully."));
};

const whoami = () => {
  const creds = loadCredentials();
  if (!creds) {
    console.log(chalk.yellow("Not logged in."));
    return;
  }
  console.log(chalk.green(`Logged in as @${creds.user?.username}`));
  console.log(chalk.gray(`  Role:  ${creds.user?.role}`));
  console.log(chalk.gray(`  Email: ${creds.user?.email || "N/A"}`));
};

module.exports = { login, logout, whoami };