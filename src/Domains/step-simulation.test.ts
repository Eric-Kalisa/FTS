import { describe, expect, it } from "vitest";
import { calculateIdmAcceleration } from "./idm";
import { findNearestLeader, stepSimulation } from "./step-simulation";
import type { Simulation } from "./Simulation";
import type { Vehicle } from "./vehicle";

const idmParameters = {
  maxAccelerationMetersPerSecondSquared: 1.4,
  comfortableDecelerationMetersPerSecondSquared: 2,
  timeHeadwaySeconds: 1.5,
  minimumGapMeters: 1,
  accelerationExponent: 4,
};

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    positionMeters: 100,
    speedMetersPerSecond: 10,
    lane: 0,
    lengthMeters: 5,
    desiredSpeedMetersPerSecond: 30,
    ...overrides,
  };
}

function makeSimulation(
  vehicles: Vehicle[],
  roadLengthMeters = 1_000,
): Simulation {
  return {
    elapsedSeconds: 0,
    road: { lengthMeters: roadLengthMeters, laneCount: 2 },
    vehicles,
    idmParameters,
  };
}

describe("stepSimulation", () => {
  it("uses IDM to update speed and advances position using the starting speed", () => {
    const simulation = makeSimulation([makeVehicle()]);
    const next = stepSimulation(simulation, 0.5);
    const expectedAcceleration = 1.4 * (1 - Math.pow(10 / 30, 4));

    expect(next.vehicles[0].speedMetersPerSecond).toBeCloseTo(
      10 + expectedAcceleration * 0.5,
    );
    expect(next.vehicles[0].positionMeters).toBe(105);
    expect(next.elapsedSeconds).toBe(0.5);
  });

  it("brakes a follower that is closing on a slower same-lane leader", () => {
    const follower = makeVehicle({
      id: 1,
      positionMeters: 100,
      speedMetersPerSecond: 20,
      lane: 0,
    });
    const leader = makeVehicle({
      id: 2,
      positionMeters: 145,
      speedMetersPerSecond: 15,
      lane: 0,
    });

    const next = stepSimulation(makeSimulation([follower, leader]), 0.5);
    const nextFollower = next.vehicles.find((vehicle) => vehicle.id === 1);

    expect(nextFollower?.speedMetersPerSecond).toBeLessThan(20);
  });

  it("updates the leader before the follower calculates IDM acceleration", () => {
    const follower = makeVehicle({
      id: 1,
      positionMeters: 100,
      speedMetersPerSecond: 20,
      lane: 0,
    });
    const leader = makeVehicle({
      id: 2,
      positionMeters: 145,
      speedMetersPerSecond: 15,
      lane: 0,
    });

    const next = stepSimulation(makeSimulation([follower, leader]), 0.5);
    const nextFollower = next.vehicles.find((vehicle) => vehicle.id === 1);
    const nextLeader = next.vehicles.find((vehicle) => vehicle.id === 2);

    expect(nextLeader?.speedMetersPerSecond).toBeGreaterThan(
      leader.speedMetersPerSecond,
    );
    expect(nextFollower?.speedMetersPerSecond).toBeLessThan(
      follower.speedMetersPerSecond,
    );

    // If the follower used the leader's old speed and position, its resulting
    // speed would differ because the leader has already advanced in this step.
    const oldGapMeters =
      leader.positionMeters -
      leader.lengthMeters -
      follower.positionMeters;
    const oldStateAcceleration = calculateIdmAcceleration(
      follower,
      { vehicle: leader, gapMeters: oldGapMeters },
      idmParameters,
    );
    expect(nextFollower?.speedMetersPerSecond).not.toBeCloseTo(
      follower.speedMetersPerSecond + oldStateAcceleration * 0.5,
      5,
    );
  });
  it("does not treat a vehicle in another lane as the leader", () => {
    const follower = makeVehicle({
      id: 1,
      positionMeters: 100,
      speedMetersPerSecond: 20,
      lane: 0,
    });
    const otherLaneVehicle = makeVehicle({
      id: 2,
      positionMeters: 145,
      speedMetersPerSecond: 15,
      lane: 1,
    });

    const aloneNext = stepSimulation(makeSimulation([follower]), 0.5);
    const otherLaneNext = stepSimulation(
      makeSimulation([follower, otherLaneVehicle]),
      0.5,
    );

    expect(
      otherLaneNext.vehicles.find((vehicle) => vehicle.id === 1)
        ?.speedMetersPerSecond,
    ).toBeCloseTo(aloneNext.vehicles[0].speedMetersPerSecond);
  });

  it("removes a vehicle once its rear reaches the end of the open road", () => {
    const vehicle = makeVehicle({
      positionMeters: 103.5,
      speedMetersPerSecond: 2,
      desiredSpeedMetersPerSecond: 2,
      lengthMeters: 5,
    });

    const next = stepSimulation(makeSimulation([vehicle], 100), 1);

    expect(next.vehicles).toHaveLength(0);
  });

  it("keeps the vehicle on the road when only its front reaches the end", () => {
    const vehicle = makeVehicle({
      positionMeters: 99,
      speedMetersPerSecond: 2,
      desiredSpeedMetersPerSecond: 2,
      lengthMeters: 5,
    });

    const next = stepSimulation(makeSimulation([vehicle], 100), 0.5);

    expect(next.vehicles).toHaveLength(1);
    expect(next.vehicles[0].positionMeters).toBe(100);
  });

  it("does not modify the original simulation", () => {
    const simulation = makeSimulation([makeVehicle()]);
    const next = stepSimulation(simulation, 0.5);

    expect(simulation.elapsedSeconds).toBe(0);
    expect(simulation.vehicles[0].positionMeters).toBe(100);
    expect(simulation.vehicles[0].speedMetersPerSecond).toBe(10);
    expect(next.vehicles[0]).not.toBe(simulation.vehicles[0]);
  });

  it("rejects zero, negative, or non-finite time steps", () => {
    const simulation = makeSimulation([]);

    expect(() => stepSimulation(simulation, 0)).toThrow(RangeError);
    expect(() => stepSimulation(simulation, -1)).toThrow(RangeError);
    expect(() => stepSimulation(simulation, Infinity)).toThrow(RangeError);
  });
});

