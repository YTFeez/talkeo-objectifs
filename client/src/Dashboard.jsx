import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, clearAuth, formatDate, PRIORITY_LABELS, getStoredAuth, saveAuthor } from './api';
import SettingsModal from './SettingsModal';

function PriorityBadge({ priority }) {
  return (
    <span className={`priority-badge priority-${priority}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function AddForm({ defaultAuthor, onAdded }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState(defaultAuthor);
  const [priority, setPriority] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api('/todos', {
        method: 'POST',
        body: JSON.stringify({ title, description, author, priority }),
      });
      saveAuthor(author);
      setTitle('');
      setDescription('');
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
    <section className="add-section">
      <h2 className="section-label">Nouvel objectif</h2>
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
        <div className="add-row">
          <label className="field-inline">
            De
            <select value={author} onChange={(e) => setAuthor(e.target.value)}>
              <option>Maman</option>
              <option>Papa</option>
              <option>Parent</option>
            </select>
          </label>
          <label className="field-inline">
            Priorité
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="high">Haute</option>
              <option value="normal">Normale</option>
              <option value="low">Basse</option>
            </select>
          </label>
          <button type="submit" className="btn-primary" disabled={loading || !title.trim()}>
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
  const [author, setAuthor] = useState(todo.author);
  const [priority, setPriority] = useState(todo.priority);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onEdit(todo.id, { title, description, author, priority });
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
          <div className="add-row">
            <select value={author} onChange={(e) => setAuthor(e.target.value)}>
              <option>Maman</option>
              <option>Papa</option>
              <option>Parent</option>
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="high">Haute</option>
              <option value="normal">Normale</option>
              <option value="low">Basse</option>
            </select>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="card-actions">
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </article>
    );
  }

  return (
    <article className={`todo-card priority-${todo.priority} ${todo.status === 'done' ? 'done' : ''}`}>
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
            <PriorityBadge priority={todo.priority} />
          </div>
          {todo.description && <p className="card-desc">{todo.description}</p>}
          <div className="card-meta">
            <span>{todo.author}</span>
            <span>·</span>
            <span>{formatDate(todo.created_at)}</span>
            {todo.status === 'done' && todo.completed_at && (
              <>
                <span>·</span>
                <span className="meta-done">Fait le {formatDate(todo.completed_at)}</span>
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
    ...(isAdmin ? [{ id: 'all', label: 'Tous' }] : []),
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="logo">T</div>
          <div>
            <strong>Talkeo</strong>
            <span>{isAdmin ? 'Espace Arron' : 'Espace parents'}</span>
          </div>
        </div>
        <div className="header-user">
          <span className="user-badge">{auth.label}</span>
          <button type="button" className="btn-ghost" onClick={() => setShowSettings(true)}>
            Mot de passe
          </button>
          <button type="button" className="btn-ghost" onClick={onLogout}>
            Quitter
          </button>
        </div>
      </header>

      <div className="toolbar">
        <nav className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={filter === tab.id ? 'active' : ''}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="tab-count">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="search-box">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
          />
        </div>
      </div>

      <main className="main">
        {!isAdmin && filter === 'pending' && (
          <AddForm defaultAuthor={defaultAuthor} onAdded={loadTodos} />
        )}

        {isAdmin && filter === 'pending' && pendingCount > 0 && (
          <p className="admin-banner">
            {pendingCount} objectif{pendingCount > 1 ? 's' : ''} en attente — cochez pour marquer comme fait.
          </p>
        )}

        <section className="list-section">
          <h2 className="section-label">
            {filter === 'pending' && 'À faire'}
            {filter === 'done' && 'Terminés'}
            {filter === 'all' && 'Tous les objectifs'}
            {!loading && ` (${filtered.length})`}
          </h2>

          {loading && <p className="state-msg">Chargement…</p>}

          {!loading && filtered.length === 0 && (
            <div className="empty">
              <p>
                {search
                  ? 'Aucun résultat pour cette recherche.'
                  : filter === 'pending'
                    ? 'Aucun objectif en attente.'
                    : 'Rien à afficher ici.'}
              </p>
              {!isAdmin && filter === 'pending' && !search && (
                <p className="empty-hint">Utilisez le formulaire ci-dessus pour en ajouter un.</p>
              )}
            </div>
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
        </section>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
