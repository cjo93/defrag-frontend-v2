import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div
          className={styles.statusContainer}
          role="status"
          aria-label="System Status: Operational"
        >
          <div className={styles.statusDot} aria-hidden="true" />
          <span>OPERATIONAL</span>
        </div>

        <h1 className={styles.title}>Defrag API</h1>
      </main>

      <footer className={styles.version}>
        v0.1.0
      </footer>
    </div>
  );
}
