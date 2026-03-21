import mongoose, { Schema, Document } from "mongoose";

export interface IPuzzle extends Document {
  puzzleId: string;
  fen: string;
  moves: string[];
  rating: number;
  ratingDeviation: number;
  popularity: number;
  nbPlays: number;
  themes: string[];
  gameUrl: string;
  openingTags: string[];
}

const PuzzleSchema = new Schema<IPuzzle>({
  puzzleId: { type: String, required: true, unique: true, index: true },
  fen: { type: String, required: true },
  moves: { type: [String], required: true },
  rating: { type: Number, required: true },
  ratingDeviation: { type: Number, required: true },
  popularity: { type: Number, required: true },
  nbPlays: { type: Number, required: true },
  themes: { type: [String], default: [] },
  gameUrl: { type: String, default: "" },
  openingTags: { type: [String], default: [] },
});

PuzzleSchema.index({ rating: 1 });

export default mongoose.model<IPuzzle>("Puzzle", PuzzleSchema);
