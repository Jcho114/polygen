import { serve } from "@hono/node-server";
import { app } from "./app.ts";

serve({ fetch: app.fetch, port: 8787 });

console.info("PolyGen API listening on http://localhost:8787");
