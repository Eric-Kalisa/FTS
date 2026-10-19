import type { IdmParameters } from "./Simulation";
import type { Vehicle } from "./vehicle";

// The leader and open bumper-to-bumper gap found by the simulation step.
// This structural shape lets step-simulation.ts pass its LeaderAhead value
// without making this IDM module depend on the step implementation.
export type IdmLeader = {
  vehicle: Vehicle;
  gapMeters: number;
};

/**
 * Calculate the IDM acceleration for one vehicle.
 *
 * A positive result means accelerate; a negative result means brake.
 * This function only calculates acceleration. It does not update the
 * vehicle's speed or position.
 */
export function calculateIdmAcceleration(
  follower: Vehicle,
  leader: IdmLeader | undefined,
  parameters: IdmParameters,
): number {
  const {
    maxAccelerationMetersPerSecondSquared: maxAcceleration,
    comfortableDecelerationMetersPerSecondSquared: comfortableDeceleration,
    timeHeadwaySeconds,
    minimumGapMeters,
    accelerationExponent,
  } = parameters;

  const speed = follower.speedMetersPerSecond;
  const desiredSpeed = follower.desiredSpeedMetersPerSecond;

  // These checks prevent invalid values from making the equation return NaN.
  if (!Number.isFinite(desiredSpeed) || desiredSpeed <= 0) {
    throw new RangeError("Vehicle desired speed must be a positive finite number.");
  }

  if (
    !Number.isFinite(maxAcceleration) ||
    maxAcceleration <= 0 ||
    !Number.isFinite(comfortableDeceleration) ||
    comfortableDeceleration <= 0
  ) {
    throw new RangeError(
      "IDM acceleration and comfortable deceleration must be positive finite numbers.",
    );
  }

  if (
    !Number.isFinite(timeHeadwaySeconds) ||
    timeHeadwaySeconds < 0 ||
    !Number.isFinite(minimumGapMeters) ||
    minimumGapMeters < 0 ||
    !Number.isFinite(accelerationExponent) ||
    accelerationExponent <= 0
  ) {
    throw new RangeError("IDM time headway, minimum gap, and exponent must be valid.");
  }

  if (!Number.isFinite(speed) || speed < 0) {
    throw new RangeError("Vehicle speed must be a non-negative finite number.");
  }

  // Free-road term: acceleration fades as speed approaches desired speed.
  const freeRoadTerm = Math.pow(speed / desiredSpeed, accelerationExponent);

  // A vehicle without a leader has no car-following interaction penalty.
  let interactionTerm = 0;

  if (leader !== undefined) {
    const { gapMeters } = leader;
    const leaderSpeed = leader.vehicle.speedMetersPerSecond;

    if (!Number.isFinite(gapMeters) || gapMeters <= 0) {
      throw new RangeError("IDM requires a positive finite gap to the leader.");
    }

    if (!Number.isFinite(leaderSpeed) || leaderSpeed < 0) {
      throw new RangeError("Leader speed must be a non-negative finite number.");
    }

    // Positive closing speed means the follower is catching the leader.
    const closingSpeed = speed - leaderSpeed;

    // Desired gap = standstill gap + speed/headway gap + closing adjustment.
    const dynamicGap = Math.max(
      0,
      speed * timeHeadwaySeconds +
        (speed * closingSpeed) /
          (2 * Math.sqrt(maxAcceleration * comfortableDeceleration)),
    );
    const desiredGap = minimumGapMeters + dynamicGap;

    // The interaction penalty grows when actual gap is smaller than desired.
    interactionTerm = Math.pow(desiredGap / gapMeters, 2);
  }

  return maxAcceleration * (1 - freeRoadTerm - interactionTerm);
}
