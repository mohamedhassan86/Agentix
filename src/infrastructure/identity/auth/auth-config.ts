/**
 * Auth.js 5 Credentials boundary.
 * Database session strategy with opaque cookie; role is never stored in the cookie.
 * Runtime session lifecycle is owned by SessionService + session repository.
 */

import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { SESSION_COOKIE_NAME } from "./session-cookie";

export function createAuthConfig(): NextAuthConfig {
  const secure = process.env.NODE_ENV === "production";
  return {
    secret: process.env.AUTH_SECRET,
    session: {
      strategy: "database",
      maxAge: Number(process.env.AUTH_SESSION_MAX_AGE ?? 2592000),
    },
    trustHost: true,
    cookies: {
      sessionToken: {
        name: SESSION_COOKIE_NAME,
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure,
        },
      },
    },
    providers: [
      Credentials({
        id: "credentials",
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        authorize: async () => {
          // Sign-in is performed by identity.session.signIn; Auth.js is the cookie/CSRF boundary.
          return null;
        },
      }),
    ],
    callbacks: {
      session({ session }) {
        return session;
      },
    },
  };
}
