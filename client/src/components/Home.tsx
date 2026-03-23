import { Link } from "react-router-dom";
import NavBar from "./NavBar";
import styles from "./Home.module.css";

interface Props {
  playerName: string;
  onChangeName: () => void;
}

export default function Home({ playerName, onChangeName }: Props) {
  const flags = (window as any).__ENV__ || {};
  const showGameHistory = flags.FEATURE_GAME_HISTORY !== "false";

  return (
    <div className={styles.container}>
      <NavBar playerName={playerName} onChangeName={onChangeName} />

      <main className={styles.main}>
        <div className={styles.playPanel}>
          <Link to="/rooms" className={styles.playBtn}>
            <div className={styles.playBtnIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div className={styles.playBtnText}>
              <span className={styles.playBtnTitle}>Play Online</span>
              <span className={styles.playBtnDesc}>Create or join a game room</span>
            </div>
          </Link>

          <Link to="/computer" className={styles.playBtn}>
            <div className={styles.playBtnIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div className={styles.playBtnText}>
              <span className={styles.playBtnTitle}>Play vs Computer</span>
              <span className={styles.playBtnDesc}>Challenge Stockfish at any level</span>
            </div>
          </Link>

          <Link to="/puzzles" className={styles.playBtn}>
            <div className={styles.playBtnIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div className={styles.playBtnText}>
              <span className={styles.playBtnTitle}>Puzzle Trainer</span>
              <span className={styles.playBtnDesc}>Improve your tactics</span>
            </div>
          </Link>

          {showGameHistory && (
            <Link to="/games" className={styles.playBtn}>
              <div className={styles.playBtnIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div className={styles.playBtnText}>
                <span className={styles.playBtnTitle}>My Games</span>
                <span className={styles.playBtnDesc}>Review &amp; analyze past games</span>
              </div>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
