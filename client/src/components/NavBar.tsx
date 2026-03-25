import { Link, useLocation } from "react-router-dom";
import { getEnv } from "../types";
import styles from "./NavBar.module.css";

interface Props {
  playerName?: string;
  onChangeName?: () => void;
  onOpenSettings?: () => void;
  inActiveGame?: boolean;
}

export default function NavBar({ playerName, onChangeName, onOpenSettings, inActiveGame }: Props) {
  const flags = getEnv();
  const showGameHistory = flags.FEATURE_GAME_HISTORY !== "false";
  const showBoardSettings = flags.FEATURE_BOARD_SETTINGS !== "false";
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <header className={styles['header']}>
      <div className={styles['headerLeft']}>
        <Link to="/" className={`${styles['logo']} ${inActiveGame ? styles['navLinkDisabled'] : ""}`} onClick={inActiveGame ? (e) => e.preventDefault() : undefined}>
          <img src="/favicon.png" alt="" className={styles['logoIcon']} />
          <span>Chess</span>
        </Link>
        <nav className={styles['nav']}>
          <Link data-tour="nav-play" to="/" className={`${styles['navLink']} ${inActiveGame ? styles['navLinkDisabled'] : ""} ${location.pathname === "/" || isActive("/game") ? styles['navLinkActive'] : ""}`} onClick={inActiveGame ? (e) => e.preventDefault() : undefined}>
            <svg className={styles['navIcon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Play
          </Link>
          <Link data-tour="nav-computer" to="/computer" className={`${styles['navLink']} ${inActiveGame ? styles['navLinkDisabled'] : ""} ${isActive("/computer") || isActive("/play/computer") ? styles['navLinkActive'] : ""}`} onClick={inActiveGame ? (e) => e.preventDefault() : undefined}>
            <svg className={styles['navIcon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Computer
          </Link>
          <Link data-tour="nav-puzzles" to="/puzzles" className={`${styles['navLink']} ${inActiveGame ? styles['navLinkDisabled'] : ""} ${isActive("/puzzles") ? styles['navLinkActive'] : ""}`} onClick={inActiveGame ? (e) => e.preventDefault() : undefined}>
            <svg className={styles['navIcon']} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-2 .9-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20c0 1.1.9 2 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>
            Puzzles
          </Link>
          {showGameHistory && (
            <Link data-tour="nav-games" to="/games" className={`${styles['navLink']} ${inActiveGame ? styles['navLinkDisabled'] : ""} ${isActive("/games") ? styles['navLinkActive'] : ""}`} onClick={inActiveGame ? (e) => e.preventDefault() : undefined}>
              <svg className={styles['navIcon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Games
            </Link>
          )}
        </nav>
      </div>
      <div className={styles['headerRight']}>
        {showBoardSettings && onOpenSettings && (
          <button data-tour="settings-btn" className={styles['settingsLink']} onClick={onOpenSettings} title="Board settings">
            <svg className={styles['navIcon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        )}
        {playerName && (
          <div className={styles['user']}>
            <span className={styles['playerName']}>{playerName}</span>
            {onChangeName && (
              <button className={styles['changeNameBtn']} onClick={onChangeName}>
                Change
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
