# Decision records

Short architecture decision records (ADRs) for rules that used to live only
in plan prose. Each is at most one page and follows the same three headings:

- **Context** — the situation that forced a choice.
- **Decision** — what the project does.
- **Consequences** — what that implies, and where a machine or a reviewer can
  check it is still true.

ADRs are not living documents; they record a decision at the time it was
made. If a decision changes, add a new ADR that supersedes the old one rather
than rewriting history in place.

| ADR | Decision |
| --- | --- |
| [0001](0001-learned-emulator-research-only.md) | The learned emulator (and its ranker/sensitivity/modulator siblings) never ships in the converter. |
| [0002](0002-speed-gate-closed-without-native-pairs.md) | Any speed gate that would let a learned shortcut replace the exact solver stays closed until reviewed native capture pairs exist. |
| [0003](0003-export-cvars-not-share-codes.md) | Exports are cvar commands only: no guessed post-update share-code layout, no hidden legacy cvars. |
| [0004](0004-no-runtime-dependencies-or-persistence.md) | No runtime (npm) dependencies and no client-side persistence. |
| [0005](0005-layered-lib-and-research-isolation.md) | `lib/` is five import-checked layers; research code lives in `research/` and never reaches the app. |

See [architecture](../architecture.md) for where these modules and boundaries
sit in the codebase, and [`archive/`](../archive/) for the plans these
decisions were extracted from.
