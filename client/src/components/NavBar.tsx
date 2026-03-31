import { Link, useLocation } from "react-router-dom";
import { getEnv } from "../types";
import { useI18n } from "../i18n/I18nProvider";
import { useOnlinePlayerCount } from "../hooks/useOnlinePlayerCount";
import { useConnectionStatus, type SignalStrength } from "../hooks/useConnectionStatus";
import styles from "./NavBar.module.css";

const STRENGTH_COLORS: Record<SignalStrength, string> = {
  0: "#ca3431",
  1: "#ca3431",
  2: "#e6b800",
  3: "#3dad2e",
  4: "#3dad2e",
};

function SignalIcon({ strength, connected }: { strength: SignalStrength; connected: boolean }) {
  if (!connected) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ca3431" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" opacity="0.2" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" opacity="0.2" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" opacity="0.2" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" opacity="0.2" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" opacity="0.2" />
        <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
      </svg>
    );
  }
  const color = STRENGTH_COLORS[strength];
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.42 9a15.91 15.91 0 0 1 21.16 0" opacity={strength >= 4 ? 1 : 0.2} />
      <path d="M5 12.55a10.94 10.94 0 0 1 14 0" opacity={strength >= 3 ? 1 : 0.2} />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" opacity={strength >= 2 ? 1 : 0.2} />
      <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" opacity={strength >= 1 ? 1 : 0.2} />
    </svg>
  );
}

interface Props {
  displayName?: string;
  onChangeName?: () => void;
  onOpenSettings?: () => void;
  inActiveGame?: boolean;
}

export default function NavBar({ displayName, onChangeName, onOpenSettings, inActiveGame }: Props) {
  const { t } = useI18n();
  const flags = getEnv();
  const showGameHistory = flags.FEATURE_GAME_HISTORY !== "false";
  const showBoardSettings = flags.FEATURE_BOARD_SETTINGS !== "false";
  const samlEnabled = flags.FEATURE_SAML_AUTH === "true";
  const showOnlinePlayerCount = flags.FEATURE_ONLINE_PLAYER_COUNT !== "false";
  const showConnectionStatus = flags.FEATURE_CONNECTION_STATUS !== "false";
  const onlinePlayerCount = useOnlinePlayerCount();
  const connectionStatus = useConnectionStatus();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <header className={styles['header']}>
      <div className={styles['headerLeft']}>
        <Link to="/" className={`${styles['logo']} ${inActiveGame ? styles['navLinkDisabled'] : ""}`} onClick={inActiveGame ? (e) => e.preventDefault() : undefined}>
          <img src="/favicon.png" alt="" className={styles['logoIcon']} />
          <span>{t("app.name")}</span>
        </Link>
        <nav className={styles['nav']}>
          <Link data-tour="nav-play" to="/" className={`${styles['navLink']} ${inActiveGame ? styles['navLinkDisabled'] : ""} ${location.pathname === "/" || isActive("/game") ? styles['navLinkActive'] : ""}`} onClick={inActiveGame ? (e) => e.preventDefault() : undefined}>
            <svg className={styles['navIcon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {t("nav.play")}
          </Link>
          <Link data-tour="nav-computer" to="/computer" className={`${styles['navLink']} ${inActiveGame ? styles['navLinkDisabled'] : ""} ${isActive("/computer") || isActive("/play/computer") ? styles['navLinkActive'] : ""}`} onClick={inActiveGame ? (e) => e.preventDefault() : undefined}>
            <svg className={styles['navIcon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            {t("nav.computer")}
          </Link>
          <Link data-tour="nav-puzzles" to="/puzzles" className={`${styles['navLink']} ${inActiveGame ? styles['navLinkDisabled'] : ""} ${isActive("/puzzles") ? styles['navLinkActive'] : ""}`} onClick={inActiveGame ? (e) => e.preventDefault() : undefined}>
            <svg className={styles['navIcon']} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-2 .9-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20c0 1.1.9 2 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>
            {t("nav.puzzles")}
          </Link>
          {showGameHistory && (
            <Link data-tour="nav-games" to="/games" className={`${styles['navLink']} ${inActiveGame ? styles['navLinkDisabled'] : ""} ${isActive("/games") ? styles['navLinkActive'] : ""}`} onClick={inActiveGame ? (e) => e.preventDefault() : undefined}>
              <svg className={styles['navIcon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              {t("nav.games")}
            </Link>
          )}
        </nav>
      </div>
      <div className={styles['headerRight']}>
        {showConnectionStatus && (
          <div
            data-tour="connection-status"
            className={styles["connectionIndicator"]}
            title={
              connectionStatus.connected
                ? t("nav.connectionLatency", { ms: String(connectionStatus.latency ?? "—") })
                : t("nav.connectionDisconnected")
            }
            aria-label={
              connectionStatus.connected
                ? t("nav.connectionLatency", { ms: String(connectionStatus.latency ?? "—") })
                : t("nav.connectionDisconnected")
            }
          >
            <SignalIcon strength={connectionStatus.strength} connected={connectionStatus.connected} />
            {connectionStatus.connected && connectionStatus.latency !== null && (
              <span className={styles["connectionLatency"]}>{connectionStatus.latency}ms</span>
            )}
          </div>
        )}
        {showOnlinePlayerCount && (
          <div
            data-tour="online-count"
            className={styles["onlineIndicator"]}
            title={t("nav.onlinePlayersTitle")}
            aria-label={onlinePlayerCount !== null ? t("nav.onlinePlayersAria", { count: String(onlinePlayerCount) }) : t("nav.onlinePlayersTitle")}
          >
            <span className={onlinePlayerCount === null ? styles["onlineDotStale"] : styles["onlineDot"]} aria-hidden />
            <span className={styles["onlineCount"]}>{onlinePlayerCount ?? "—"}</span>
          </div>
        )}
        {showBoardSettings && onOpenSettings && (
          <button data-tour="settings-btn" type="button" className={styles['settingsLink']} onClick={onOpenSettings} title={t("nav.boardSettings")}>
            <svg className={styles['navIcon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        )}
        {displayName && (
          <div className={styles['user']}>
            <span className={styles['playerName']}>{displayName}</span>
            {onChangeName && (
              <button type="button" className={styles['changeNameBtn']} onClick={onChangeName}>
                {t("nav.change")}
              </button>
            )}
            {samlEnabled && (
              <button type="button" className={styles['changeNameBtn']} onClick={() => { window.location.href = "/auth/logout"; }}>
                {t("nav.logout")}
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
