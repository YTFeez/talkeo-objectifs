import { useState, useEffect } from 'react';
import { api, formatMoney, formatDate } from './api';

export default function PocketView({ isMobile }) {
  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/rewards/summary')
      .then((data) => {
        setSummary(data);
        setSelectedMonth(data.current.month);
        setDetail(data.current);
      })
      .catch(() => {
        setSummary(null);
        setDetail(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function selectMonth(month) {
    setSelectedMonth(month);
    setLoading(true);
    try {
      const data = await api(`/rewards?month=${month}`);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !detail) {
    return <p className="state-msg">Chargement de l&apos;argent de poche…</p>;
  }

  if (!summary || !detail) {
    return <p className="state-msg">Impossible de charger les rémunérations.</p>;
  }

  const isCurrent = selectedMonth === summary.current.month;

  return (
    <div className="pocket-view">
      <div className={`pocket-hero ${isCurrent ? 'current' : ''}`}>
        <p className="pocket-hero-label">{isCurrent ? 'Ce mois-ci' : detail.label}</p>
        <p className="pocket-hero-amount">{formatMoney(detail.total)}</p>
        <p className="pocket-hero-meta">
          {detail.task_count} tâche{detail.task_count !== 1 ? 's' : ''} rémunérée{detail.task_count !== 1 ? 's' : ''}
          {isCurrent && ' · recompte le 1er de chaque mois'}
        </p>
      </div>

      {summary.months.length > 1 && (
        <div className="pocket-months">
          <p className="pocket-section-title">Mois précédents</p>
          <div className="pocket-month-list">
            {summary.months.map((m) => (
              <button
                key={m.month}
                type="button"
                className={`pocket-month-btn ${selectedMonth === m.month ? 'active' : ''}`}
                onClick={() => selectMonth(m.month)}
              >
                <span className="pocket-month-name">
                  {m.label}
                  {m.is_current && <span className="pocket-current-tag">en cours</span>}
                </span>
                <span className="pocket-month-total">{formatMoney(m.total)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pocket-tasks">
        <p className="pocket-section-title">Détail des tâches</p>
        {detail.tasks.length === 0 ? (
          <p className="empty">Aucune tâche rémunérée pour ce mois.</p>
        ) : isMobile ? (
          <div className="pocket-mobile-list">
            {detail.tasks.map((task) => (
              <article key={task.id} className="pocket-mobile-card">
                <div className="pocket-mobile-main">
                  <h4 className="todo-title">{task.title}</h4>
                  <p className="hint">{task.author} · {formatDate(task.completed_at)}</p>
                </div>
                <span className="pocket-mobile-gain">{formatMoney(task.reward)}</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="table-wrap pocket-table">
            <table>
              <thead>
                <tr>
                  <th>Tâche</th>
                  <th>Terminée</th>
                  <th className="col-reward">Gain</th>
                </tr>
              </thead>
              <tbody>
                {detail.tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <span className="todo-title">{task.title}</span>
                      <span className="hint pocket-task-author">{task.author}</span>
                    </td>
                    <td className="hint">{formatDate(task.completed_at)}</td>
                    <td className="col-reward reward-cell">{formatMoney(task.reward)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
