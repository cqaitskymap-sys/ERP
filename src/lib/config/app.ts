import { env } from "@/lib/env";

export const appConfig = {
  name: env.appName,
  shortName: env.appShortName,
  companyName: env.companyName,
  logoSrc: "/brand/patri-logo.png",
  url: env.appUrl,
  requireAuth: env.requireAuth,
  supportEmail: "quality@example.com",
} as const;
