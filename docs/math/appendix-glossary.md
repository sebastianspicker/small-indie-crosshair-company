# Appendix B. Glossary

| Term | Meaning |
|---|---|
| Aligned overlap | $\operatorname{IoU}_{\pm1}$: the best IoU over whole-shape shifts of at most one pixel; used because no setting moves the whole crosshair. |
| Appearance rules | The fixed redraws of crossed arms, outline-only and dot-only shapes ([What decides the export](13-what-decides-the-export.md#appearance-rules)). |
| Appearance window | The bounded search after the dimension-first choice that keeps a neighbour only on a strict gain ([Community static conversion](12-community-conversion.md#window)). |
| Authored height | `cl_crosshair_screen_height`, the height the new values are written for; exported last. |
| Capture pair | A screenshot of the old game and one of the current game with the same settings, provenance and hashes. The repository holds none. |
| Certificate | A record that a tuple minimizes a declared loss on a declared domain, naming its method; `unproven` claims nothing. |
| Corpus | The {{fig:summary.dataset.records|int}} published pro crosshair records used as realistic old inputs. |
| Corrections | The appearance rules and the window; an expert switch turns them off. |
| Declared model | A rule written down by the project (old reconstruction, new drawing model, hypotheses); results under it are conditional on it. |
| Dimension-first | Fitting bar length and width before the gap. |
| Edge challenge | A reserved learner test set restricted to edge regimes. |
| Export group | An optional set of exported lines (RGB, opacity, outline mode, outline colour, recoil, authored height). |
| Flippable | A T family for which the option `auto` lets the window try the other T flag. |
| Fold | Redrawing crossed arms as the same pixels with a non-negative gap. |
| Native | Of the current game: native settings, native captures. |
| Native tuple | A legal set of new values $(\ell,\theta,g,H_{\mathrm{auth}})$. |
| Oracle sweep | A brute-force search of a bounded box of tuples that checks whether the converter missed a better tuple by its own measure. |
| Pixel goal | Reproduce the old drawn pixels. |
| Plain conversion | The dimension-first result with corrections off; the fallback that corrections must beat. |
| Policy-excluded | A tuple the converter never exports by rule (length 0 once the old shape drew), counted apart from search shortfalls. |
| Preimage | Every legal tuple that draws a target exactly under one hypothesis. |
| Reused holdout | A test set scored in earlier releases; regression evidence for the current version. |
| Rule baseline | A learner comparison that applies fixed rules without learning. |
| Screen goal | Reproduce the old crosshair at the same share of the screen height. |
| Shape check | The colour-aware comparison of old and new pixels: exact, shifted, approximate or empty. |
| Shortfall | An oracle-sweep input where some tuple in the box beats the export. |
| Signature | The old geometry settings (size, thickness, gap, dot, T, style, weapon gap) that group corpus records. |
| Speed gate | The rule that a learned shortcut may replace the exact solver only when it is exactly equivalent; closed. |
| Stability interval | A resampling interval over setting or geometry groups; describes the benchmark, not the game. |
| T-shape family | Where an old T stem sat relative to its bar ([T shapes](13-what-decides-the-export.md#t-shapes)). |
| Wilson interval | A binomial interval for held-out agreement over independent capture groups. |
