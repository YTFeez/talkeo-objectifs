import { useState, useEffect, useCallback } from 'react';
import { api, formatMoney, formatDate, formatPercent } from './api';

function EconomyBreakdown({ economy }) {
  return (
    <div className="wallet-breakdown">
      <div className="wallet-row">
        <span>Base mensuelle</span>
        <strong>{formatMoney(economy.monthly_base)}</strong>
      </div>
      <div className="wallet-row earned">
        <span>Tâches faites (%)</span>
        <strong>+{formatMoney(economy.normal_earned)}</strong>
      </div>
      <div className="wallet-row bonus">
        <span>Tâches spéciales</span>
        <strong>+{formatMoney(economy.special_bonus)}</strong>
      </div>
      <div className="wallet-row strike">
        <span>Bonus strike ({economy.current_strike}🔥)</span>
        <strong>+{formatMoney(economy.strike_bonus)}</strong>
      </div>
      {economy.pending_at_risk > 0 && (
        <div className="wallet-row risk">
          <span>Encore en jeu si non fait</span>
          <strong>-{formatMoney(economy.pending_at_risk)}</strong>
        </div>
      )}
      <div className="wallet-row total">
        <span>Total projeté ce mois</span>
        <strong>{formatMoney(economy.projected_total)}</strong>
      </div>
    </div>
  );
}

