import type { Simulation } from "./Simulation";
import type { Vehicle } from "./vehicle";
import { calculateIdmAcceleration } from "./idm";

// Describes a vehicle ahead and the bumper-to-bumper gap to it.
export type LeaderAhead = {
  vehicle: Vehicle;
  gapMeters: number;
};

// Find the nearest vehicle ahead in the same lane.
// On an open road, "ahead" means a greater front-bumper position.
export function findNearestLeader(
  subject: Vehicle,
  vehicles: readonly Vehicle[],
): LeaderAhead | undefined {
  let nearest: Vehicle | undefined;

  for (const candidate of vehicles) {
    if (candidate.id === subject.id) continue;
    if (candidate.lane !== subject.lane) continue;
    if (candidate.positionMeters <= subject.positionMeters) continue;

    // If two candidates share a position, choose the lower numeric ID.
    if (
      nearest === undefined ||
      candidate.positionMeters < nearest.positionMeters ||
      (candidate.positionMeters === nearest.positionMeters &&
        candidate.id < nearest.id)
    ) {
      nearest = candidate;
    }
  }

  if (nearest === undefined) {
    return undefined;
  }

  // Positions mark front bumpers, so subtract the leader's length
  // to calculate the open bumper-to-bumper gap.
  const gapMeters =
    nearest.positionMeters - nearest.lengthMeters - subject.positionMeters;

  return { vehicle: nearest, gapMeters };
}

// Advance the whole simulation by one fixed time step.
export function stepSimulation(
  simulation: Simulation,
  dtSeconds: number,
): Simulation {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
    throw new RangeError("dtSeconds must be a positive finite number");
  }

  // Clone each vehicle so this step can update its working state without
  // changing the input simulation.
  const nextVehicles: Vehicle[] = [];
  for (const vehicle of simulation.vehicles) {
    nextVehicles.push({ ...vehicle });
  }

  // Process front to back. A vehicle's leaders have already been updated,
  // so followers react to those updated speeds and positions in this step.
  const frontToBack = [...nextVehicles].sort(
    (a, b) => b.positionMeters - a.positionMeters || a.id - b.id,
  );

  for (const vehicle of frontToBack) {
    const leader = findNearestLeader(vehicle, frontToBack);
    const acceleration = calculateIdmAcceleration(
      vehicle,
      leader,
      simulation.idmParameters,
    );

    // IDM updates speed; explicit Euler advances position using the speed
    // the vehicle had at the start of its own update.
    const startingSpeedMetersPerSecond = vehicle.speedMetersPerSecond;
    vehicle.speedMetersPerSecond = Math.max(
      0,
      startingSpeedMetersPerSecond + acceleration * dtSeconds,
    );
    vehicle.positionMeters += startingSpeedMetersPerSecond * dtSeconds;
  }

  // Remove vehicles only after every follower has had a chance to react to
  // the leader state for this step. Keep the returned array in input order.
  const vehiclesStillOnRoad: Vehicle[] = [];
  for (const vehicle of nextVehicles) {
    if (
      vehicle.positionMeters - vehicle.lengthMeters <
      simulation.road.lengthMeters
    ) {
      vehiclesStillOnRoad.push(vehicle);
    }
  }

  return {
    ...simulation,
    elapsedSeconds: simulation.elapsedSeconds + dtSeconds,
    vehicles: vehiclesStillOnRoad,
  };
}


