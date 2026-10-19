import type { Road } from "./road";
import type { Vehicle } from "./vehicle";

export type IdmParameters = {
  maxAccelerationMetersPerSecondSquared: number;
  comfortableDecelerationMetersPerSecondSquared: number;
  timeHeadwaySeconds: number;
  minimumGapMeters: number;
  accelerationExponent: number;
};

export type Simulation = {
  elapsedSeconds: number;
  road: Road;
  vehicles: Vehicle[];
  idmParameters: IdmParameters;
};