function XpPanel({ profile, isAdmin, onRefresh }) {
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDesc, setIdeaDesc] = useState('');
  const [requests, setRequests] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadRequests = useCallback(() => {
    api('/reward-requests').then((d) => setRequests(d.requests)).catch(() => setRequests([]));
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function submitIdea(e) {
    e.preventDefault();
    if (!ideaTitle.trim()) return;
    setSaving(true);
    try {
      await api('/reward-requests', {
        method: 'POST',
        body: JSON.stringify({ title: ideaTitle, description: ideaDesc }),
      });
      setIdeaTitle('');
      setIdeaDesc('');
      loadRequests();
      onRefresh?.();
    } finally {
      setSaving(false);
    }
  }

  async function resolve(id, status) {
    const response = status === 'accepted' ? 'Accepté !' : 'Refusé';
    await api(`/reward-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, parent_response: response }),
    });
    loadRequests();
  }

  return (
    <section className="wallet-section">
      <h3 className="wallet-section-title">Niveau {profile.level}</h3>
      <div className="xp-bar-wrap">
        <div className="xp-bar" style={{ width: `${profile.xp_progress.percent}%` }} />
      </div>
      <p className="hint xp-meta">
        {profile.xp_progress.current} / {profile.xp_progress.max} XP
        · récompense tous les {profile.reward_level_interval} niveaux (prochain : niv. {profile.next_reward_level})
      </p>

      {isAdmin && (
        <form className="reward-idea-form" onSubmit={submitIdea}>
          <p className="hint">Proposer une idée de récompense aux parents :</p>
          <input
            className="input-touch"
            value={ideaTitle}
            onChange={(e) => setIdeaTitle(e.target.value)}
            placeholder="Ex : Sortie cinéma, nouveau jeu…"
            required
          />
          <textarea
            className="input-touch"
            value={ideaDesc}
            onChange={(e) => setIdeaDesc(e.target.value)}
            placeholder="Détails (optionnel)"
            rows={2}
          />
          <button type="submit" className="btn btn-primary btn-touch" disabled={saving}>
            {saving ? '…' : 'Envoyer l\'idée'}
          </button>
        </form>
      )}

      {requests.length > 0 && (
        <div className="reward-requests-list">
          <p className="wallet-section-sub">Idées de récompenses</p>
          {requests.map((r) => (
            <article key={r.id} className={`reward-request-card status-${r.status}`}>
              <strong>{r.title}</strong>
              {r.description && <p className="hint">{r.description}</p>}
              <p className="hint">Niveau {r.level_at_request} · {r.status === 'pending' ? 'En attente' : r.parent_response}</p>
              {!isAdmin && r.status === 'pending' && (
                <div className="reward-request-actions">
                  <button type="button" className="btn btn-secondary btn-touch" onClick={() => resolve(r.id, 'accepted')}>Accepter</button>
                  <button type="button" className="btn btn-secondary btn-touch danger" onClick={() => resolve(r.id, 'rejected')}>Refuser</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SavingsPanel({ profile, isAdmin, onRefresh }) {
  const [rate, setRate] = useState(profile.savings_rate_percent);
  const [amount, setAmount] = useState('');
  const [withdraw, setWithdraw] = useState('');

  async function saveRate(e) {
    e.preventDefault();
    await api('/wallet/savings-rate', { method: 'POST', body: JSON.stringify({ rate: Number(rate) }) });
    onRefresh?.();
  }

  async function toSavings(e) {
    e.preventDefault();
    await api('/wallet/to-savings', { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) });
    setAmount('');
    onRefresh?.();
  }

  async function requestWithdraw(e) {
    e.preventDefault();
    await api('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount: Number(withdraw) }) });
    setWithdraw('');
    onRefresh?.();
  }

  return (
    <section className="wallet-section">
      <h3 className="wallet-section-title">Épargne & compte</h3>
      <div className="wallet-balances">
        <div className="wallet-balance-card">
          <span className="label">Compte courant</span>
          <span className="amount">{formatMoney(profile.current_balance)}</span>
        </div>
        <div className="wallet-balance-card savings">
          <span className="label">Épargne</span>
          <span className="amount">{formatMoney(profile.savings_balance)}</span>
        </div>
      </div>

      {isAdmin && (
        <>
          <form className="wallet-action-form" onSubmit={saveRate}>
            <label className="field-label">
              Mettre en épargne chaque mois (% des gains)
              <input type="number" className="input-touch" min="0" max="100" value={rate} onChange={(e) => setRate(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-secondary btn-touch">Enregistrer</button>
          </form>
          <form className="wallet-action-form" onSubmit={toSavings}>
            <label className="field-label">
              Transférer vers l&apos;épargne (€)
              <input type="number" className="input-touch" min="0" step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-secondary btn-touch">Épargner</button>
          </form>
          <form className="wallet-action-form" onSubmit={requestWithdraw}>
            <label className="field-label">
              Demander un retrait (€)
              <input type="number" className="input-touch" min="0" step="0.5" value={withdraw} onChange={(e) => setWithdraw(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary btn-touch">Demander le retrait</button>
          </form>
        </>
      )}
    </section>
  );
}

export default function PocketView({ isMobile, isAdmin }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(isAdmin ? 'money' : 'xp');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const url = isAdmin ? '/rewards/summary' : '/wallet/summary';
    api(url)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return <p className="state-msg">Chargement…</p>;
  }

  if (!data) {
    return <p className="state-msg">Impossible de charger le portefeuille.</p>;
  }

  const profile = data.wallet?.profile || data.profile;
  const economy = data.wallet?.economy || data.current?.economy || data.economy;

  if (!profile || !economy) {
    return <p className="state-msg">Données indisponibles.</p>;
  }

  const tabs = isAdmin
    ? [
        { id: 'money', label: 'Argent' },
        { id: 'xp', label: 'XP & récompenses' },
        { id: 'savings', label: 'Épargne' },
      ]
    : [{ id: 'xp', label: 'Idées de récompenses' }];

  return (
    <div className="wallet-view">
      <div className="wallet-hero">
        {isAdmin ? (
          <>
            <p className="wallet-hero-label">Ce mois-ci · base {formatMoney(economy.monthly_base)}</p>
            <p className="wallet-hero-amount">{formatMoney(economy.projected_total)}</p>
            <p className="wallet-hero-meta">
              Strike {profile.current_strike}🔥 · Niveau {profile.level} · max possible {formatMoney(economy.max_if_all_done)}
            </p>
          </>
        ) : (
          <>
            <p className="wallet-hero-label">Progression d&apos;Aronne</p>
            <p className="wallet-hero-amount">Niveau {profile.level}</p>
            <p className="wallet-hero-meta">
              {profile.xp_progress.current} / {profile.xp_progress.max} XP
              · strike {profile.current_strike}🔥
            </p>
          </>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="wallet-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className={`wallet-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isAdmin && tab === 'money' && (
        <>
          <EconomyBreakdown economy={economy} />
          {economy.pending_tasks.length > 0 && (
            <section className="wallet-section">
              <p className="wallet-section-title">Tâches en cours (non faites = argent perdu)</p>
              <div className={isMobile ? 'pocket-mobile-list' : 'table-wrap pocket-table'}>
                {isMobile ? (
                  economy.pending_tasks.map((t) => (
                    <article key={t.id} className="pocket-mobile-card risk-card">
                      <div className="pocket-mobile-main">
                        <h4>{t.title}</h4>
                        <p className="hint">{formatPercent(t.reward_percent)} · risque {formatMoney(t.amount_at_risk)}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <table>
                    <thead>
                      <tr><th>Tâche</th><th>%</th><th>À perdre</th></tr>
                    </thead>
                    <tbody>
                      {economy.pending_tasks.map((t) => (
                        <tr key={t.id}>
                          <td>{t.title}</td>
                          <td>{formatPercent(t.reward_percent)}</td>
                          <td className="risk-text">-{formatMoney(t.amount_at_risk)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}
          {economy.completed_tasks.length > 0 && (
            <section className="wallet-section">
              <p className="wallet-section-title">Tâches terminées</p>
              <div className="pocket-mobile-list">
                {economy.completed_tasks.map((t) => (
                  <article key={`${t.id}-${t.completed_at}`} className="pocket-mobile-card">
                    <div className="pocket-mobile-main">
                      <h4>{t.title} {t.type === 'special' && <span className="special-tag">★</span>}</h4>
                      <p className="hint">{t.completed_at && formatDate(t.completed_at)}</p>
                    </div>
                    <span className="pocket-mobile-gain">+{formatMoney(t.amount)}</span>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === 'xp' && <XpPanel profile={profile} isAdmin={isAdmin} onRefresh={load} />}
      {isAdmin && tab === 'savings' && <SavingsPanel profile={profile} isAdmin={isAdmin} onRefresh={load} />}
    </div>
  );
}
