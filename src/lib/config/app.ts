import { env } from "@/lib/env";

export const appConfig = {
  name: env.appName,
  shortName: env.appShortName,
  companyName: env.companyName,
  url: env.appUrl,
  requireAuth: env.requireAuth,
  supportEmail: "quality@example.com",
} as const;
