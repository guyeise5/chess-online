export const noHeartbeatMaxTimeMillis: number = Number(process.env.NO_HEARTBEAT_MAX_TIME_MILLIS) || 5_000
export const puzzleDisabled = process.env.PUZZLE_DISABLED === "true"

export const mongodbEnabled = process.env.MONGODB_ENABLED === "true"
export const mongodbConnectionString = process.env.MONGODB_CONNECTION_STRING || "mongodb://localhost:27017"
export const mongodbDbName = "chess"
export const mongodbPuzzlesCollectionName = "puzzles"
