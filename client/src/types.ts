export type TimeFormat = "bullet" | "blitz" | "rapid" | "classical";
export type ColorChoice = "white" | "black" | "random";
export type RoomStatus = "waiting" | "playing" | "finished";

export interface RoomData {
  roomId: string;
  owner: string;
  opponent: string | null;
  timeFormat: TimeFormat;
  timeControl: number;
  increment: number;
  colorChoice: ColorChoice;
  status: RoomStatus;
  fen: string;
  whitePlayer: string | null;
  blackPlayer: string | null;
  whiteTime: number;
  blackTime: number;
  turn: "w" | "b";
  result: string | null;
  moves: string[];
}

export interface MoveData {
  move: { from: string; to: string; promotion?: string; san: string };
  fen: string;
  turn: "w" | "b";
  whiteTime: number;
  blackTime: number;
  result: string | null;
  status: RoomStatus;
}

export interface GameOverData {
  result: string;
  reason: string;
}

export interface TimerData {
  whiteTime: number;
  blackTime: number;
}

export interface UndoData {
  fen: string;
  turn: "w" | "b";
  whiteTime: number;
  blackTime: number;
  moves: string[];
}
