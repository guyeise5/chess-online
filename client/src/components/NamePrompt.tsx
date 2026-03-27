import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AppLocale } from "../i18n/locale";
import { FlagGb, FlagIl } from "./LanguageFlags";
import styles from "./NamePrompt.module.css";

interface Props {
  onSubmit: (name: string, locale: AppLocale) => void;
}

export default function NamePrompt({ onSubmit }: Props) {
  const { t, locale: ctxLocale, setLocale } = useI18n();
  const [name, setName] = useState("");
  const [locale, setLocalLocale] = useState<AppLocale>(() => ctxLocale);

  const pickLocale = (l: AppLocale) => {
    setLocalLocale(l);
    setLocale(l);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length >= 2) {
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
            <button
              type="button"
              className={`${styles["langBtn"]} ${locale === "en" ? styles["langBtnActive"] : ""}`}
              onClick={() => pickLocale("en")}
              aria-label={t("lang.en")}
              aria-pressed={locale === "en"}
            >
              <FlagGb {...(styles["flag"] ? { className: styles["flag"] } : {})} />
              <span>{t("lang.en")}</span>
            </button>
            <button
              type="button"
              className={`${styles["langBtn"]} ${locale === "he" ? styles["langBtnActive"] : ""}`}
              onClick={() => pickLocale("he")}
              aria-label={t("lang.he")}
              aria-pressed={locale === "he"}
            >
              <FlagIl {...(styles["flag"] ? { className: styles["flag"] } : {})} />
              <span>{t("lang.he")}</span>
            </button>
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
          <button
            className={styles["button"]}
            type="submit"
            disabled={name.trim().length < 2}
          >
            {t("namePrompt.enter")}
          </button>
        </form>
      </div>
    </div>
  );
}
