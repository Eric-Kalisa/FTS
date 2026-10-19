export type Vehicle = {
  id: number;
  positionMeters: number;
  speedMetersPerSecond: number;
  lane: number;

  // the following parameters allow us to successfully implement 3.1 Intelligent Driver Model (IDM) in FTS phsyics
  desiredSpeedMetersPerSecond: number; // the desired speed of the vehicle in meters per second (driver's intention)
  lengthMeters: number; // the length of the vehicle in meters
};