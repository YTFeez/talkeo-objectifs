import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  api,
  clearAuth,
  formatDate,
  formatDay,
  formatDue,
  isOverdue,
  toDatetimeLocal,
  PRIORITY_LABELS,
  DURATION_LABELS,
  DURATION_HINTS,
  getStoredAuth,
  saveAuthor,
  ROLE_LABELS,
} from './api';
import SettingsModal from './SettingsModal';

function Badge({ type, value }) {
  return <span className={`badge badge-${type}-${value}`}>{type === 'priority' ? PRIORITY_LABELS[value] : DURATION_LABELS[value]}</span>;
}

function TodoMeta({ todo }) {
  return (
    <div className="card-badges">
      <Badge type="priority" value={todo.priority || 'normal'} />
      <Badge type="duration" value={todo.duration || 'normal'} />
      {todo.due_at && (
        <span className={`due-badge ${isOverdue(todo.due_at) && todo.status === 'pending' ? 'overdue' : ''}`}>
          ⏰ {formatDue(todo.due_at)}
        </span>
      )}
    </div>
  );
}

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

function AddForm({ defaultAuthor, onAdded }) {
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
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      onAdded();
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="add-form-section">
      <h3>Nouvel objectif</h3>
      <form className="add-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Ranger la chambre, finir les devoirs…"
          onFocus={() => setOpen(true)}
          required
        />
        {open && (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Détails (optionnel)"
            rows={2}
          />
        )}
        {open && <ObjectiveFields values={fields} onChange={updateField} />}
        <div className="add-row">
          {!open && (
            <ObjectiveFields values={fields} onChange={updateField} compact />
          )}
          <button type="submit" className="btn btn-primary" disabled={loading || !title.trim()}>
            {loading ? 'Ajout…' : '+ Ajouter'}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </form>
    </section>
  );
}

function TodoCard({ todo, isAdmin, onToggle, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description || '');
  const [fields, setFields] = useState({
    author: todo.author,
    priority: todo.priority || 'normal',
    duration: todo.duration || 'normal',
    due_at: toDatetimeLocal(todo.due_at),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onEdit(todo.id, {
        title,
        description,
        ...fields,
        due_at: fields.due_at || null,
      });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <article className={`todo-card editing priority-${todo.priority}`}>
        <form onSubmit={saveEdit} className="edit-form">
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Détails"
            rows={2}
          />
          <ObjectiveFields
            values={fields}
            onChange={(k, v) => setFields((f) => ({ ...f, [k]: v }))}
          />
          {error && <p className="form-error">{error}</p>}
          <div className="card-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </article>
    );
  }

  return (
    <article className={`todo-card priority-${todo.priority} ${todo.status === 'done' ? 'done' : ''} ${isOverdue(todo.due_at) && todo.status === 'pending' ? 'overdue-card' : ''}`}>
      <div className="card-main">
        {isAdmin && (
          <button
            type="button"
            className={`check-btn ${todo.status === 'done' ? 'checked' : ''}`}
            onClick={() => onToggle(todo)}
            aria-label={todo.status === 'done' ? 'Remettre en attente' : 'Terminer'}
          />
        )}
        <div className="card-body">
          <div className="card-top">
            <h3>{todo.title}</h3>
          </div>
          <TodoMeta todo={todo} />
          {todo.description && <p className="card-desc">{todo.description}</p>}
          <div className="card-meta">
            <span>{todo.author}</span>
            <span>·</span>
            <span>Ajouté {formatDate(todo.created_at)}</span>
            {todo.status === 'done' && todo.completed_at && (
              <>
                <span>·</span>
                <span className="meta-done">Fait {formatDate(todo.completed_at)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      {(isAdmin || todo.can_edit) && todo.status === 'pending' && (
        <div className="card-actions">
          {todo.can_edit && (
            <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
              Modifier
            </button>
          )}
          <button type="button" className="btn-ghost danger" onClick={() => onDelete(todo.id)}>
            Supprimer
          </button>
        </div>
      )}
      {isAdmin && todo.status === 'done' && (
        <div className="card-actions">
          <button type="button" className="btn-ghost" onClick={() => onToggle(todo)}>
            Remettre en attente
          </button>
          <button type="button" className="btn-ghost danger" onClick={() => onDelete(todo.id)}>
            Supprimer
          </button>
        </div>
      )}
    </article>
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
        <span className="history-chevron">{open ? '▼' : '▶'}</span>
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
                      {t.author} · {PRIORITY_LABELS[t.priority]} · {DURATION_LABELS[t.duration || 'normal']}
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
                    <span className="history-item-meta">
                      {formatDate(t.completed_at)}
                    </span>
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

export default function Dashboard({ auth, onLogout }) {
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [todos, setTodos] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const isAdmin = auth.role === 'admin';
  const defaultAuthor = getStoredAuth().author;

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

  return (
    <div className="app">
      <header className="app-header">
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
          <span className="user-pill">{auth.role === 'admin' ? ROLE_LABELS.admin : auth.label}</span>
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
        <div className="card sidebar-card">
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
                {tab.id === 'pending' && (
                  <span className="sub">Objectifs à réaliser</span>
                )}
                {tab.id === 'done' && <span className="sub">Déjà terminés</span>}
                {tab.id === 'history' && <span className="sub">Journal des 30 derniers jours</span>}
                {tab.id === 'all' && <span className="sub">Vue complète admin</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="card main-card">
          <div className="card-header">
            <span>
              {filter === 'pending' && 'À faire'}
              {filter === 'done' && 'Terminés'}
              {filter === 'history' && 'Historique'}
              {filter === 'all' && 'Tous les objectifs'}
            </span>
            {filter !== 'history' && !loading && (
              <span className="hint">{filtered.length} objectif{filtered.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="card-body">
            {!isAdmin && filter === 'pending' && (
              <AddForm defaultAuthor={defaultAuthor} onAdded={loadTodos} />
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
                <div className="todo-list">
                  {!loading &&
                    filtered.map((todo) => (
                      <TodoCard
                        key={todo.id}
                        todo={todo}
                        isAdmin={isAdmin}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                      />
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
