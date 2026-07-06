import { useState, useEffect, useCallback } from 'react';
import { api, formatMoney, formatDate, formatPercent, ACCOUNT_LABELS } from './api';

function AccountsOverview({ profile, economy }) {
  return (
    <div className="accounts-overview">
      <div className="account-card allocation">
        <span className="label">{ACCOUNT_LABELS.monthly_allocation}</span>
        <span className="amount">{formatMoney(economy.monthly_base)}</span>
        <p className="hint">Budget mensuel · recompte le 1er</p>
      </div>
      <div className="account-card">
        <span className="label">{ACCOUNT_LABELS.current_account}</span>
        <span className="amount">{formatMoney(profile.current_balance)}</span>
        <p className="hint">Disponible tout de suite</p>
      </div>
      <div className="account-card savings">
        <span className="label">{ACCOUNT_LABELS.savings}</span>
        <span className="amount">{formatMoney(profile.savings_balance)}</span>
        <p className="hint">Mis de côté pour plus tard</p>
      </div>
      <div className="account-card total-earned">
        <span className="label">{ACCOUNT_LABELS.total_earned}</span>
        <span className="amount">{formatMoney(profile.total_earned)}</span>
        <p className="hint">Tâches, bonus, allocations…</p>
      </div>
      <div className="account-card goals">
        <span className="label">{ACCOUNT_LABELS.goals}</span>
        <span className="amount">{formatMoney(profile.goals_reserved)}</span>
        <p className="hint">Réservé pour un achat précis</p>
      </div>
    </div>
  );
}

