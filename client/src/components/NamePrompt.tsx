import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AppLocale } from "../i18n/locale";
import { FlagGb, FlagIl, FlagRu, FlagFr, FlagEs } from "./LanguageFlags";
import styles from "./NamePrompt.module.css";

const LANG_OPTIONS: { locale: AppLocale; Flag: React.ComponentType<{ className?: string }>; key: string }[] = [
  { locale: "en", Flag: FlagGb, key: "lang.en" },
  { locale: "he", Flag: FlagIl, key: "lang.he" },
  { locale: "ru", Flag: FlagRu, key: "lang.ru" },
  { locale: "fr", Flag: FlagFr, key: "lang.fr" },
  { locale: "es", Flag: FlagEs, key: "lang.es" },
];

interface Props {
  onSubmit: (name: string, locale: AppLocale) => void;
}

const RESERVED_NAME_PATTERN = /^stockfish/i;

function isReservedName(name: string): boolean {
  return RESERVED_NAME_PATTERN.test(name.trim());
}

export default function NamePrompt({ onSubmit }: Props) {
  const { t, locale: ctxLocale, setLocale } = useI18n();
  const [name, setName] = useState("");
  const [locale, setLocalLocale] = useState<AppLocale>(() => ctxLocale);

  const pickLocale = (l: AppLocale) => {
    setLocalLocale(l);
    setLocale(l);
  };

  const trimmed = name.trim();
  const reserved = isReservedName(trimmed);
  const valid = trimmed.length >= 2 && !reserved;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (valid) {
      onSubmit(trimmed, locale);
    }
  };

  return (
    <div className={styles["container"]}>
      <div className={styles["card"]}>
        <div className={styles["logoRow"]}>
          <img src="/favicon.png" alt="" className={styles["logoIcon"]} />
          <span className={styles["logoText"]}>{t("app.name")}</span>
        </div>
        <p className={styles["subtitle"]}>{t("namePrompt.subtitle")}</p>

        <div className={styles["langBlock"]}>
          <span className={styles["langLabel"]}>{t("namePrompt.language")}</span>
          <div className={styles["langRow"]}>
            {LANG_OPTIONS.map(({ locale: l, Flag, key }) => (
              <button
                key={l}
                type="button"
                className={`${styles["langBtn"]} ${locale === l ? styles["langBtnActive"] : ""}`}
                onClick={() => pickLocale(l)}
                aria-label={t(key)}
                aria-pressed={locale === l}
              >
                <Flag {...(styles["flag"] ? { className: styles["flag"] } : {})} />
                <span>{t(key)}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles["form"]}>
          <input
            className={styles["input"]}
            type="text"
            placeholder={t("namePrompt.username")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={20}
          />
          {reserved && (
            <p className={styles["error"]}>{t("namePrompt.reservedName")}</p>
          )}
          <button
            className={styles["button"]}
            type="submit"
            disabled={!valid}
          >
            {t("namePrompt.enter")}
          </button>
        </form>
      </div>
    </div>
  );
}
