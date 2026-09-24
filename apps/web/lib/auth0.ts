import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const managedAuthConfigured = Boolean(
  process.env.AUTH0_DOMAIN &&
  process.env.AUTH0_CLIENT_ID &&
  process.env.AUTH0_CLIENT_SECRET &&
  process.env.AUTH0_SECRET &&
  process.env.APP_BASE_URL,
);

export const auth0 = new Auth0Client({
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE || "https://api.vectorprive.com",
    scope: "openid profile email",
  },
});
