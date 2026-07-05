import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  api,
  clearAuth,
  formatDay,
  formatDue,
  DURATION_HINTS,
  getStoredAuth,
  saveAuthor,
  ROLE_LABELS,
} from './api';
import SettingsModal from './SettingsModal';
import { TodoTable, TodoMobileList } from './TodoItems';
import { useIsMobile } from './useMediaQuery';

function ObjectiveFields({ values, onChange, compact }) {
  return (
    <div className={`objective-fields ${compact ? 'compact' : ''}`}>
      <label className="field-inline">
        De
        <select value={values.author} onChange={(e) => onChange('author', e.target.value)}>
          <option>Maman</option>
          <option>Papa</option>
          <option>Parent</option>
        </select>
      </label>
      <label className="field-inline">
        Priorité
        <select value={values.priority} onChange={(e) => onChange('priority', e.target.value)}>
          <option value="high">Haute</option>
          <option value="normal">Normale</option>
          <option value="low">Basse</option>
        </select>
      </label>
      <label className="field-inline">
        Durée
        <select value={values.duration} onChange={(e) => onChange('duration', e.target.value)}>
          <option value="short">Faible ({DURATION_HINTS.short})</option>
          <option value="normal">Normale ({DURATION_HINTS.normal})</option>
          <option value="long">Longue ({DURATION_HINTS.long})</option>
        </select>
      </label>
      <label className="field-inline field-due">
        Échéance
        <input
          type="datetime-local"
          value={values.due_at}
          onChange={(e) => onChange('due_at', e.target.value)}
        />
      </label>
    </div>
  );
}

function AddForm({ defaultAuthor, onAdded, isMobile }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState({
    author: defaultAuthor,
    priority: 'normal',
    duration: 'normal',
    due_at: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(isMobile);
  const inputRef = useRef(null);

  function updateField(key, val) {
    setFields((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api('/todos', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          ...fields,
          due_at: fields.due_at || null,
        }),
      });
      saveAuthor(fields.author);
      setTitle('');
      setDescription('');
      setFields((f) => ({ ...f, due_at: '' }));
      if (!isMobile) setOpen(false);
      onAdded();
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`add-form-section ${isMobile ? 'add-form-mobile' : ''}`}>
      <h3>Nouvel objectif</h3>
      <form className="add-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="input-touch"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Ranger la chambre, finir les devoirs…"
          onFocus={() => setOpen(true)}
          required
        />
        {(open || isMobile) && (
          <textarea
            className="input-touch"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Détails (optionnel)"
            rows={2}
          />
        )}
        {(open || isMobile) && <ObjectiveFields values={fields} onChange={updateField} />}
        <div className="add-row">
          {!open && !isMobile && (
            <ObjectiveFields values={fields} onChange={updateField} compact />
          )}
          <button type="submit" className="btn btn-primary btn-touch add-submit" disabled={loading || !title.trim()}>
            {loading ? 'Ajout…' : '+ Ajouter'}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </section>
  );
}

