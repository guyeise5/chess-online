import { Link } from "react-router-dom";
import styles from "./Home.module.css";

interface Props {
  playerName: string;
  onChangeName: () => void;
}

export default function Home({ playerName, onChangeName }: Props) {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.logo}>
          <img src="/favicon.png" alt="" className={styles.logoIcon} /> Chess
        </h1>
        <div className={styles.user}>
          <span className={styles.playerName}>{playerName}</span>
          <button className={styles.changeNameBtn} onClick={onChangeName}>
            Change
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.grid}>
          <Link to="/rooms" className={styles.card}>
            <span className={styles.cardIcon}>&#9822;</span>
            <span className={styles.cardTitle}>Play Online</span>
            <span className={styles.cardDesc}>Create or join a room</span>
          </Link>

          <Link to="/computer" className={styles.card}>
            <span className={styles.cardIcon}>&#9812;</span>
            <span className={styles.cardTitle}>vs Computer</span>
            <span className={styles.cardDesc}>Play against Stockfish</span>
          </Link>

          <Link to="/puzzles" className={styles.card}>
            <span className={styles.cardIcon}>&#129513;</span>
            <span className={styles.cardTitle}>Puzzles</span>
            <span className={styles.cardDesc}>Train with tactics</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
