import mongoose, { Schema, Document } from "mongoose";

export interface IGame extends Document {
  gameId: string;
  moves: string[];
  startFen?: string;
  playerWhite?: string;
  playerBlack?: string;
  orientation?: "white" | "black";
  result?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema = new Schema<IGame>(
  {
    gameId: { type: String, required: true, unique: true, index: true },
    moves: { type: [String], required: true },
    startFen: { type: String },
    playerWhite: { type: String },
    playerBlack: { type: String },
    orientation: { type: String, enum: ["white", "black"] },
    result: { type: String },
  },
  { timestamps: true, collection: "games" }
);

GameSchema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

export default mongoose.model<IGame>("Game", GameSchema);
