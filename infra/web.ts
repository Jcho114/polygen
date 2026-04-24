import { api } from "./api.ts";

export const web = new sst.aws.StaticSite("Web", {
  path: ".",
  build: {
    command: "npm run build",
    output: "dist",
  },
  ...(process.env.APP_DOMAIN ? { domain: process.env.APP_DOMAIN } : {}),
  dev: {
    command: "npm run dev:web",
    url: "http://localhost:5173",
  },
  environment: {
    VITE_API_URL: api.url,
  },
});
