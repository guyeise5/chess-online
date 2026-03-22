import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.watermark}>
      {(window as any).__ENV__?.AUTHOR_URL ? (
        <a href={(window as any).__ENV__.AUTHOR_URL} target="_blank" rel="noopener noreferrer" className={styles.watermarkLink}>
          &copy; Guy Eisenbach
        </a>
      ) : (
        <span>&copy; Guy Eisenbach</span>
      )}
    </footer>
  );
}
