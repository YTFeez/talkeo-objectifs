import { formatDue, formatMoney, formatPercent, formatEventAt, ROLE_LABELS, isOverdue } from './api';
import TaskQuickSuggestions from './TaskQuickSuggestions';

function StatCard({ label, value, sub, accent, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`home-stat-card ${accent || ''}`} onClick={onClick}>
      <span className="home-stat-value">{value}</span>
      <span className="home-stat-label">{label}</span>
      {sub && <span className="home-stat-sub">{sub}</span>}
    </Tag>
  );
}

function PreviewItem({ title, meta, badge, onClick, action }) {
  return (
    <div className="home-preview-item">
      <button type="button" className="home-preview-main" onClick={onClick}>
        <span className="home-preview-title">{title}</span>
        {meta && <span className="home-preview-meta">{meta}</span>}
        {badge && <span className="home-preview-badge">{badge}</span>}
      </button>
      {action}
    </div>
  );
}

function taskBadge(todo) {
  if (todo.task_type === 'special' && Number(todo.fixed_bonus) > 0) {
    return `★ ${formatMoney(todo.fixed_bonus)}`;
  }
  if (Number(todo.reward_percent) > 0) {
    return formatPercent(todo.reward_percent);
  }
  return null;
}

export default function HomeView({
  isAdmin,
  isMobile,
  pendingCount,
  eventsCount,
  pocketTotal,
  pendingTodos,
  upcomingEvents,
  onNavigate,
  onToggle,
  canValidate,
  defaultAuthor,
  onQuickAdded,
  onToast,
}) {
  const greeting = isAdmin ? `Salut ${ROLE_LABELS.admin} 👋` : 'Bonjour 👋';
  const topPending = pendingTodos.slice(0, isMobile ? 4 : 5);
  const topEvents = upcomingEvents.slice(0, 3);

  return (
    <div className="home-view">
      <header className="home-hero">
        <h2 className="home-greeting">{greeting}</h2>
        <p className="home-subtitle">
          {isAdmin
            ? 'Voici ton tableau de bord — suis tes gains et ce qu\'il reste à faire.'
            : 'Ajoute des objectifs, valide quand c\'est fait, planifie les événements.'}
        </p>
      </header>

      <div className="home-stats">
        <StatCard
          label="À faire"
          value={pendingCount}
          sub="objectifs en attente"
          accent="stat-pending"
          onClick={() => onNavigate('pending')}
        />
        <StatCard
          label="Agenda"
          value={eventsCount}
          sub="événements à venir"
          accent="stat-events"
          onClick={() => onNavigate('events')}
        />
        {isAdmin ? (
          <StatCard
            label="Ce mois"
            value={formatMoney(pocketTotal)}
            sub="argent de poche"
            accent="stat-pocket"
            onClick={() => onNavigate('pocket')}
          />
        ) : (
          <StatCard
            label="Terminés"
            value="→"
            sub="voir l'historique"
            accent="stat-done"
            onClick={() => onNavigate('done')}
          />
        )}
      </div>

      {!isAdmin && (
        <TaskQuickSuggestions
          defaultAuthor={defaultAuthor}
          onAdded={onQuickAdded}
          onSuccess={onToast}
          compact={isMobile}
          canManage
        />
      )}

      {!isAdmin && (
        <div className="home-quick-actions">
          <button type="button" className="home-action-btn primary" onClick={() => onNavigate('pending')}>
            + Nouvel objectif
          </button>
          <button type="button" className="home-action-btn" onClick={() => onNavigate('events')}>
            + Événement
          </button>
        </div>
      )}

      <section className="home-section">
        <div className="home-section-header">
          <h3>Prochains objectifs</h3>
          {pendingCount > 0 && (
            <button type="button" className="link-btn" onClick={() => onNavigate('pending')}>
              Tout voir
            </button>
          )}
        </div>
        {topPending.length === 0 ? (
          <p className="home-empty">Aucun objectif en attente — {isAdmin ? 'les parents peuvent en ajouter.' : 'ajoute-en un !'}</p>
        ) : (
          <div className="home-preview-list">
            {topPending.map((todo) => (
              <PreviewItem
                key={todo.id}
                title={todo.title}
                meta={[
                  todo.author,
                  todo.due_at ? formatDue(todo.due_at) : null,
                ].filter(Boolean).join(' · ')}
                badge={taskBadge(todo)}
                onClick={() => onNavigate('pending')}
                action={
                  canValidate && (
                    <button
                      type="button"
                      className="home-validate-btn"
                      onClick={() => onToggle(todo)}
                      aria-label={`Valider : ${todo.title}`}
                    >
                      ✓
                    </button>
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="home-section-header">
          <h3>Agenda</h3>
          {eventsCount > 0 && (
            <button type="button" className="link-btn" onClick={() => onNavigate('events')}>
              Tout voir
            </button>
          )}
        </div>
        {topEvents.length === 0 ? (
          <p className="home-empty">Rien de prévu — ajoute un événement familial.</p>
        ) : (
          <div className="home-preview-list">
            {topEvents.map((event) => (
              <PreviewItem
                key={event.id}
                title={event.title}
                meta={`${event.author} · ${formatEventAt(event.event_at)}`}
                onClick={() => onNavigate('events')}
              />
            ))}
          </div>
        )}
      </section>

      {isAdmin && pocketTotal > 0 && (
        <section className="home-section home-pocket-teaser">
          <p className="home-pocket-teaser-label">Tu as gagné ce mois-ci</p>
          <p className="home-pocket-teaser-amount">{formatMoney(pocketTotal)}</p>
          <button type="button" className="btn btn-primary btn-touch" onClick={() => onNavigate('pocket')}>
            Voir le détail
          </button>
        </section>
      )}

      {topPending.some((t) => isOverdue(t.due_at)) && (
        <p className="home-alert">⚠ Des objectifs sont en retard — consulte l&apos;onglet À faire.</p>
      )}
    </div>
  );
}
