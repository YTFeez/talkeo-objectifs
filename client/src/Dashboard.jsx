import { useState, useEffect, useCallback, useRef } from 'react';
import { api, clearAuth, formatDate, PRIORITY_LABELS, getStoredAuth, saveAuthor } from './api';
import SettingsModal from './SettingsModal';

function IconExplorer() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3-3" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function PriorityBadge({ priority }) {
  return (
    <span className={`priority-badge priority-${priority}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function EditTodoPanel({ todo, onSave, onCancel }) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description || '');
  const [author, setAuthor] = useState(todo.author);
  const [priority, setPriority] = useState(todo.priority);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSave({ title, description, author, priority });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <form className="edit-panel" onSubmit={handleSubmit}>
      <input
        className="edit-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Détails…"
        rows={3}
      />
      <div className="edit-options">
        <select value={author} onChange={(e) => setAuthor(e.target.value)}>
          <option>Maman</option>
          <option>Papa</option>
          <option>Parent</option>
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Basse</option>
          <option value="normal">Normale</option>
          <option value="high">Haute</option>
        </select>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="edit-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn-primary-inline" disabled={loading}>
          {loading ? '…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

function TodoMessage({ todo, isAdmin, onToggle, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);

  async function handleSave(data) {
    await onEdit(todo.id, data);
    setEditing(false);
  }

  return (
    <article className={`chat-message ${todo.status === 'done' ? 'done' : ''}`}>
      <div className="msg-avatar">{todo.author[0]}</div>
      <div className="msg-body">
        <div className="msg-header">
          <span className="msg-author">{todo.author}</span>
          <span className="msg-time">{formatDate(todo.created_at)}</span>
          <PriorityBadge priority={todo.priority} />
          {todo.status === 'done' && (
            <span className="msg-status">Terminé · {formatDate(todo.completed_at)}</span>
          )}
        </div>

        {editing ? (
          <EditTodoPanel
            todo={todo}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="msg-content">
              <p className="msg-title">{todo.title}</p>
              {todo.description && (
                <div className="thought-block">
                  <span className="thought-label">Détails</span>
                  <p>{todo.description}</p>
                </div>
              )}
            </div>
            <div className="msg-actions">
              {isAdmin && (
                <button type="button" className="msg-btn" onClick={() => onToggle(todo)}>
                  {todo.status === 'done' ? 'Remettre en attente' : 'Marquer terminé'}
                </button>
              )}
              {todo.can_edit && todo.status === 'pending' && (
                <button type="button" className="msg-btn" onClick={() => setEditing(true)}>
                  Modifier
                </button>
              )}
              {(isAdmin || todo.can_edit) && todo.status === 'pending' && (
                <button type="button" className="msg-btn danger" onClick={() => onDelete(todo.id)}>
                  Supprimer
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function Composer({ defaultAuthor, onAdded }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState(defaultAuthor);
  const [priority, setPriority] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
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
      setShowDetails(false);
      onAdded();
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-box">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ajouter un objectif pour Arron…"
          onFocus={() => setShowDetails(true)}
        />
        {showDetails && (
          <textarea
            className="composer-details"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Détails optionnels…"
            rows={2}
          />
        )}
        <div className="composer-toolbar">
          <div className="composer-left">
            <select value={author} onChange={(e) => setAuthor(e.target.value)} className="composer-select">
              <option>Maman</option>
              <option>Papa</option>
              <option>Parent</option>
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="composer-select">
              <option value="low">Basse</option>
              <option value="normal">Normale</option>
              <option value="high">Haute</option>
            </select>
          </div>
          <div className="composer-right">
            <button type="submit" className="composer-send" disabled={loading || !title.trim()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l8 18-8-4-8 4 8-18z" />
              </svg>
              Envoyer
            </button>
          </div>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

export default function Dashboard({ auth, onLogout }) {
  const [filter, setFilter] = useState('pending');
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activePanel, setActivePanel] = useState('explorer');
  const isAdmin = auth.role === 'admin';
  const defaultAuthor = getStoredAuth().author;

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? '' : `?status=${filter}`;
      const { todos: list } = await api(`/todos${status}`);
      setTodos(list);
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
    await api(`/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    loadTodos();
  }

  const pendingCount = todos.filter((t) => t.status === 'pending').length;
  const filterLabels = {
    pending: 'En attente',
    done: 'Terminés',
    all: 'Tous',
  };

  return (
    <div className="cursor-app">
      <header className="titlebar">
        <div className="titlebar-menus">
          <span>File</span><span>Edit</span><span>Selection</span><span>View</span>
          <span>Go</span><span>Run</span><span>Terminal</span><span>Help</span>
        </div>
        <div className="titlebar-center">Talkeo</div>
        <div className="titlebar-actions">
          <button type="button" className="titlebar-btn" onClick={() => setShowSettings(true)}>
            Paramètres
          </button>
        </div>
      </header>

      <div className="workspace">
        <nav className="activity-bar">
          <button
            type="button"
            className={activePanel === 'explorer' ? 'active' : ''}
            title="Explorateur"
            onClick={() => setActivePanel('explorer')}
          >
            <IconExplorer />
          </button>
          <button type="button" title="Recherche" onClick={() => setActivePanel('search')}>
            <IconSearch />
          </button>
          <button
            type="button"
            className="activity-bottom"
            title="Paramètres"
            onClick={() => setShowSettings(true)}
          >
            <IconSettings />
          </button>
        </nav>

        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-title">EXPLORATEUR</div>
            <div className="tree">
              <div className="tree-root">
                <span className="tree-chevron">▼</span>
                <span className="tree-label">TALKEO</span>
              </div>
              <div className="tree-children">
                <button
                  type="button"
                  className={`tree-item ${filter === 'pending' ? 'active' : ''}`}
                  onClick={() => setFilter('pending')}
                >
                  <span className="tree-icon">○</span>
                  objectifs-en-attente
                  {pendingCount > 0 && <span className="tree-badge">{pendingCount}</span>}
                </button>
                <button
                  type="button"
                  className={`tree-item ${filter === 'done' ? 'active' : ''}`}
                  onClick={() => setFilter('done')}
                >
                  <span className="tree-icon">✓</span>
                  objectifs-termines
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className={`tree-item ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                  >
                    <span className="tree-icon">≡</span>
                    tous-les-objectifs
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="user-chip">
              <span className="user-dot" />
              {auth.label}
            </div>
            <button type="button" className="sidebar-link" onClick={onLogout}>
              Déconnexion
            </button>
          </div>
        </aside>

        <main className="editor">
          <div className="tab-bar">
            <div className="tab active">
              <span className="tab-icon">💬</span>
              {filterLabels[filter]}
              <button type="button" className="tab-close">×</button>
            </div>
          </div>

          <div className="chat-panel">
            <div className="chat-feed">
              {loading && (
                <div className="chat-empty">
                  <div className="thought-block loading-block">
                    <span className="thought-label">Chargement</span>
                    <p>Récupération des objectifs…</p>
                  </div>
                </div>
              )}

              {!loading && todos.length === 0 && (
                <div className="chat-empty">
                  <h2>Aucun objectif {filter === 'pending' ? 'en attente' : 'ici'}</h2>
                  <p>
                    {!isAdmin && filter === 'pending'
                      ? 'Utilisez le champ ci-dessous pour en ajouter un.'
                      : 'Les objectifs apparaîtront ici.'}
                  </p>
                </div>
              )}

              {!loading &&
                todos.map((todo) => (
                  <TodoMessage
                    key={todo.id}
                    todo={todo}
                    isAdmin={isAdmin}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                ))}
            </div>

            {!isAdmin && (
              <div className="chat-composer-wrap">
                <Composer defaultAuthor={defaultAuthor} onAdded={loadTodos} />
              </div>
            )}

            {isAdmin && (
              <div className="chat-composer-wrap admin-hint-wrap">
                <p className="admin-hint">Les parents ajoutent des objectifs via leur code d&apos;accès.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onPasswordChanged={() => {}}
        />
      )}
    </div>
  );
}
