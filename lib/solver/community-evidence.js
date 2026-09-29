/** Held-out checks of one fixed reconstruction; capture groups, never rows, are the units. */
import { COMMUNITY_MODEL, communityForward } from '../geometry/community.js';
import { validateMeasurements, grouped, activeFeatures } from './observations.js';
import { wilson } from './statistics.js';

export function communityEvidence(records) {
  const canonical = validateMeasurements(records, COMMUNITY_MODEL.build);
  const native = canonical.filter(row => row.kind === 'native-user');
  const calibration = grouped(native.filter(row => row.role === 'calibration'));
  const holdouts = grouped(native.filter(row => row.role === 'holdout'));
  const check = row => {
    const predicted = communityForward(row.native, row.currentHeight);
    predicted.axisStart = 0 - Math.ceil(predicted.width / 2);
    const fields = row.observed.axisStart === undefined ? activeFeatures(row) : [...activeFeatures(row), 'axisStart'];
    const residuals = Object.fromEntries(fields.map(key => [key, predicted[key] - row.observed[key]]));
    return { id: row.id, role: row.role, build: row.build, residuals,
      matches: Object.values(residuals).every(value => Math.abs(value) <= .5) };
  };
  const holdoutTests = holdouts.map(group => ({ group: group[0].captureGroup,
    matches: group.every(row => check(row).matches), measurements: group.length }));
  const validation = wilson(holdoutTests.filter(group => group.matches).length, holdouts.length);
  const measurementChecks = [...calibration, ...holdouts].flat().map(check);
  return { measurementChecks, calibrationGroups: calibration.length, holdoutGroups: holdouts.length, holdoutTests,
    syntheticIgnored: canonical.length - native.length,
    duplicateNativeMeasurementsIgnored: native.length - measurementChecks.length,
    validation: { ...validation,
      scope: 'Declared measured fields within 0.5 px, grouped by user capture/session. Independence is user-attested; ' +
        'the interval is not an individual conversion probability or proof of native pixels.' } };
}
