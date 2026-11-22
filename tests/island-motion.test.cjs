const test = require('node:test');
const assert = require('node:assert/strict');
const { DURATION_MS, IDLE_SECONDS, gaze } = require('../electron/island-motion.cjs');

test('island motion and idle timing use the intended durations', () => {
  assert.equal(DURATION_MS, 780);
  assert.equal(IDLE_SECONDS, 30);
});

test('eyes follow a nearby pointer, settle at distance, and sleep after system idle', () => {
  const tab = { x: 400, y: 0, width: 132, height: 42 };
  const right = gaze({ x: 570, y: 23 }, tab, false);
  const left = gaze({ x: 362, y: 23 }, tab, false);
  assert.ok(right.x > 0);
  assert.ok(left.x < 0);
  assert.deepEqual(gaze({ x: 900, y: 500 }, tab, false), { x: 0, y: 0, sleeping: false });
  assert.deepEqual(gaze({ x: 570, y: 23 }, tab, true), { x: 0, y: 0, sleeping: true });
});
