// Car roster. Each car is a Rapier raycast vehicle tuned by these numbers.
// Units: kg, N (engine per driven wheel), m/s (top speed), rad (max steer), N/m.
export const CARS = {
  bolt: {
    id: 'bolt', name: 'Bolt', role: 'Balanced all-rounder', color: 0xff3b6b,
    mass: 1100, engine: 4200, drive: 'rwd', brake: 2200, maxSteer: 0.52, topSpeed: 46, boostTop: 58,
    grip: 10.5, sideGrip: 1.6, stiffness: 52, handbrakeGrip: 0.45, airYaw: 2600, downforce: 3.0, boostPower: 1.25,
  },
  dart: {
    id: 'dart', name: 'Dart', role: 'Light and quick off the line', color: 0x2bff9e,
    mass: 850, engine: 4000, drive: 'rwd', brake: 1900, maxSteer: 0.56, topSpeed: 52, boostTop: 64,
    grip: 9.5, sideGrip: 1.3, stiffness: 46, handbrakeGrip: 0.5, airYaw: 2200, downforce: 2.2, boostPower: 1.2,
  },
  titan: {
    id: 'titan', name: 'Titan', role: 'Heavy, planted, awd grip', color: 0xffc83b,
    mass: 1500, engine: 4800, drive: 'awd', brake: 2800, maxSteer: 0.42, topSpeed: 40, boostTop: 50,
    grip: 12.5, sideGrip: 2.0, stiffness: 62, handbrakeGrip: 0.65, airYaw: 1800, downforce: 4.2, boostPower: 1.15,
  },
  viper: {
    id: 'viper', name: 'Viper', role: 'Drift specialist, low grip', color: 0x3ba7ff,
    mass: 950, engine: 4000, drive: 'rwd', brake: 2000, maxSteer: 0.6, topSpeed: 48, boostTop: 60,
    grip: 8.0, sideGrip: 0.9, stiffness: 50, handbrakeGrip: 0.3, airYaw: 2800, downforce: 2.6, boostPower: 1.3,
  },
};
export const CAR_IDS = Object.keys(CARS);
