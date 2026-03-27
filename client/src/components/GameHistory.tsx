import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "./NavBar";
import { useI18n } from "../i18n/I18nProvider";
import styles from "./GameHistory.module.css";

interface Props {
  playerName: string;
  onChangeName: () => void;
  onOpenSettings?: () => void;
}

export interface GameSummary {
  gameId: string;
  moves: string[];
  playerWhite?: string;
  playerBlack?: string;
  orientation?: "white" | "black";
  result?: string;
  createdAt: string;
}

const API_BASE = import.meta.env.PROD ? "" : "http://localhost:3001";

function resultForPlayer(
  game: GameSummary,
  playerName: string
): "win" | "loss" | "draw" | "unknown" {
  if (!game.result) return "unknown";
  if (game.result === "1/2-1/2") return "draw";
  const isWhite = game.playerWhite === playerName;
  const isBlack = game.playerBlack === playerName;
  if (!isWhite && !isBlack) return "unknown";
  if (game.result === "1-0") return isWhite ? "win" : "loss";
  if (game.result === "0-1") return isBlack ? "win" : "loss";
  return "unknown";
}

function resultLabel(
  outcome: "win" | "loss" | "draw" | "unknown",
  t: (key: string) => string
): string {
  switch (outcome) {
    case "win":
      return t("history.won");
    case "loss":
      return t("history.lost");
    case "draw":
      return t("history.draw");
    default:
      return t("history.unknown");
  }
}

function resultClass(outcome: "win" | "loss" | "draw" | "unknown"): string {
  switch (outcome) {
    case "win":
      return styles['resultWin'] ?? "";
    case "loss":
      return styles['resultLoss'] ?? "";
    case "draw":
      return styles['resultDraw'] ?? "";
    default:
      return styles['resultUnknown'] ?? "";
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function GameHistory({ playerName, onChangeName, onOpenSettings }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/games?player=${encodeURIComponent(playerName)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load games");
        return res.json();
      })
      .then((data: GameSummary[]) => {
        if (!cancelled) {
          setGames(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [playerName]);

  return (
    <div className={styles['container']}>
      <NavBar playerName={playerName} onChangeName={onChangeName} {...(onOpenSettings ? { onOpenSettings } : {})} />

      <main className={styles['main']}>
        <div className={styles['panel']}>
          <h2 className={styles['panelTitle']}>
            {t("history.title")}
            {!loading && !error && (
              <span className={styles['gameCount']}>{games.length}</span>
            )}
          </h2>

          {loading && <div className={styles['status']}>{t("history.loading")}</div>}
          {error && <div className={styles['status']}>{t("history.error")}</div>}

          {!loading && !error && games.length === 0 && (
            <div className={styles['status']}>
              {t("history.empty")}
            </div>
          )}

          {!loading && !error && games.length > 0 && (
            <div className={styles['gameList']}>
              {games.map((game) => {
                const outcome = resultForPlayer(game, playerName);
                const opponent =
                  game.playerWhite === playerName
                    ? game.playerBlack ?? "Unknown"
                    : game.playerWhite ?? "Unknown";

                return (
                  <div
                    key={game.gameId}
                    className={styles['gameRow']}
                    onClick={() => navigate(`/analysis/${game.gameId}`)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        navigate(`/analysis/${game.gameId}`);
                    }}
                  >
                    <span
                      className={`${styles['resultDot']} ${resultClass(outcome)}`}
                    />
                    <div className={styles['gameInfo']}>
                      <span className={styles['players']}>
                        <span className={styles['currentPlayer']}>
                          {playerName}
                        </span>{" "}
                        {t("history.vs")} {opponent}
                      </span>
                      <span className={styles['gameMeta']}>
                        {t("history.movesMeta", { n: String(game.moves.length) })}
                        {game.createdAt && ` · ${formatDate(game.createdAt)}`}
                      </span>
                    </div>
                    <span
                      className={`${styles['resultBadge']} ${resultClass(outcome)}`}
                    >
                      {resultLabel(outcome, t)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
