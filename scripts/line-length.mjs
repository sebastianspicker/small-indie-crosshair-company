/** Pure line-length ratchet helpers, shared by scripts/check.mjs and its tests. */

/**
 * Count how many lines in `text` exceed `limit` characters. Line endings (LF or CRLF) are not
 * counted toward a line's length.
 * @param {string} text - file contents.
 * @param {number} limit - maximum allowed line length, in characters.
 * @returns {number} count of lines longer than `limit`.
 */
export function countLongLines(text, limit) {
  return text.split(/\r\n|\r|\n/).filter(line => line.length > limit).length;
}

/**
 * Compare fresh long-line counts against a committed baseline, file by file. A file violates the
 * ratchet when its count exceeds its baseline entry; a file absent from the baseline is treated
 * as having a baseline of zero.
 * @param {Record<string, number>} counts - fresh long-line count per file path.
 * @param {Record<string, number>} baseline - committed long-line count per file path.
 * @returns {Array<{file: string, count: number, baseline: number}>} violations, in `counts` order.
 */
export function compareToBaseline(counts, baseline) {
  const violations = [];
  for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0;
    if (count > allowed) violations.push({ file, count, baseline: allowed });
  }
  return violations;
}
