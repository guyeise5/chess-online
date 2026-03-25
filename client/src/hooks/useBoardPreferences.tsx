import React, { useState, useCallback, useMemo } from "react";
import { getBoardTheme, DEFAULT_BOARD, DEFAULT_PIECES, BLINDFOLD_PIECES, type BoardTheme } from "../boardThemes";

const STORAGE_KEY = "chess-board-prefs";

interface BoardPrefs {
  board: string;
  pieces: string;
}

function loadPrefs(): BoardPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          board: typeof parsed.board === "string" ? parsed.board : DEFAULT_BOARD,
          pieces: typeof parsed.pieces === "string" ? parsed.pieces : DEFAULT_PIECES,
        };
      }
    }
  } catch {}
  return { board: DEFAULT_BOARD, pieces: DEFAULT_PIECES };
}

function savePrefs(prefs: BoardPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

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
  const [prefs, setPrefs] = useState<BoardPrefs>(loadPrefs);

  const setBoard = useCallback((name: string) => {
    setPrefs((prev) => {
      const next = { ...prev, board: name };
      savePrefs(next);
      return next;
    });
  }, []);

  const setPieces = useCallback((name: string) => {
    setPrefs((prev) => {
      const next = { ...prev, pieces: name };
      savePrefs(next);
      return next;
    });
  }, []);

  const boardTheme = useMemo(() => getBoardTheme(prefs.board), [prefs.board]);

  const customPieces = useMemo(
    () => (prefs.pieces === DEFAULT_PIECES ? undefined : buildPieceComponents(prefs.pieces)),
    [prefs.pieces]
  );

  return {
    boardName: prefs.board,
    piecesName: prefs.pieces,
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
