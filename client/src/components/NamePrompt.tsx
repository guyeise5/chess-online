import { useState } from "react";
import styles from "./NamePrompt.module.css";

interface Props {
  onSubmit: (name: string) => void;
}

export default function NamePrompt({ onSubmit }: Props) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length >= 2) {
      onSubmit(trimmed);
    }
  };

  return (
    <div className={styles['container']}>
      <div className={styles['card']}>
        <div className={styles['logoRow']}>
          <img src="/favicon.png" alt="" className={styles['logoIcon']} />
          <span className={styles['logoText']}>Chess</span>
        </div>
        <p className={styles['subtitle']}>Choose a username to play</p>
        <form onSubmit={handleSubmit} className={styles['form']}>
          <input
            className={styles['input']}
            type="text"
            placeholder="Username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={20}
          />
          <button
            className={styles['button']}
            type="submit"
            disabled={name.trim().length < 2}
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
