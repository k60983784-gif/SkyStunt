// Shared simulation constants. Client and server MUST use the same values.
export const PHYSICS_HZ = 60;           // fixed simulation step (server authoritative)
export const PHYSICS_DT = 1 / PHYSICS_HZ;
export const SNAPSHOT_HZ = 30;          // server -> client state broadcast rate
export const SAMPLE_SPACING = 2.0;      // metres between track samples
export const TRACK_THICKNESS = 0.6;     // metres
export const MAX_RACERS = 8;            // total competitors per race (humans + bots)
export const MAX_HUMANS_PER_ROOM = 8;
export const LOBBY_FILL_SECONDS = 12;   // wait after first human before bots fill and the race starts
export const COUNTDOWN_SECONDS = 3;
export const RESULTS_SECONDS = 14;
export const MAX_MSG_BYTES = 1024;      // reject larger client messages
export const MAX_INPUTS_PER_SEC = 90;   // rate limit per connection
export const RESPAWN_FREEZE = 0.8;      // seconds of no control after respawn
export const MODES = {
  grandprix: { id: 'grandprix', name: 'Grand Prix', desc: 'Multi-lap race with checkpoints. First to finish with the best time wins.', timeLimit: 480, lives: 0 },
  stunt: { id: 'stunt', name: 'Stunt Challenge', desc: 'Earn points for jumps, airtime, drifts and clean landings. Highest score after the timer wins.', timeLimit: 120, lives: 0 },
  survival: { id: 'survival', name: 'Survival Rush', desc: 'Three lives. Falling off the road or hitting hazards costs a life. Last racer standing wins.', timeLimit: 180, lives: 3 },
};
