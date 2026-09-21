import Image from 'next/image';
import Link from 'next/link';
import styles from './standalone.module.css';

export const metadata = {
  title: 'Daily Report | RitsuFlow',
  description: 'Standalone RitsuFlow Daily Report field workspace.',
};

export default function DailyReportLayout({ children }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.brand} aria-label="RitsuFlow home">
          <Image
            src="/logo-white.png"
            alt="RitsuFlow"
            width={280}
            height={110}
            priority
            className={styles.logo}
          />
        </Link>

        <div className={styles.identity}>
          <h1 className={styles.title}>Daily Report</h1>
          <p className={styles.subtitle}>Record and manage daily field activities.</p>
        </div>

        <div className={styles.search} aria-hidden="true">
          <span>⌕</span>
          <span>Search projects, clients, or locations...</span>
          <span className={styles.searchKey}>Ctrl K</span>
        </div>

        <div className={styles.headerActions}>
          <button type="button" className={styles.bell} aria-label="Notifications">
            ♧
            <span className={styles.notification}>3</span>
          </button>

          <Link href="/dashboard" className={styles.returnButton}>
            ← Return to Workspace
          </Link>

          <div className={styles.user}>
            <span className={styles.avatar}>EF</span>
            <span className={styles.userText}>
              <strong>Eduardo Freitas</strong>
              <span>Operations Manager</span>
            </span>
          </div>
        </div>
      </header>

      <div className={styles.content}>{children}</div>
    </div>
  );
}