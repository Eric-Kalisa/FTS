// src/Domains/run-simulation.ts

import type { Simulation } from "./Simulation";
import { stepSimulation } from "./step-simulation";

export function runSimulation(
  initialSimulation: Simulation,
  dtSeconds: number,
  numberOfSteps: number,
): Simulation {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
    throw new RangeError("dtSeconds must be a positive finite number");
  }

  if (!Number.isInteger(numberOfSteps) || numberOfSteps < 0) {
    throw new RangeError("numberOfSteps must be a non-negative integer");
  }

  // Start with the supplied state. Each step returns a new state,
  // which becomes the input to the next step.
  let currentSimulation = initialSimulation;

  for (let step = 0; step < numberOfSteps; step++) {
    currentSimulation = stepSimulation(currentSimulation, dtSeconds);
  }

  return currentSimulation;
}
