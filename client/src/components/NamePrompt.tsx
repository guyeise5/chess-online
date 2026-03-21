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
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>&#9822; Chess</h1>
        <p className={styles.subtitle}>Enter your name to get started</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className={styles.input}
            type="text"
            placeholder="Your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={20}
          />
          <button
            className={styles.button}
            type="submit"
            disabled={name.trim().length < 2}
          >
            Enter Lobby
          </button>
        </form>
      </div>
    </div>
  );
}
