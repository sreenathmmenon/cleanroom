# Cleanroom UI

A branded embed of `@truefoundry/trueforge-ui`: the Cleanroom wordmark and
tagline, dark theme, sidebar layout, and a crash boundary that renders errors
on screen instead of a silent blank page.

## Running it

```bash
npm --prefix ui ci
npm --prefix ui run build
node scripts/serve-ui.mjs        # http://127.0.0.1:4174, /api proxied to TrueForge
```

`scripts/serve-ui.mjs` serves the build and proxies `/api/*` to TrueForge from
the same origin, which avoids CORS entirely and handles the IPv6-only bind of a
local server. Point it elsewhere with `TARGET`, and change the port with `PORT`.

For development, `npm --prefix ui run dev` proxies `/api` the same way (see
`vite.config.ts`), so the same-origin default works in both modes.

## Known limitation: opening a past session

The landing view works — agent library, chat history, composer, theme. **Opening
a session from the history list does not**: the page holds skeleton loaders and
the console fills with

```
Maximum update depth exceeded. The result of getSnapshot should be cached
to avoid an infinite loop.
```

This is a `useSyncExternalStore` loop inside the UI SDK's own session store, not
in this app. What has been ruled out:

- **React version.** React and ReactDOM are pinned to 18.3.1, within the SDK's
  peer range (`^18 || ^19`), and the built bundle uses them.
- **StrictMode.** Removing it changes nothing; the loop reproduces without it.
- **The API layer.** `/api/v1/agents` and the session endpoints answer 200
  through the proxy, and the same sessions are fully readable over the REST API
  — every transcript in `docs/evidence/` was captured that way.

So the embed is honest about what it is today: a working branded shell for
starting work, with session replay blocked on an upstream fix. The agent itself
is unaffected — the harness, the gates, and the runs all work; this is the
viewer.
