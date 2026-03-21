import mongoose, { Schema, Document } from "mongoose";

export type TimeFormat = "bullet" | "blitz" | "rapid" | "classical";
export type ColorChoice = "white" | "black" | "random";
export type RoomStatus = "waiting" | "playing" | "finished";

export interface IRoom extends Document {
  roomId: string;
  owner: string;
  opponent: string | null;
  timeFormat: TimeFormat;
  timeControl: number;
  timeIncrement: number;
  colorChoice: ColorChoice;
  status: RoomStatus;
  fen: string;
  pgn: string;
  whitePlayer: string | null;
  blackPlayer: string | null;
  whiteTime: number;
  blackTime: number;
  turn: "w" | "b";
  result: string | null;
  moves: string[];
  lastMoveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TIME_CONTROLS: Record<TimeFormat, { time: number; timeIncrement: number }> = {
  bullet: { time: 60, timeIncrement: 0 },
  blitz: { time: 300, timeIncrement: 2 },
  rapid: { time: 600, timeIncrement: 5 },
  classical: { time: 1800, timeIncrement: 10 },
};

const RoomSchema = new Schema<IRoom>(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    owner: { type: String, required: true },
    opponent: { type: String, default: null },
    timeFormat: {
      type: String,
      enum: ["bullet", "blitz", "rapid", "classical"],
      required: true,
    },
    timeControl: { type: Number, required: true },
    timeIncrement: { type: Number, default: 0 },
    colorChoice: {
      type: String,
      enum: ["white", "black", "random"],
      default: "random",
    },
    status: {
      type: String,
      enum: ["waiting", "playing", "finished"],
      default: "waiting",
    },
    fen: { type: String, default: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
    pgn: { type: String, default: "" },
    whitePlayer: { type: String, default: null },
    blackPlayer: { type: String, default: null },
    whiteTime: { type: Number, required: true },
    blackTime: { type: Number, required: true },
    turn: { type: String, enum: ["w", "b"], default: "w" },
    result: { type: String, default: null },
    moves: { type: [String], default: [] },
    lastMoveAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RoomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export { TIME_CONTROLS };
export default mongoose.model<IRoom>("Room", RoomSchema);
