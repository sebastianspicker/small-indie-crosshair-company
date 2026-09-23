# Architecture

The system has three layers and one immutable reference. It is intentionally
small enough for the numerical model to be audited without a framework runtime.

```text
browser editor / notebook / calibration / audit
                    |
              pure ES modules
       validation -> legacy -> conversion
             codec / CFG / raster / OLS
                    |
       dated fixtures + model identifiers
                    |
  frozen Python reference and archival outputs
```

## Module ownership

`lib/legacy.js` defines binary32 geometry and comparison functions. It never reads
the DOM. `lib/conversion.js` defines hypotheses, legal integer search, scope-independent
predictions, errors, display color and safe configuration serialization.
`lib/calibration.js` fits user input and validates measurement schemas; it cannot
mark anything verified. `lib/raster.js` creates explicitly illustrative binary
geometry masks, not simulated Valve shader output.

`lib/sharecode.js` handles only legacy v1 serialization with retained MIT attribution.
`lib/cfg.js` parses an allowlisted legacy data subset. `lib/audit.js` computes the
same experiment in the browser and Node. Validation helpers are shared rather than
reimplemented differently in each form.

`app/editor.js` owns source settings, options, manual candidate state and active
calibration provenance. Candidate results are derived, not a second editable source
of truth. `app/preview.js` consumes geometry and draws canvases. The notebook,
evidence table and calibration are independent modules composed by `app/main.js`.
`app/dom.js` supplies safe text-first DOM construction and explicit downloads.

The UI is vanilla ES modules. A framework, transpiler, package manager install and
backend add no mathematical capability here, and the construction environment
could not reach package registries. Both constraints favor direct browser modules.
No production dependency is required and the same model code runs in Node tests.

## State and failure behavior

No localStorage, IndexedDB, cookies or service worker. State lives in one tab;
exports are deliberate. Invalid or empty inputs disable export, including after
resize/repaint. Changing an imported calibration's height or effective thickness
blocks use of that scoped fit. Manual intercept/slope edits detach it from the
recorded dataset and are explicitly unscoped hypotheses.

Legacy imports replace source state only after parsing/validation succeeds.
Manual native edits do not silently overwrite legacy settings. The report records
both the automatic result and actual manual candidate/preview. Original source
code export is explicitly a legacy code, not an invented new share-code version.

## Build and deployment

The build copies allowlisted static assets and documents, writes `.nojekyll` and
a manifest with per-file SHA-256. No remote fetch, minifier or generated UI image is
involved. The archive is intentionally included for reproducible research. The
production output is portable under a subdirectory and does not need rewrite rules
because tabs use a URL fragment. Source maps, account secrets and `.git` are not
published by the build.

Tests validate model invariants, safe parsers, archives, HTTP serving and browser
interactions at separately identified evidence levels. See testing.md for actual
coverage and limitations.
