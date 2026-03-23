export interface BoardTheme {
  name: string;
  light: string;
  dark: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { name: "brown", light: "#f0d9b5", dark: "#b58863" },
  { name: "blue", light: "#dee3e6", dark: "#8ca2ad" },
  { name: "blue2", light: "#97b2c7", dark: "#546f82" },
  { name: "blue3", light: "#d9e0e6", dark: "#315991" },
  { name: "canvas", light: "#d7c399", dark: "#846e40" },
  { name: "green", light: "#ffffdd", dark: "#86a666" },
  { name: "green-plastic", light: "#f2f9bb", dark: "#639a30" },
  { name: "grey", light: "#b8b8b8", dark: "#7e7e7e" },
  { name: "ic", light: "#ececec", dark: "#c1c18e" },
  { name: "maple", light: "#e8ceab", dark: "#bc7944" },
  { name: "maple2", light: "#e2c89f", dark: "#996633" },
  { name: "olive", light: "#b8b19f", dark: "#6d6655" },
  { name: "pink", light: "#f1f1c9", dark: "#f07272" },
  { name: "purple", light: "#9f90b0", dark: "#7d4a8d" },
  { name: "purple-diag", light: "#e5daf0", dark: "#957ab0" },
  { name: "wood", light: "#d8a45b", dark: "#9b4d0f" },
  { name: "wood2", light: "#a38b5d", dark: "#6c5017" },
  { name: "wood3", light: "#d0ceca", dark: "#755839" },
  { name: "wood4", light: "#caab6e", dark: "#7b5330" },
];

export const BLINDFOLD_PIECES = "blindfold";

export const PIECE_SETS = [
  "alpha",
  "anarcandy",
  "caliente",
  "california",
  "cardinal",
  "cburnett",
  "celtic",
  "chess7",
  "chessnut",
  "companion",
  "cooke",
  "disguised",
  "dubrovny",
  "fantasy",
  "firi",
  "fresca",
  "gioco",
  "governor",
  "horsey",
  "icpieces",
  "kiwen-suwi",
  "kosal",
  "leipzig",
  "letter",
  "maestro",
  "merida",
  "mpchess",
  "pirouetti",
  "pixel",
  "reillycraig",
  "rhosgfx",
  "riohacha",
  "shahi-ivory-brown",
  "shapes",
  "spatial",
  "staunty",
  "tatiana",
  "xkcd",
  BLINDFOLD_PIECES,
];

export const DEFAULT_BOARD = "brown";
export const DEFAULT_PIECES = "cburnett";

export function getBoardTheme(name: string): BoardTheme {
  return BOARD_THEMES.find((t) => t.name === name) ?? BOARD_THEMES[0];
}
