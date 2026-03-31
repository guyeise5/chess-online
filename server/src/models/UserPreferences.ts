import mongoose, { Schema, Document } from "mongoose";

export interface IUserPreferences extends Document {
  userId: string;
  displayName: string;
  introSeen: boolean;
  /** UI locale: English or Hebrew (RTL). */
  locale: string;
  boardTheme: string;
  pieceSet: string;
  lobbyColor: string;
  customMinIdx: number;
  customIncIdx: number;
  computerColor: string;
  puzzleRating: number;
  puzzleCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserPreferencesSchema = new Schema<IUserPreferences>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, default: "" },
    introSeen: { type: Boolean, default: false },
    locale: { type: String, default: "en", enum: ["en", "he", "ru", "fr", "es"] },
    boardTheme: { type: String, default: "brown" },
    pieceSet: { type: String, default: "cburnett" },
    lobbyColor: { type: String, default: "random" },
    customMinIdx: { type: Number, default: 7 },
    customIncIdx: { type: Number, default: 3 },
    computerColor: { type: String, default: "white" },
    puzzleRating: { type: Number, default: 1500 },
    puzzleCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "userpreferences" }
);

export default mongoose.model<IUserPreferences>("UserPreferences", UserPreferencesSchema);
