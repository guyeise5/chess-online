import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import styles from "./NamePrompt.module.css";

interface Props {
  onSubmit: (name: string) => void;
}

const RESERVED_NAME_PATTERN = /^stockfish/i;

function isReservedName(name: string): boolean {
  return RESERVED_NAME_PATTERN.test(name.trim());
}

export default function NamePrompt({ onSubmit }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");

  const trimmed = name.trim();
  const reserved = isReservedName(trimmed);
  const valid = trimmed.length >= 2 && !reserved;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (valid) {
      onSubmit(trimmed);
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
