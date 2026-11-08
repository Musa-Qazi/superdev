import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "../server/pg-index.js";

// The rewrite passes the API path in a query parameter, while keeping the
// browser-facing URL unchanged. Restore the path expected by Express.
export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", "http://localhost");
  const route = url.searchParams.get("__devpulse_route");
  if (!route || route.includes("..") || route.includes("\\")) {
    res.statusCode = 400;
    res.end("Invalid API route");
    return;
  }
  url.searchParams.delete("__devpulse_route");
  const query = url.searchParams.toString();
  req.url = `/api/${route}${query ? `?${query}` : ""}`;
  app(req, res);
}
