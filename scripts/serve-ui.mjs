#!/usr/bin/env node
/**
 * Serve the built Cleanroom UI and proxy API calls to a TrueForge server,
 * same-origin — sidestepping CORS and IPv4/IPv6 resolution quirks entirely.
 *
 *   node scripts/serve-ui.mjs            # serves ui/dist on :4174, proxies /api → http://[::1]:8790
 *   TARGET=http://host:8790 PORT=4174 node scripts/serve-ui.mjs
 *
 * No dependencies — Node 22+.
 */
import { createServer, request as httpRequest } from "node:http";
import { isIP } from "node:net";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 4174);
const TARGET = new URL(process.env.TARGET ?? "http://[::1]:8790");
const DIST = join(root, "ui", "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

// Some Node versions keep IPv6 brackets in URL.hostname; Node needs literal IPs
// (with family) rather than DNS names for addresses like [::1].
const host = TARGET.hostname.replace(/^\[|\]$/g, "");
const family = isIP(host) || 0;
const upstream = family
  ? { host, port: TARGET.port, family }
  : { hostname: host, port: TARGET.port };

const server = createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    const proxy = httpRequest(
      { ...upstream, path: req.url, method: req.method, headers: { ...req.headers, host: TARGET.host } },
      (up) => {
        res.writeHead(up.statusCode, up.headers);
        // A mid-stream upstream failure must not take the server down. Headers
        // are already sent, so destroying the socket is the honest signal: the
        // client sees a transport error rather than a truncated 200.
        up.on("error", (err) => res.destroy(err));
        up.pipe(res); // streams SSE too
      },
    );
    proxy.on("error", (err) => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `TrueForge unreachable at ${TARGET}: ${err.code}` }));
    });
    req.pipe(proxy);
    return;
  }

  const path = normalize(req.url.split("?")[0]).replace(/^(\.\.[/\\])+/, "");
  let file = join(DIST, path === "/" ? "index.html" : path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html"); // SPA fallback
  if (!existsSync(file)) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`No UI build at ${DIST}. Build it first: npm --prefix ui ci && npm --prefix ui run build`);
    return;
  }
  const stream = createReadStream(file);
  // The file can vanish or become unreadable between the check and the open.
  // Before headers, that is a clean 500. After headers the status is already
  // 200, so ending the response would hand the browser a truncated asset as a
  // success; destroy the socket instead, which surfaces as a transport error.
  stream.on("error", (err) => {
    if (res.headersSent) {
      res.destroy(err);
      return;
    }
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Cannot read ${file}: ${err.code}`);
  });
  stream.once("open", () => {
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    stream.pipe(res);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Cleanroom UI → http://127.0.0.1:${PORT}  (API proxied to ${TARGET})`);
});
