/** The worker uses corpus records only for geometry coverage. Source metadata stays in the page. */
export function coverageRecords(records) {
  return records.map(({ size, thickness, gap, dot, t_style, style, weapon_gap }) =>
    ({ size, thickness, gap, dot, t_style, style, weapon_gap }));
}
