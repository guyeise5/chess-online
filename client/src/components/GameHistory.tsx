import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./GameHistory.module.css";

interface Props {
  playerName: string;
  onChangeName: () => void;
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

function resultLabel(outcome: "win" | "loss" | "draw" | "unknown"): string {
  switch (outcome) {
    case "win":
      return "Won";
    case "loss":
      return "Lost";
    case "draw":
      return "Draw";
    default:
      return "—";
  }
}

function resultClass(outcome: "win" | "loss" | "draw" | "unknown"): string {
  switch (outcome) {
    case "win":
      return styles.resultWin;
    case "loss":
      return styles.resultLoss;
    case "draw":
      return styles.resultDraw;
    default:
      return styles.resultUnknown;
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

export default function GameHistory({ playerName, onChangeName }: Props) {
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
          setGames(data);
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
    <div className={styles.container}>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          <img src="/favicon.png" alt="" className={styles.logoIcon} /> Chess
        </Link>
        <div className={styles.user}>
          <span className={styles.playerName}>{playerName}</span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>My Games</h2>
          </div>

          {loading && <div className={styles.loading}>Loading games...</div>}

          {error && <div className={styles.empty}>Failed to load games.</div>}

          {!loading && !error && games.length === 0 && (
            <div className={styles.empty}>
              <p>No games found. Play a game and it will appear here!</p>
            </div>
          )}

          {!loading && !error && games.length > 0 && (
            <div className={styles.gameList}>
              {games.map((game) => {
                const outcome = resultForPlayer(game, playerName);
                const opponent =
                  game.playerWhite === playerName
                    ? game.playerBlack ?? "Unknown"
                    : game.playerWhite ?? "Unknown";

                return (
                  <div
                    key={game.gameId}
                    className={styles.gameCard}
                    onClick={() => navigate(`/analysis/${game.gameId}`)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        navigate(`/analysis/${game.gameId}`);
                    }}
                  >
                    <div className={styles.gameInfo}>
                      <span className={styles.players}>
                        <span className={styles.currentPlayer}>
                          {playerName}
                        </span>{" "}
                        vs {opponent}
                      </span>
                      <div className={styles.gameMeta}>
                        <span className={styles.moveCount}>
                          {game.moves.length} moves
                        </span>
                        {game.createdAt && (
                          <span className={styles.date}>
                            {formatDate(game.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.gameRight}>
                      <span
                        className={`${styles.resultBadge} ${resultClass(outcome)}`}
                      >
                        {resultLabel(outcome)}
                      </span>
                      <span className={styles.analyzeBtn}>Analyze</span>
                    </div>
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
