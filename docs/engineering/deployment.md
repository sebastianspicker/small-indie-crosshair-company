# Local use and static hosting

## Run locally

Node.js 22.12+ is required. Python 3.10+ is also needed for archive reproduction.
There is no npm install step.

```sh
npm run dev
# http://127.0.0.1:4173

# To use another port:
node scripts/serve.mjs --port 4180
```

The server binds to loopback and serves an allowlist of project files. Use it for
local development. Opening `index.html` via `file://` cannot reliably load the
modules, worker, and bundled data.

## Build and host

```sh
npm run verify
npm run preview
```

Upload the **contents of `dist/`** to an HTTPS static host, preserving paths.
For GitHub, use the [Pages guide](github-pages.md). The included workflow deploys
on pushes to `main` once Pages is configured.

The build includes a file hash manifest and `.nojekyll`. It excludes hidden files,
local dependency directories, credentials, logs, and temporary output. Rebuild after
source changes. Avoid immutable caching for the unversioned asset names: mixed
old and new modules can give inconsistent results.

## Headers and content types

On hosts that support custom headers, use:

```text
Content-Security-Policy: default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cache-Control: no-cache
```

Serve `.js` as `text/javascript`, `.css` as `text/css`, `.json` as
`application/json`, and HTML as `text/html`. The app needs same-origin module workers
and data requests. Clipboard access and screenshot hashing require a secure context;
HTTPS and loopback localhost qualify in ordinary browsers.

GitHub Pages does not expose all of these header controls. Its meta CSP covers the
supported directives; it cannot reproduce the local server's full response policy.
Validate the deployed site separately from the local build.
