import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5 min cache
  },
  trustedOrigins: [process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "AUTHOR",
        input: false,
      },
      affiliation: {
        type: "string",
        required: false,
      },
      bio: {
        type: "string",
        required: false,
      },
      isActive: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
      prefixTh: {
        type: "string",
        required: false,
        input: false,
      },
      firstNameTh: {
        type: "string",
        required: false,
        input: false,
      },
      lastNameTh: {
        type: "string",
        required: false,
        input: false,
      },
      prefixEn: {
        type: "string",
        required: false,
        input: false,
      },
      firstNameEn: {
        type: "string",
        required: false,
        input: false,
      },
      lastNameEn: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
