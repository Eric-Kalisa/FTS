import { describe, expect, it } from "vitest";
import { calculateIdmAcceleration } from "./idm";
import type { IdmLeader } from "./idm";
import type { IdmParameters } from "./Simulation";
import type { Vehicle } from "./vehicle";

const parameters: IdmParameters = {
  maxAccelerationMetersPerSecondSquared: 1.4,
  comfortableDecelerationMetersPerSecondSquared: 2,
  timeHeadwaySeconds: 1.5,
  minimumGapMeters: 1,
  accelerationExponent: 4,
};

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    positionMeters: 20,
    speedMetersPerSecond: 15,
    lane: 0,
    desiredSpeedMetersPerSecond: 30,
    lengthMeters: 5,
    ...overrides,
  };
}

function makeLeader(gapMeters: number, speedMetersPerSecond: number): IdmLeader {
  return {
    vehicle: makeVehicle({
      id: 2,
      speedMetersPerSecond,
    }),
    gapMeters,
  };
}

describe("calculateIdmAcceleration", () => {
  it("calculates free-road acceleration below desired speed", () => {
    const acceleration = calculateIdmAcceleration(
      makeVehicle({ speedMetersPerSecond: 15 }),
      undefined,
      parameters,
    );

    // 1.4 * (1 - (15 / 30)^4) = 1.3125 m/s^2
    expect(acceleration).toBeCloseTo(1.3125);
  });

  it("returns zero free-road acceleration at desired speed", () => {
    const acceleration = calculateIdmAcceleration(
      makeVehicle({ speedMetersPerSecond: 30 }),
      undefined,
      parameters,
    );

    expect(acceleration).toBeCloseTo(0);
  });

  it("slows acceleration when a same-speed leader is present", () => {
    const follower = makeVehicle({ speedMetersPerSecond: 20 });
    const freeRoadAcceleration = calculateIdmAcceleration(
      follower,
      undefined,
      parameters,
    );
    const followingAcceleration = calculateIdmAcceleration(
      follower,
      makeLeader(60, 20),
      parameters,
    );

    expect(followingAcceleration).toBeLessThan(freeRoadAcceleration);
  });

  it("brakes more when the follower is closing on a slower leader", () => {
    const follower = makeVehicle({ speedMetersPerSecond: 20 });
    const sameSpeedLeaderAcceleration = calculateIdmAcceleration(
      follower,
      makeLeader(60, 20),
      parameters,
    );
    const slowerLeaderAcceleration = calculateIdmAcceleration(
      follower,
      makeLeader(60, 15),
      parameters,
    );

    expect(slowerLeaderAcceleration).toBeLessThan(sameSpeedLeaderAcceleration);
  });

  it("reduces the interaction effect when the leader is farther away", () => {
    const follower = makeVehicle({ speedMetersPerSecond: 20 });
    const closeLeaderAcceleration = calculateIdmAcceleration(
      follower,
      makeLeader(30, 15),
      parameters,
    );
    const farLeaderAcceleration = calculateIdmAcceleration(
      follower,
      makeLeader(60, 15),
      parameters,
    );

    expect(farLeaderAcceleration).toBeGreaterThan(closeLeaderAcceleration);
  });

  it("rejects a zero desired speed", () => {
    expect(() =>
      calculateIdmAcceleration(
        makeVehicle({ desiredSpeedMetersPerSecond: 0 }),
        undefined,
        parameters,
      ),
    ).toThrow(RangeError);
  });

  it("rejects a non-positive gap to a leader", () => {
    expect(() =>
      calculateIdmAcceleration(
        makeVehicle(),
        makeLeader(0, 10),
        parameters,
      ),
    ).toThrow(RangeError);
  });
});
