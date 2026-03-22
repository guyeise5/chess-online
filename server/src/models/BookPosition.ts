import mongoose, { Schema, Document } from "mongoose";

export interface IBookPosition extends Document {
  fen: string;
}

const BookPositionSchema = new Schema<IBookPosition>(
  {
    fen: { type: String, required: true, unique: true },
  },
  { collection: "bookpositions" }
);

export default mongoose.model<IBookPosition>("BookPosition", BookPositionSchema);
