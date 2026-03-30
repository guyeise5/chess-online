export type TimeFormat = "ultrabullet" | "bullet" | "blitz" | "rapid" | "classical";
export type ColorChoice = "white" | "black" | "random";
export type RoomStatus = "waiting" | "playing" | "finished";

export interface RoomData {
  roomId: string;
  owner: string;
  ownerName?: string;
  opponent: string | null;
  opponentName?: string | null;
  timeFormat: TimeFormat;
  timeControl: number;
  increment: number;
  colorChoice: ColorChoice;
  isPrivate?: boolean;
  status: RoomStatus;
  fen: string;
  whitePlayer: string | null;
  blackPlayer: string | null;
  whiteName?: string | null;
  blackName?: string | null;
  whiteTime: number;
  blackTime: number;
  turn: "w" | "b";
  result: string | null;
  moves: string[];
  chatMessages?: ChatMessageData[];
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

export interface ChatMessageData {
  type: "player" | "system";
  sender?: string;
  text: string;
  timestamp: number;
}

export interface ChatMessage extends ChatMessageData {
  id: string;
}

export interface SocketResult {
  success: boolean;
  error?: string;
}

export interface RoomResult extends SocketResult {
  room?: RoomData;
}

export interface AppEnv {
  AUTHOR_URL?: string;
  FEATURE_GAME_STORAGE?: string;
  FEATURE_MATERIAL_DIFF?: string;
  FEATURE_OPENING_BOOK?: string;
  FEATURE_GAME_HISTORY?: string;
  FEATURE_BOARD_SETTINGS?: string;
  FEATURE_DISCONNECT_CLAIM?: string;
  FEATURE_GIVE_TIME?: string;
  FEATURE_DRAW_OFFER?: string;
  FEATURE_PRIVATE_GAMES?: string;
  FEATURE_MOVE_SOUND?: string;
  FEATURE_INTRODUCTION?: string;
  FEATURE_USER_PREFERENCES?: string;
  FEATURE_GAME_CHAT?: string;
  FEATURE_ONLINE_PLAYER_COUNT?: string;
  FEATURE_MOVE_HISTORY_BROWSE?: string;
  FEATURE_STATS?: string;
  FEATURE_PUZZLE_ANALYSIS?: string;
  FEATURE_CONNECTION_STATUS?: string;
  FEATURE_SAML_AUTH?: string;
}

declare global {
  interface Window {
    __ENV__?: AppEnv;
  }
}

export function getEnv(): AppEnv {
  return window.__ENV__ ?? {};
}
