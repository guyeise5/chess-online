import { Chess } from "chess.js";

export interface MoveValidationResult {
  validMoves: string[];
  truncated: boolean;
}

export function validateMoves(
  moves: string[],
  startFen?: string
): MoveValidationResult {
  if (moves.length === 0) return { validMoves: [], truncated: false };
  let g: Chess;
  try {
    g = new Chess(startFen || undefined);
  } catch {
    return { validMoves: [], truncated: true };
  }
  const validMoves: string[] = [];
  for (const san of moves) {
    try {
      const m = g.move(san);
      if (!m) break;
      validMoves.push(san);
    } catch {
      break;
    }
  }
  return { validMoves, truncated: validMoves.length < moves.length };
}