function EconomyBreakdown({ economy }) {
  return (
    <div className="wallet-breakdown">
      <div className="wallet-row">
        <span>{ACCOUNT_LABELS.monthly_allocation}</span>
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
        <span>Gains prévus ce mois</span>
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
      <h3 className="wallet-section-title">Comptes</h3>
      <div className="wallet-balances">
        <div className="wallet-balance-card">
          <span className="label">{ACCOUNT_LABELS.current_account}</span>
          <span className="amount">{formatMoney(profile.current_balance)}</span>
        </div>
        <div className="wallet-balance-card savings">
          <span className="label">{ACCOUNT_LABELS.savings}</span>
          <span className="amount">{formatMoney(profile.savings_balance)}</span>
        </div>
        <div className="wallet-balance-card total-earned">
          <span className="label">{ACCOUNT_LABELS.total_earned}</span>
          <span className="amount">{formatMoney(profile.total_earned)}</span>
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
              Verser vers l&apos;{ACCOUNT_LABELS.savings.toLowerCase()} (depuis le compte courant)
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

function GoalsPanel({ goals, isAdmin, onRefresh }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [fundAmount, setFundAmount] = useState({});

  async function createGoal(e) {
    e.preventDefault();
    await api('/goals', { method: 'POST', body: JSON.stringify({ title, target_amount: Number(target) }) });
    setTitle('');
    setTarget('');
    onRefresh?.();
  }

  async function fundGoal(id) {
    const amount = Number(fundAmount[id]);
    if (!amount) return;
    await api(`/goals/${id}/fund`, { method: 'POST', body: JSON.stringify({ amount }) });
    setFundAmount((f) => ({ ...f, [id]: '' }));
    onRefresh?.();
  }

  return (
    <section className="wallet-section">
      <h3 className="wallet-section-title">{ACCOUNT_LABELS.goals}</h3>
      {isAdmin && (
        <form className="wallet-action-form" onSubmit={createGoal}>
          <input className="input-touch" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Réplique airsoft" required />
          <input className="input-touch" type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Montant cible €" required />
          <button type="submit" className="btn btn-primary btn-touch">Créer un objectif</button>
        </form>
      )}
      {goals.length === 0 ? (
        <p className="hint">Aucun objectif pour l&apos;instant — réserve de l&apos;argent pour un achat précis.</p>
      ) : (
        <div className="goals-list">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
            return (
              <article key={g.id} className={`goal-card ${g.status === 'completed' ? 'completed' : ''}`}>
                <div className="goal-header">
                  <strong>{g.title}</strong>
                  <span>{formatMoney(g.saved_amount)} / {formatMoney(g.target_amount)}</span>
                </div>
                <div className="xp-bar-wrap goal-bar">
                  <div className="xp-bar" style={{ width: `${pct}%` }} />
                </div>
                {isAdmin && g.status === 'active' && (
                  <div className="goal-fund-row">
                    <input
                      type="number"
                      className="input-touch"
                      min="0"
                      step="0.5"
                      placeholder="Montant €"
                      value={fundAmount[g.id] || ''}
                      onChange={(e) => setFundAmount((f) => ({ ...f, [g.id]: e.target.value }))}
                    />
                    <button type="button" className="btn btn-secondary btn-touch" onClick={() => fundGoal(g.id)}>Verser depuis le compte courant</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function BadgesPanel() {
  const [badges, setBadges] = useState([]);
  useEffect(() => {
    api('/achievements').then((d) => setBadges(d.achievements || [])).catch(() => setBadges([]));
  }, []);
  return (
    <section className="wallet-section">
      <h3 className="wallet-section-title">Badges</h3>
      <div className="badges-grid">
        {badges.map((b) => (
          <article key={b.code} className={`badge-card ${b.unlocked ? 'unlocked' : 'locked'}`}>
            <span className="badge-icon">{b.icon}</span>
            <strong>{b.title}</strong>
            <p className="hint">{b.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HistoryPanel() {
  const [txs, setTxs] = useState([]);
  useEffect(() => {
    api('/wallet/transactions').then((d) => setTxs(d.transactions || [])).catch(() => setTxs([]));
  }, []);
  const typeLabels = {
    task_reward: 'Tâche validée',
    bonus: 'Bonus',
    penalty: 'Pénalité',
    to_savings: ACCOUNT_LABELS.savings,
    to_goal: ACCOUNT_LABELS.goals,
    withdrawal_request: 'Retrait demandé',
    xp_penalty: 'XP retiré',
    monthly_credit: ACCOUNT_LABELS.monthly_allocation,
  };
  return (
    <section className="wallet-section">
      <h3 className="wallet-section-title">Historique</h3>
      {txs.length === 0 ? (
        <p className="hint">Aucune opération enregistrée.</p>
      ) : (
        <ul className="tx-history-list">
          {txs.map((t) => (
            <li key={t.id} className={t.amount >= 0 ? 'tx-plus' : 'tx-minus'}>
              <div>
                <strong>{typeLabels[t.type] || t.type}</strong>
                <p className="hint">{t.note} · {formatDate(t.created_at)}</p>
              </div>
              <span>{t.type === 'xp_penalty' ? `${t.amount} XP` : formatMoney(Math.abs(t.amount))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ParentTools({ onRefresh }) {
  const [bonusAmt, setBonusAmt] = useState('');
  const [bonusNote, setBonusNote] = useState('');
  const [penAmt, setPenAmt] = useState('');
  const [penXp, setPenXp] = useState('');
  const [penNote, setPenNote] = useState('');

  async function giveBonus(e) {
    e.preventDefault();
    await api('/wallet/bonus', { method: 'POST', body: JSON.stringify({ amount: Number(bonusAmt), note: bonusNote || 'Bonus' }) });
    setBonusAmt('');
    setBonusNote('');
    onRefresh?.();
  }

  async function givePenalty(e) {
    e.preventDefault();
    await api('/wallet/penalty', { method: 'POST', body: JSON.stringify({ amount: Number(penAmt) || 0, xp: Number(penXp) || 0, note: penNote || 'Pénalité' }) });
    setPenAmt('');
    setPenXp('');
    setPenNote('');
    onRefresh?.();
  }

  return (
    <section className="wallet-section">
      <h3 className="wallet-section-title">Bonus & pénalités</h3>
      <form className="wallet-action-form" onSubmit={giveBonus}>
        <p className="hint">Attribuer un bonus manuel</p>
        <input className="input-touch" type="number" min="0" step="0.5" value={bonusAmt} onChange={(e) => setBonusAmt(e.target.value)} placeholder="Montant €" required />
        <input className="input-touch" value={bonusNote} onChange={(e) => setBonusNote(e.target.value)} placeholder="Commentaire" />
        <button type="submit" className="btn btn-primary btn-touch">Donner le bonus</button>
      </form>
      <form className="wallet-action-form" onSubmit={givePenalty}>
        <p className="hint">Appliquer une pénalité</p>
        <input className="input-touch" type="number" min="0" step="0.5" value={penAmt} onChange={(e) => setPenAmt(e.target.value)} placeholder="Retrait €" />
        <input className="input-touch" type="number" min="0" value={penXp} onChange={(e) => setPenXp(e.target.value)} placeholder="Retrait XP" />
        <input className="input-touch" value={penNote} onChange={(e) => setPenNote(e.target.value)} placeholder="Commentaire" />
        <button type="submit" className="btn btn-secondary btn-touch danger">Appliquer</button>
      </form>
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
  const goals = data.goals || [];

  if (!profile || !economy) {
    return <p className="state-msg">Données indisponibles.</p>;
  }

  const tabs = isAdmin
    ? [
        { id: 'money', label: 'Argent' },
        { id: 'xp', label: 'XP' },
        { id: 'savings', label: ACCOUNT_LABELS.savings },
        { id: 'goals', label: 'Objectifs' },
        { id: 'badges', label: 'Badges' },
        { id: 'history', label: 'Historique' },
      ]
    : [
        { id: 'xp', label: 'Récompenses' },
        { id: 'tools', label: 'Bonus' },
      ];

  return (
    <div className="wallet-view">
      <div className="wallet-hero">
        {isAdmin ? (
          <>
            <p className="wallet-hero-label">{ACCOUNT_LABELS.monthly_allocation} · {formatMoney(economy.monthly_base)}</p>
            <p className="wallet-hero-amount">{formatMoney(profile.current_balance)}</p>
            <p className="wallet-hero-meta">
              {ACCOUNT_LABELS.current_account} · {ACCOUNT_LABELS.total_earned} {formatMoney(profile.total_earned)}
              · Strike {profile.current_strike}🔥
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

      {isAdmin && <AccountsOverview profile={profile} economy={economy} />}

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
      {tab === 'goals' && isAdmin && <GoalsPanel goals={goals} isAdmin={isAdmin} onRefresh={load} />}
      {tab === 'badges' && isAdmin && <BadgesPanel />}
      {tab === 'history' && isAdmin && <HistoryPanel />}
      {!isAdmin && tab === 'tools' && <ParentTools onRefresh={load} />}
    </div>
  );
}
