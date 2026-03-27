import React, { useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { BOARD_THEMES, PIECE_SETS, DEFAULT_PIECES, BLINDFOLD_PIECES, type BoardTheme } from "../boardThemes";
import type { BoardPreferences } from "../hooks/useBoardPreferences";
import { useUserPrefs } from "../hooks/useUserPreferences";
import { useI18n } from "../i18n/I18nProvider";
import type { AppLocale } from "../i18n/locale";
import { FlagGb, FlagIl } from "./LanguageFlags";
import styles from "./BoardSettings.module.css";

interface Props {
  boardPrefs: BoardPreferences;
  onClose: () => void;
}

const PREVIEW_FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";

function BoardSwatch({ theme, active, onClick }: { theme: BoardTheme; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`${styles['swatch']} ${active ? styles['swatchActive'] : ""}`}
      onClick={onClick}
      title={theme.name}
    >
      <div className={styles['swatchGrid']}>
        <div style={{ backgroundColor: theme.light }} />
        <div style={{ backgroundColor: theme.dark }} />
        <div style={{ backgroundColor: theme.dark }} />
        <div style={{ backgroundColor: theme.light }} />
      </div>
      <span className={styles['swatchLabel']}>{theme.name}</span>
    </button>
  );
}

function PieceSwatch({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  const isBlindfold = name === BLINDFOLD_PIECES;
  return (
    <button
      className={`${styles['swatch']} ${active ? styles['swatchActive'] : ""}`}
      onClick={onClick}
      title={name}
    >
      <div className={styles['piecePreview']}>
        {isBlindfold ? (
          <svg className={styles['pieceImg']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          </svg>
        ) : (
          <img src={`/pieces/${name}/wN.svg`} alt={name} className={styles['pieceImg']} />
        )}
      </div>
      <span className={styles['swatchLabel']}>{name}</span>
    </button>
  );
}

function buildPreviewPieces(pieceSet: string): Record<string, () => React.JSX.Element> | undefined {
  if (pieceSet === DEFAULT_PIECES) return undefined;
  const codes = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"];
  const result: Record<string, () => React.JSX.Element> = {};
  if (pieceSet === BLINDFOLD_PIECES) {
    for (const code of codes) {
      const src = `/pieces/${DEFAULT_PIECES}/${code}.svg`;
      result[code] = () => (
        <img src={src} alt="" style={{ width: "100%", height: "100%", opacity: 0 }} />
      );
    }
    return result;
  }
  for (const code of codes) {
    const src = `/pieces/${pieceSet}/${code}.svg`;
    result[code] = () => (
      <img src={src} alt={code} style={{ width: "100%", height: "100%" }} />
    );
  }
  return result;
}

export default function BoardSettings({ boardPrefs, onClose }: Props) {
  const { update } = useUserPrefs();
  const { t, locale, setLocale } = useI18n();

  const setUiLocale = (l: AppLocale) => {
    setLocale(l);
    update({ locale: l });
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const previewPieces = buildPreviewPieces(boardPrefs.piecesName);

  return (
    <div className={styles['overlay']} onClick={onClose}>
      <div className={styles['modal']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['modalHeader']}>
          <h2 className={styles['modalTitle']}>{t("settings.title")}</h2>
          <button type="button" className={styles['closeBtn']} onClick={onClose} aria-label={t("intro.close")}>✕</button>
        </div>

        <div className={styles['modalBody']}>
          <div className={styles['previewCol']}>
            <div className={styles['boardWrap']}>
              <Chessboard
                options={{
                  position: PREVIEW_FEN,
                  ...(previewPieces ? { pieces: previewPieces } : {}),
                  darkSquareStyle: boardPrefs.darkSquareStyle,
                  lightSquareStyle: boardPrefs.lightSquareStyle,
                  darkSquareNotationStyle: boardPrefs.darkSquareNotationStyle,
                  lightSquareNotationStyle: boardPrefs.lightSquareNotationStyle,
                  boardStyle: { borderRadius: "0" },
                  animationDurationInMs: 0,
                }}
              />
            </div>
          </div>

          <div className={styles['optionsCol']}>
            <h3 className={styles['sectionTitle']}>{t("settings.language")}</h3>
            <p className={styles['langHint']}>{t("settings.languageHint")}</p>
            <div className={styles['langRow']}>
              <button
                type="button"
                className={`${styles['langBtn']} ${locale === "en" ? styles['langBtnActive'] : ""}`}
                onClick={() => setUiLocale("en")}
                aria-label={t("lang.en")}
                aria-pressed={locale === "en"}
                title={t("lang.en")}
              >
                <FlagGb {...(styles['langFlag'] ? { className: styles['langFlag'] } : {})} />
              </button>
              <button
                type="button"
                className={`${styles['langBtn']} ${locale === "he" ? styles['langBtnActive'] : ""}`}
                onClick={() => setUiLocale("he")}
                aria-label={t("lang.he")}
                aria-pressed={locale === "he"}
                title={t("lang.he")}
              >
                <FlagIl {...(styles['langFlag'] ? { className: styles['langFlag'] } : {})} />
              </button>
            </div>

            <h3 className={styles['sectionTitle']}>{t("settings.board")}</h3>
            <div className={styles['grid']}>
              {BOARD_THEMES.map((t) => (
                <BoardSwatch
                  key={t.name}
                  theme={t}
                  active={boardPrefs.boardName === t.name}
                  onClick={() => boardPrefs.setBoard(t.name)}
                />
              ))}
            </div>

            <h3 className={styles['sectionTitle']}>{t("settings.pieces")}</h3>
            <div className={styles['grid']}>
              {PIECE_SETS.map((name) => (
                <PieceSwatch
                  key={name}
                  name={name}
                  active={boardPrefs.piecesName === name}
                  onClick={() => boardPrefs.setPieces(name)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
