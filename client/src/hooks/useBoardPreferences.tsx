import React, { useCallback, useMemo } from "react";
import { getBoardTheme, DEFAULT_BOARD, DEFAULT_PIECES, BLINDFOLD_PIECES, type BoardTheme } from "../boardThemes";
import { useUserPrefs } from "./useUserPreferences";

const PIECE_CODES = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"] as const;

function buildBlindfoldComponents(): Record<string, () => React.JSX.Element> {
  const result: Record<string, () => React.JSX.Element> = {};
  for (const code of PIECE_CODES) {
    const src = `/pieces/${DEFAULT_PIECES}/${code}.svg`;
    result[code] = () => (
      <img src={src} alt="" style={{ width: "100%", height: "100%", opacity: 0 }} />
    );
  }
  return result;
}

function buildPieceComponents(pieceSet: string): Record<string, () => React.JSX.Element> {
  if (pieceSet === BLINDFOLD_PIECES) return buildBlindfoldComponents();
  const result: Record<string, () => React.JSX.Element> = {};
  for (const code of PIECE_CODES) {
    const src = `/pieces/${pieceSet}/${code}.svg`;
    result[code] = () => (
      <img src={src} alt={code} style={{ width: "100%", height: "100%" }} />
    );
  }
  return result;
}

export interface BoardPreferences {
  boardName: string;
  piecesName: string;
  boardTheme: BoardTheme;
  darkSquareStyle: { backgroundColor: string };
  lightSquareStyle: { backgroundColor: string };
  darkSquareNotationStyle: { color: string; opacity: number };
  lightSquareNotationStyle: { color: string; opacity: number };
  customPieces: Record<string, () => React.JSX.Element> | undefined;
  setBoard: (name: string) => void;
  setPieces: (name: string) => void;
}

export default function useBoardPreferences(): BoardPreferences {
  const { prefs: userPrefs, update } = useUserPrefs();

  const boardName = userPrefs.boardTheme ?? DEFAULT_BOARD;
  const piecesName = userPrefs.pieceSet ?? DEFAULT_PIECES;

  const setBoard = useCallback((name: string) => {
    update({ boardTheme: name });
  }, [update]);

  const setPieces = useCallback((name: string) => {
    update({ pieceSet: name });
  }, [update]);

  const boardTheme = useMemo(() => getBoardTheme(boardName), [boardName]);

  const customPieces = useMemo(
    () => (piecesName === DEFAULT_PIECES ? undefined : buildPieceComponents(piecesName)),
    [piecesName]
  );

  return {
    boardName,
    piecesName,
    boardTheme,
    darkSquareStyle: { backgroundColor: boardTheme.dark },
    lightSquareStyle: { backgroundColor: boardTheme.light },
    darkSquareNotationStyle: { color: boardTheme.light, opacity: 0.8 },
    lightSquareNotationStyle: { color: boardTheme.dark, opacity: 0.8 },
    customPieces,
    setBoard,
    setPieces,
  };
}
