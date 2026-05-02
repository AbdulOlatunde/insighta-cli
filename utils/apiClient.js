const axios = require("axios");
const { loadCredentials, saveCredentials, clearCredentials } = require("./credentials");

const BACKEND_URL = process.env.INSIGHTA_API || "https://hng-genderize-production.up.railway.app";

const createClient = () => {
  const creds = loadCredentials();
  if (!creds) return null;

  const client = axios.create({
    baseURL: BACKEND_URL,
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      "X-API-Version": "1",
      "Content-Type": "application/json",
    },
  });

  // Auto-refresh on 401
  client.interceptors.response.use(
    (res) => res,
    async (err) => {
      if (err.response?.status === 401 && creds.refresh_token) {
        try {
          const refreshRes = await axios.post(`${BACKEND_URL}/auth/refresh`, {
            refresh_token: creds.refresh_token,
          });
          const { access_token, refresh_token } = refreshRes.data;
          saveCredentials({ ...creds, access_token, refresh_token });

          // Retry original request with new token
          err.config.headers["Authorization"] = `Bearer ${access_token}`;
          return axios(err.config);
        } catch {
          clearCredentials();
          console.error("Session expired. Please run: insighta login");
          process.exit(1);
        }
      }
      return Promise.reject(err);
    }
  );

  return client;
};

const getClient = () => {
  const client = createClient();
  if (!client) {
    console.error("Not logged in. Please run: insighta login");
    process.exit(1);
  }
  return client;
};

module.exports = { getClient, BACKEND_URL };