describe("findNearestLeader", () => {
  it("finds the nearest vehicle ahead in the same lane and calculates the gap", () => {
    const subject = makeVehicle({
      id: 1,
      positionMeters: 20,
      speedMetersPerSecond: 10,
      lane: 0,
      lengthMeters: 4.5,
    });
    const nearest = makeVehicle({
      id: 2,
      positionMeters: 35,
      speedMetersPerSecond: 8,
      lane: 0,
      lengthMeters: 4,
    });
    const farther = makeVehicle({
      id: 3,
      positionMeters: 60,
      speedMetersPerSecond: 12,
      lane: 0,
      lengthMeters: 5,
    });
    const behind = makeVehicle({
      id: 4,
      positionMeters: 10,
      speedMetersPerSecond: 10,
      lane: 0,
    });
    const otherLane = makeVehicle({
      id: 5,
      positionMeters: 25,
      speedMetersPerSecond: 7,
      lane: 1,
    });

    const result = findNearestLeader(subject, [
      subject,
      farther,
      behind,
      otherLane,
      nearest,
    ]);

    expect(result?.vehicle).toEqual(nearest);
    expect(result?.gapMeters).toBe(11);
  });

  it("returns undefined when there is no vehicle ahead in the same lane", () => {
    const subject = makeVehicle({ id: 1, positionMeters: 20, lane: 0 });
    const behind = makeVehicle({ id: 2, positionMeters: 10, lane: 0 });
    const otherLane = makeVehicle({ id: 3, positionMeters: 30, lane: 1 });

    expect(
      findNearestLeader(subject, [subject, behind, otherLane]),
    ).toBeUndefined();
  });
});






