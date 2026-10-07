# How one conversion is decided

One conversion runs seven steps. Steps 1 to 6 decide the exported values; step 7
reports on them and changes nothing.

1. **Old settings to old pixels.** Size, thickness and gap become an arm length,
   a bar width and an inner-edge position at the old game height, with the old
   game's binary32 arithmetic. See [Legacy geometry](01-legacy-geometry.md).
2. **Old appearance.** The old outline, colour and draw order are added: each bar
   painted its black outline and then its fill, so a later outline could cover
   an earlier fill. See [Pixels, outlines and draw order](04-rendering.md).
3. **Appearance rules.** Old shapes that the current game cannot draw literally
   are re-expressed: crossed arms are folded, an outline-only crosshair becomes
   black bars, a dot-only crosshair becomes short arms inside the dot, and the
   T flag is planned from where the old T stem sat. See
   [What decides the export](13-what-decides-the-export.md).
4. **Goal and target.** The target is either the same pixels (pixel goal) or the
   same fraction of the screen height (screen goal), sampled from the old pixel
   edges with exact arithmetic. See [Conversion goals](02-conversion-and-identifiability.md)
   and [Community static conversion](12-community-conversion.md).
5. **Dimension-first inverse.** Bar length and width are fitted first, then the
   gap; ties between equally accurate shapes go to the one with the best overlap
   after a shift of at most one pixel. See
   [Community static conversion](12-community-conversion.md).
6. **Appearance window and export line.** A bounded search around that choice
   replaces it only if a neighbour draws the old pixels strictly better, and the
   plain conversion replaces both if it scores higher still. The export line
   then prints the chosen values and the line groups the user keeps. See
   [Community static conversion](12-community-conversion.md) and
   [What decides the export](13-what-decides-the-export.md).
7. **Checks after the export.** The shape check compares the old and the new
   pixels by colour and reports exact, shifted, approximate or empty. The ML
   cross-check compares a learner's prediction with the export. See
   [Learned emulators and the ML cross-check](10-learned-emulator.md).
