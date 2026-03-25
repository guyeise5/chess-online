import { getEnv } from "../types";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles['watermark']}>
      {getEnv().AUTHOR_URL ? (
        <a href={getEnv().AUTHOR_URL} target="_blank" rel="noopener noreferrer" className={styles['watermarkLink']}>
          &copy; Guy Eisenbach
        </a>
      ) : (
        <span>&copy; Guy Eisenbach</span>
      )}
    </footer>
  );
}
