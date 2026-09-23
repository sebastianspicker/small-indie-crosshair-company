# Interface design and browser review

The design is an understated dark measurement workbench: a left parameter rail,
two large pixel inspection canvases, native-value controls, and configuration
output. Mint is the interaction accent; warm amber distinguishes warnings. A
system-font stack keeps the project offline and avoids shipping font files.

The product surface is the working tool, not a landing page. Four fragment-routed
tabs separate Workbench, Mathematics, Calibration and Evidence. It has no marketing
metrics, account controls, generated photographic backgrounds or unrelated charts.
The visible crosshairs and grids are necessarily code-native mathematical graphics.
No image-generated concept or externally approved mockup is claimed.

## Responsive behavior

At a wide desktop the parameter rail and inspector are adjacent. Small viewports
stack inputs and previews; data tables scroll inside their own bounded containers.
Controls retain labels and keyboard access; colors are not the only signal for
model status. Native settings use integers and legacy inputs allow fractions.
Error/status messages are text and expose changes through status regions.

Canvas display zoom and horizontal stretch are explicitly presentation operations,
not a change to the underlying geometry or exported settings. Pixel differences
compare two simulated geometry masks and stay labeled as model-only information.

## Review process

Browser screenshots are obtained from the actual HTML, CSS and ES modules. The
construction environment's managed Chromium blocks HTTP navigation, including
localhost. Its policy was not changed. Browser interaction and visual testing use
an in-memory local-source harness on a blank page. Separate Node HTTP tests cover
server status, headers, asset delivery and denied paths. This is not claimed to be
an end-to-end CSP-enforced navigation test.

Review targets: desktop 1440 × 1150 and mobile 390 × 844. Inspect all four surfaces,
parameter labels, heading hierarchy, canvas alignment, control spacing, narrow
viewport overflow, notice readability, and configuration output wrapping. Temporary
screenshots and browser-generated files are excluded from the repository.

No ten-out-of-ten design rating, full accessibility audit, browser-matrix approval,
or native game rendering validation is asserted.
