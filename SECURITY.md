# Security and privacy

The app has no accounts, API keys, analytics, persistence, or game-process access.
Imported settings and screenshots are processed locally in the browser. Exported
reports may include filenames and notes you supplied; review them before sharing.

## Report a problem

Use the repository's private vulnerability reporting channel if one is enabled.
Otherwise, contact the maintainer through a private channel you can verify. Do not
post personal data or working exploit details in a public issue. This source
snapshot does not specify a security email address.

## Input handling

Legacy share codes are checked for syntax, length, version, dictionary, and checksum.
CFG imports accept a fixed set of numeric and boolean assignments. The app never
executes imported commands or renders imported HTML. Measurement JSON is validated;
unused metadata is discarded, and exported values must be finite and in range.

The converter's PNG input checks the signature, a 16 MiB file limit, 8192-pixel side
limit, and 20-million-pixel limit before decoding. Decoded dimensions must match the
header. The manual inspector uses stricter limits. Browser image decoding remains
part of the trusted platform. Capture hashes detect identity; they do not prove
that an image is an authentic game capture.

Editing an image selection clears acceptance of its previous fit. Conflicting
measurements of a shared capture are rejected, and linked captures cannot occur
in both calibration and holdout groups.

## Resource and hosting boundaries

Conversion requests retain only the latest queued request. The image queue has
eight waiting slots, and a 30-second worker deadline settles outstanding requests.
Worker failure disables conversion rather than moving the search onto the main thread.

The Node server binds to loopback, checks host and file paths, and limits request
sizes, timeouts, and connections. It is for local development. Publish `dist/` to
an HTTPS static host; see [deployment](docs/engineering/deployment.md) for headers.
GitHub Pages cannot reproduce every custom response header from the local server.

## Secrets and publication

No deployment credentials belong in the source. `.gitignore` excludes common
credential files, environment files, and local tooling. The static build also
filters local-only files from copied directories.

For a local check, run `gitleaks dir . --redact`; after commits exist, also run
`gitleaks git . --redact`. Scanning the working directory does not inspect Git history.
A scan detects known patterns and is not a guarantee that all sensitive data is absent.

GitHub's [secret scanning documentation](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning)
explains hosted detection. If a credential is exposed, revoke or rotate it first;
adding it to `.gitignore` does not undo exposure.
