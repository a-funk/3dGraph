import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FLIGHT_KEYMAP,
  createTour,
  isFlightControlKey,
  keyIntentForCode,
  sampleTour,
  smootherstep,
} from "../src/index.js";

test("flight keymap exposes documented intents", () => {
  assert.equal(keyIntentForCode("KeyW"), "forward");
  assert.equal(keyIntentForCode("KeyQ"), "rollLeft");
  assert.equal(keyIntentForCode("Escape"), "exit");
  assert.equal(isFlightControlKey("Digit1"), false);
  assert.ok(DEFAULT_FLIGHT_KEYMAP.forward.includes("KeyW"));
});

test("tour sampling interpolates position and lookAt", () => {
  const tour = createTour([
    { position: [0, 0, 0], lookAt: [0, 0, 0] },
    { position: [10, 0, 0], lookAt: [0, 10, 0] },
  ], { easing: "linear" });

  const sample = sampleTour(tour, 0.5);
  assert.deepEqual(sample.position, [5, 0, 0]);
  assert.deepEqual(sample.lookAt, [0, 5, 0]);
});

test("smootherstep clamps progress", () => {
  assert.equal(smootherstep(-1), 0);
  assert.equal(smootherstep(2), 1);
  assert.equal(smootherstep(0.5), 0.5);
});
