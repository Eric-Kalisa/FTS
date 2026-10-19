import { describe, expect, it } from "vitest";
import { runSimulation } from "./run-simulation";
import { stepSimulation } from "./step-simulation";
import type { Simulation } from "./Simulation";
import type { Vehicle } from "./vehicle";

const idmParameters = {
  maxAccelerationMetersPerSecondSquared: 1.4,
  comfortableDecelerationMetersPerSecondSquared: 2,
  timeHeadwaySeconds: 1.5,
  minimumGapMeters: 1,
  accelerationExponent: 4,
};

function makeSimulation(): Simulation {
  const vehicle: Vehicle = {
    id: 1,
    positionMeters: 100,
    speedMetersPerSecond: 10,
    lane: 0,
    lengthMeters: 5,
    desiredSpeedMetersPerSecond: 30,
  };

  return {
    elapsedSeconds: 0,
    road: { lengthMeters: 1_000, laneCount: 2 },
    vehicles: [vehicle],
    idmParameters,
  };
}

describe("runSimulation", () => {
  it("repeats the requested fixed step and returns the final state", () => {
    // Set up the starting state and the duration of each simulation step.
    const initial = makeSimulation();
    const dtSeconds = 0.2;

    // Build the expected result by applying one simulation step three times.
    let expected = initial;
    for (let step = 0; step < 10; step++) {
      expected = stepSimulation(expected, dtSeconds);
    }

    // Run the function under test using the same step duration and count.
    const result = runSimulation(initial, dtSeconds, 10);

    // Check that the result matches, advances 2 seconds total, and moves the vehicle.
    expect(result).toEqual(expected);
    expect(result.elapsedSeconds).toBeCloseTo(2);
    expect(result.vehicles[0].positionMeters).toBeGreaterThan(100);
  });

  it("returns the initial simulation unchanged when asked to run zero steps", () => {
    const initial = makeSimulation();

    const result = runSimulation(initial, 0.1, 0);

    expect(result).toBe(initial);
  });

  it("does not modify the initial simulation when running multiple steps", () => {
    const initial = makeSimulation();
    const originalVehicle = initial.vehicles[0];

    const result = runSimulation(initial, 0.1, 5);

    expect(initial.elapsedSeconds).toBe(0);
    expect(initial.vehicles[0]).toBe(originalVehicle);
    expect(initial.vehicles[0].positionMeters).toBe(100);
    expect(initial.vehicles[0].speedMetersPerSecond).toBe(10);
    expect(result).not.toBe(initial);
  });

  it("rejects a zero, negative, or non-finite time step", () => {
    const initial = makeSimulation();

    for (const dtSeconds of [0, -0.1, NaN, Infinity]) {
      expect(() => runSimulation(initial, dtSeconds, 0)).toThrow(RangeError);
    }
  });

  it("rejects a negative or non-integer number of steps", () => {
    const initial = makeSimulation();

    for (const numberOfSteps of [-1, 1.5, NaN, Infinity]) {
      expect(() => runSimulation(initial, 0.1, numberOfSteps)).toThrow(
        RangeError,
      );
    }
  });
});

