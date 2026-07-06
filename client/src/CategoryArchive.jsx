import { useEffect, useState } from 'react';
import {
  api,
  formatDate,
  formatMoney,
  TASK_CATEGORIES,
  ACCOUNT_LABELS,
  ARCHIVE_ACTION_LABELS,
  TASK_STATUS_LABELS,
} from './api';

export function CategoryArchiveOverlay({ section, categoryKey, label, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/archive?section=${section}&category=${categoryKey}&limit=300`)
      .then((d) => setEntries(d.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [section, categoryKey]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="category-archive-layer" role="dialog" aria-modal="true" aria-labelledby="archive-title">
      <div className="category-archive-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="category-archive-panel">
        <header className="category-archive-header">
          <div>
            <p className="category-archive-badge">Archive permanente</p>
            <h2 id="archive-title">{label}</h2>
            <p className="hint category-archive-sub">
              Historique conservé pour toujours · {entries.length} entrée{entries.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button type="button" className="btn btn-secondary category-archive-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>

        <div className="category-archive-body">
          {loading ? (
            <p className="state-msg">Chargement de l&apos;archive…</p>
          ) : entries.length === 0 ? (
            <p className="state-msg">Aucune entrée dans cette catégorie pour le moment.</p>
          ) : (
            <ul className="category-archive-list">
              {entries.map((entry) => (
                <ArchiveEntry key={entry.id} entry={entry} section={section} />
              ))}
            </ul>
          )}
        </div>

        <footer className="category-archive-footer">
          <p className="hint">Cet historique ne peut pas être supprimé.</p>
        </footer>
      </div>
    </div>
  );
}

function ArchiveEntry({ entry, section }) {
  const actionLabel = ARCHIVE_ACTION_LABELS[entry.action] || entry.action;
  const amount = entry.amount != null && entry.amount !== '' ? Number(entry.amount) : null;
  const status = entry.snapshot?.status;

  return (
    <li className={`archive-entry archive-action-${entry.action}`}>
      <div className="archive-entry-main">
        <div className="archive-entry-head">
          <span className="archive-action-tag">{actionLabel}</span>
          {status && section === 'task' && (
            <span className={`status-badge status-${status}`}>{TASK_STATUS_LABELS[status] || status}</span>
          )}
        </div>
        <strong className="archive-entry-title">{entry.title}</strong>
        {entry.note && <p className="archive-entry-note">{entry.note}</p>}
      </div>
      <div className="archive-entry-meta">
        {amount != null && !Number.isNaN(amount) && amount !== 0 && (
          <span className={amount >= 0 ? 'archive-amount plus' : 'archive-amount minus'}>
            {amount >= 0 ? '+' : ''}{formatMoney(amount)}
          </span>
        )}
        <time className="archive-date">{formatDate(entry.recorded_at)}</time>
      </div>
    </li>
  );
}

function ArchiveCategoryCard({ section, categoryKey, label, count, lastAt, onOpen }) {
  return (
    <button type="button" className="archive-category-card" onClick={() => onOpen({ section, categoryKey, label })}>
      <span className="archive-category-name">{label}</span>
      <span className="archive-category-count">{count} entrée{count !== 1 ? 's' : ''}</span>
      {lastAt && <span className="hint archive-category-last">Dernière : {formatDate(lastAt)}</span>}
      <span className="archive-category-cta">Voir l&apos;archive →</span>
    </button>
  );
}

export function CategoryArchiveHub({ onOpenArchive }) {
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/archive?limit=1')
      .then((d) => setSummary(d.summary || {}))
      .catch(() => setSummary({}))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="state-msg">Chargement des archives…</p>;

  const taskCats = Object.entries(TASK_CATEGORIES);
  const accountCats = Object.entries(ACCOUNT_LABELS);

  return (
    <div className="archive-hub">
      <p className="archive-hub-intro">
        Chaque catégorie possède son propre historique permanent, conservé même si une tâche ou une opération est supprimée.
      </p>

      <section className="archive-hub-section">
        <h3>Catégories de tâches</h3>
        <div className="archive-category-grid">
          {taskCats.map(([key, label]) => {
            const meta = summary[`task:${key}`] || { count: 0 };
            return (
              <ArchiveCategoryCard
                key={key}
                section="task"
                categoryKey={key}
                label={label}
                count={meta.count}
                lastAt={meta.last_at}
                onOpen={onOpenArchive}
              />
            );
          })}
        </div>
      </section>

      <section className="archive-hub-section">
        <h3>Comptes</h3>
        <div className="archive-category-grid">
          {accountCats.map(([key, label]) => {
            const meta = summary[`account:${key}`] || { count: 0 };
            return (
              <ArchiveCategoryCard
                key={key}
                section="account"
                categoryKey={key}
                label={label}
                count={meta.count}
                lastAt={meta.last_at}
                onOpen={onOpenArchive}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function CategoryArchiveChip({ category, label, onOpenArchive }) {
  if (!category || !onOpenArchive) {
    return label ? <span className="category-chip">{label}</span> : null;
  }
  return (
    <button
      type="button"
      className="category-chip category-chip-archive"
      title={`Archive ${label} — historique permanent`}
      onClick={(e) => {
        e.stopPropagation();
        onOpenArchive({ section: 'task', categoryKey: category, label });
      }}
    >
      {label}
      <span className="category-chip-icon" aria-hidden="true">📜</span>
    </button>
  );
}
