import { Link, useLocation } from "react-router-dom";
import styles from "./NavBar.module.css";

interface Props {
  playerName?: string;
  onChangeName?: () => void;
}

export default function NavBar({ playerName, onChangeName }: Props) {
  const flags = (window as any).__ENV__ || {};
  const showGameHistory = flags.FEATURE_GAME_HISTORY !== "false";
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <Link to="/" className={styles.logo}>
          <img src="/favicon.png" alt="" className={styles.logoIcon} />
          <span>Chess</span>
        </Link>
        <nav className={styles.nav}>
          <Link to="/" className={`${styles.navLink} ${location.pathname === "/" || isActive("/game") ? styles.navLinkActive : ""}`}>
            <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Play
          </Link>
          <Link to="/computer" className={`${styles.navLink} ${isActive("/computer") || isActive("/play/computer") ? styles.navLinkActive : ""}`}>
            <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Computer
          </Link>
          <Link to="/puzzles" className={`${styles.navLink} ${isActive("/puzzles") ? styles.navLinkActive : ""}`}>
            <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Puzzles
          </Link>
          {showGameHistory && (
            <Link to="/games" className={`${styles.navLink} ${isActive("/games") ? styles.navLinkActive : ""}`}>
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Games
            </Link>
          )}
        </nav>
      </div>
      {playerName && (
        <div className={styles.user}>
          <span className={styles.playerName}>{playerName}</span>
          {onChangeName && (
            <button className={styles.changeNameBtn} onClick={onChangeName}>
              Change
            </button>
          )}
        </div>
      )}
    </header>
  );
}