function HistoryDay({ day }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="history-day">
      <button type="button" className="history-day-header" onClick={() => setOpen(!open)}>
        <span className="history-date">{formatDay(day.date)}</span>
        <span className="history-stats">
          +{day.added_count} ajouté{day.added_count !== 1 ? 's' : ''}
          {day.completed_count > 0 && ` · ${day.completed_count} terminé${day.completed_count !== 1 ? 's' : ''}`}
        </span>
        <span className="history-chevron" aria-hidden>{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="history-body">
          {day.added.length > 0 && (
            <div className="history-block">
              <h4>Ajoutés ce jour</h4>
              <ul>
                {day.added.map((t) => (
                  <li key={`a-${t.id}`}>
                    <strong>{t.title}</strong>
                    <span className="history-item-meta">
                      {t.author}
                      {t.due_at && ` · ${formatDue(t.due_at)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {day.completed.length > 0 && (
            <div className="history-block">
              <h4>Terminés ce jour</h4>
              <ul>
                {day.completed.map((t) => (
                  <li key={`c-${t.id}`}>
                    <strong>{t.title}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {day.added.length === 0 && day.completed.length === 0 && (
            <p className="history-empty">Aucune activité enregistrée.</p>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryView() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/todos/history?days=30')
      .then(({ history: h }) => setHistory(h))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="state-msg">Chargement de l&apos;historique…</p>;
  if (history.length === 0) return <p className="state-msg">Aucun historique pour le moment.</p>;

  return (
    <div className="history-list">
      {history.map((day) => (
        <HistoryDay key={day.date} day={day} />
      ))}
    </div>
  );
}

const TAB_ICONS = {
  pending: '○',
  done: '✓',
  history: '◷',
  all: '≡',
};

const TAB_SHORT = {
  pending: 'Attente',
  done: 'Fait',
  history: 'Journal',
  all: 'Tous',
};

export default function Dashboard({ auth, onLogout }) {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [todos, setTodos] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const isAdmin = auth.role === 'admin';
  const defaultAuthor = getStoredAuth().author;
  const displayName = isAdmin ? ROLE_LABELS.admin : auth.label;

  const loadTodos = useCallback(async () => {
    if (filter === 'history') return;
    setLoading(true);
    try {
      const status = filter === 'all' ? '' : `?status=${filter}`;
      const { todos: list } = await api(`/todos${status}`);
      setTodos(list);
      const { todos: pending } = await api('/todos?status=pending');
      setPendingCount(pending.length);
    } catch {
      clearAuth();
      onLogout();
    } finally {
      setLoading(false);
    }
  }, [filter, onLogout]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    if (!accountOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [accountOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return todos;
    return todos.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.author.toLowerCase().includes(q),
    );
  }, [todos, search]);

  async function handleToggle(todo) {
    await api(`/todos/${todo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: todo.status === 'done' ? 'pending' : 'done' }),
    });
    loadTodos();
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cet objectif ?')) return;
    await api(`/todos/${id}`, { method: 'DELETE' });
    loadTodos();
  }

  async function handleEdit(id, data) {
    await api(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    loadTodos();
  }

  const tabs = [
    { id: 'pending', label: 'En attente', count: pendingCount },
    { id: 'done', label: 'Terminés' },
    { id: 'history', label: 'Historique' },
    ...(isAdmin ? [{ id: 'all', label: 'Tous' }] : []),
  ];

  const filterTitle = {
    pending: 'À faire',
    done: 'Terminés',
    history: 'Historique',
    all: 'Tous les objectifs',
  }[filter];

  const todoListProps = {
    todos: filtered,
    isAdmin,
    onToggle: handleToggle,
    onDelete: handleDelete,
    onEdit: handleEdit,
    ObjectiveFields,
  };

  return (
    <div className={`app app-dashboard ${isMobile ? 'is-mobile' : 'is-desktop'}`}>
      {isMobile && (
        <header className="mobile-top-bar">
          <div className="mobile-top-main">
            <h1>Talkeo</h1>
            <p className="mobile-top-meta">
              {pendingCount} en attente · {isAdmin ? ROLE_LABELS.admin : 'Parents'}
            </p>
          </div>
          <button
            type="button"
            className="mobile-account-btn"
            onClick={() => setAccountOpen(true)}
            aria-label="Compte et réglages"
          >
            <span className="mobile-account-avatar">{displayName.charAt(0)}</span>
          </button>
        </header>
      )}

      {isMobile && filter !== 'history' && (
        <div className="mobile-search-bar">
          <input
            type="search"
            className="global-search-input input-touch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
          />
        </div>
      )}

      <header className="app-header desktop-only">
        <h1>Talkeo</h1>
        {filter !== 'history' && (
          <div className="global-search">
            <input
              type="search"
              className="global-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un objectif…"
            />
          </div>
        )}
        <div className="file-bar">
          <span className="user-pill">{displayName}</span>
          <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(true)}>
            Mot de passe
          </button>
          <button type="button" className="btn btn-secondary" onClick={onLogout}>
            Quitter
          </button>
        </div>
        <span className="meta">
          {pendingCount} en attente · {isAdmin ? `Espace ${ROLE_LABELS.admin}` : 'Espace parents'}
        </span>
      </header>

      <div className="layout">
        <div className="card sidebar-card desktop-only">
          <div className="card-header">Navigation</div>
          <div className="card-body">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`list-item-btn ${filter === tab.id ? 'active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                <span className="name">
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className="tab-count">{tab.count}</span>
                  )}
                </span>
                {tab.id === 'pending' && <span className="sub">Objectifs à réaliser</span>}
                {tab.id === 'done' && <span className="sub">Déjà terminés</span>}
                {tab.id === 'history' && <span className="sub">Journal des 30 derniers jours</span>}
                {tab.id === 'all' && <span className="sub">Vue complète admin</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="card main-card">
          <div className="card-header">
            <span>{filterTitle}</span>
            {filter !== 'history' && !loading && (
              <span className="hint">{filtered.length} objectif{filtered.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="card-body main-card-body">
            {!isAdmin && filter === 'pending' && (
              <AddForm defaultAuthor={defaultAuthor} onAdded={loadTodos} isMobile={isMobile} />
            )}

            {isAdmin && filter === 'pending' && pendingCount > 0 && (
              <p className="admin-banner">
                {pendingCount} objectif{pendingCount > 1 ? 's' : ''} en attente — triés par échéance et priorité.
              </p>
            )}

            {filter === 'history' ? (
              <HistoryView />
            ) : (
              <>
                {loading && <p className="state-msg">Chargement…</p>}
                {!loading && filtered.length === 0 && (
                  <p className="empty">
                    {search
                      ? 'Aucun résultat pour cette recherche.'
                      : filter === 'pending'
                        ? 'Aucun objectif en attente.'
                        : 'Rien à afficher ici.'}
                  </p>
                )}
                {!loading && filtered.length > 0 && (
                  isMobile ? (
                    <TodoMobileList {...todoListProps} />
                  ) : (
                    <TodoTable {...todoListProps} />
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {isMobile && (
        <nav className="mobile-tab-bar" aria-label="Navigation principale">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`mobile-tab ${filter === tab.id ? 'active' : ''}`}
              onClick={() => setFilter(tab.id)}
              aria-current={filter === tab.id ? 'page' : undefined}
            >
              <span className="mobile-tab-icon" aria-hidden>{TAB_ICONS[tab.id]}</span>
              <span className="mobile-tab-label">{TAB_SHORT[tab.id] || tab.label}</span>
              {tab.count != null && tab.count > 0 && (
                <span className="mobile-tab-badge">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>
      )}

      {accountOpen && (
        <div className="mobile-sheet-overlay" onClick={() => setAccountOpen(false)}>
          <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-handle" aria-hidden />
            <div className="mobile-sheet-header">
              <span className="mobile-sheet-user">{displayName}</span>
              <span className="hint">{isAdmin ? 'Administrateur' : 'Parent'}</span>
            </div>
            <button
              type="button"
              className="mobile-sheet-action"
              onClick={() => {
                setAccountOpen(false);
                setShowSettings(true);
              }}
            >
              Changer le mot de passe
            </button>
            <button
              type="button"
              className="mobile-sheet-action danger"
              onClick={() => {
                setAccountOpen(false);
                onLogout();
              }}
            >
              Se déconnecter
            </button>
            <button type="button" className="btn btn-secondary btn-touch mobile-sheet-close" onClick={() => setAccountOpen(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
