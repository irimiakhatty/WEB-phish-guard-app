import prisma from "@phish-guard-app/db";
import { env } from "@phish-guard-app/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

const trustedOrigins = [
  env.CORS_ORIGIN,
  env.BETTER_AUTH_URL,
  "http://localhost:3001",
  "http://localhost:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3000",
  "http://192.168.1.164:3001", // local LAN access for dev
].filter(Boolean);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        required: false,
      },
    },
  },
  plugins: [nextCookies()],
});
