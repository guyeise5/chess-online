import type { Chess } from "chess.js";

export type PieceType = "q" | "r" | "b" | "n" | "p";

const PIECE_VALUES: Record<PieceType, number> = {
  q: 9,
  r: 5,
  b: 3,
  n: 3,
  p: 1,
};

const PIECE_ORDER: PieceType[] = ["q", "r", "b", "n", "p"];

export interface SideMaterial {
  pieces: { type: PieceType; count: number }[];
  points: number;
}

export interface MaterialDiff {
  white: SideMaterial;
  black: SideMaterial;
}

export function computeMaterialDiff(game: Chess): MaterialDiff {
  const board = game.board();
  const counts: Record<PieceType, { w: number; b: number }> = {
    q: { w: 0, b: 0 },
    r: { w: 0, b: 0 },
    b: { w: 0, b: 0 },
    n: { w: 0, b: 0 },
    p: { w: 0, b: 0 },
  };

  for (const row of board) {
    for (const sq of row) {
      if (sq && sq.type !== "k") {
        counts[sq.type as PieceType][sq.color]++;
      }
    }
  }

  const whitePieces: { type: PieceType; count: number }[] = [];
  const blackPieces: { type: PieceType; count: number }[] = [];
  let whiteTotal = 0;
  let blackTotal = 0;

  for (const type of PIECE_ORDER) {
    const diff = counts[type].w - counts[type].b;
    if (diff > 0) {
      whitePieces.push({ type, count: diff });
      whiteTotal += diff * PIECE_VALUES[type];
    } else if (diff < 0) {
      blackPieces.push({ type, count: -diff });
      blackTotal += -diff * PIECE_VALUES[type];
    }
  }

  const net = whiteTotal - blackTotal;

  return {
    white: { pieces: whitePieces, points: net > 0 ? net : 0 },
    black: { pieces: blackPieces, points: net < 0 ? -net : 0 },
  };
}

