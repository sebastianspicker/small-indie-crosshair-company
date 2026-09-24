import test from 'node:test';
import assert from 'node:assert/strict';
import { countLongLines, compareToBaseline } from '../../scripts/line-length.mjs';

test('a line of exactly the limit length passes', () => {
  const text = 'x'.repeat(140);
  assert.equal(countLongLines(text, 140), 0);
});

test('a line one character over the limit fails', () => {
  const text = 'x'.repeat(141);
  assert.equal(countLongLines(text, 140), 1);
});

test('an empty file has no long lines', () => {
  assert.equal(countLongLines('', 140), 0);
});

test('CRLF line endings do not count the carriage return toward line length', () => {
  const line = 'x'.repeat(140);
  const text = `${line}\r\n${line}\r\n`;
  assert.equal(countLongLines(text, 140), 0);
});

test('a longer CRLF line still fails', () => {
  const line = 'x'.repeat(141);
  const text = `short\r\n${line}\r\n`;
  assert.equal(countLongLines(text, 140), 1);
});

test('an increased long-line count violates the baseline', () => {
  const violations = compareToBaseline({ 'app/x.js': 3 }, { 'app/x.js': 2 });
  assert.deepEqual(violations, [{ file: 'app/x.js', count: 3, baseline: 2 }]);
});

test('a decreased long-line count does not violate the baseline', () => {
  const violations = compareToBaseline({ 'app/x.js': 1 }, { 'app/x.js': 2 });
  assert.deepEqual(violations, []);
});

test('an unchanged long-line count does not violate the baseline', () => {
  const violations = compareToBaseline({ 'app/x.js': 2 }, { 'app/x.js': 2 });
  assert.deepEqual(violations, []);
});

test('a new file with a long line violates an absent baseline entry', () => {
  const violations = compareToBaseline({ 'app/new.js': 1 }, {});
  assert.deepEqual(violations, [{ file: 'app/new.js', count: 1, baseline: 0 }]);
});

test('a new file with no long lines does not violate an absent baseline entry', () => {
  const violations = compareToBaseline({ 'app/new.js': 0 }, {});
  assert.deepEqual(violations, []);
});
