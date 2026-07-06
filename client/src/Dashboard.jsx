import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  api,
  clearAuth,
  formatDue,
  formatMoney,
  formatPercent,
  TASK_CATEGORIES,
  REPEAT_LABELS,
  TASK_STATUS_LABELS,
  DURATION_HINTS,
  getStoredAuth,
  saveAuthor,
  ROLE_LABELS,
} from './api';
import SettingsModal from './SettingsModal';
import ConfirmDialog from './ConfirmDialog';
import HomeView from './HomeView';
import { TodoTable, TodoMobileList } from './TodoItems';
import { EventTable, EventMobileList, EventFields } from './EventItems';
import PocketView from './PocketView';
import NotificationBell from './NotificationBell';
import { CategoryArchiveOverlay, CategoryArchiveHub } from './CategoryArchive';
import { useIsMobile } from './useMediaQuery';
import { useToast } from './useToast.jsx';
import { fromEventParts } from './api';

const MOBILE_TABS = [
  { id: 'home', label: 'Accueil', icon: '⌂' },
  { id: 'tasks', label: 'Tâches', icon: '☑' },
  { id: 'events', label: 'Agenda', icon: '◇' },
  { id: 'more', label: 'Plus', icon: '⋯' },
];

const TASK_SEGMENTS_BASE = [
  { id: 'pending', label: 'À faire' },
  { id: 'done', label: 'Terminés' },
];

function isTaskFilter(f) {
  return f === 'pending' || f === 'done' || f === 'all' || f === 'awaiting';
}

function ObjectiveFields({ values, onChange, compact, isParent }) {
  const isSpecial = values.task_type === 'special';
  return (
    <div className={`objective-fields ${compact ? 'compact' : ''} ${isParent ? 'with-reward' : ''}`}>
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
        <input type="datetime-local" value={values.due_at} onChange={(e) => onChange('due_at', e.target.value)} />
      </label>
      {isParent && (
        <>
          <label className="field-inline">
            Type
            <select value={values.task_type || 'normal'} onChange={(e) => onChange('task_type', e.target.value)}>
              <option value="normal">Normale (% auto)</option>
              <option value="special">Spéciale (bonus fixe €)</option>
            </select>
          </label>
          {isSpecial ? (
            <label className="field-inline field-reward">
              Bonus fixe (€)
              <input
                type="number"
                className="input-touch"
                min="0"
                step="0.5"
                value={values.fixed_bonus ?? ''}
                onChange={(e) => onChange('fixed_bonus', e.target.value)}
                placeholder="0"
              />
            </label>
          ) : (
            <p className="hint field-percent-hint">Le % est calculé selon durée et difficulté.</p>
          )}
          <label className="field-inline">
            Catégorie
            <select value={values.category || 'maison'} onChange={(e) => onChange('category', e.target.value)}>
              {Object.entries(TASK_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field-inline">
            Répétition
            <select value={values.repeat_type || 'none'} onChange={(e) => onChange('repeat_type', e.target.value)}>
              {Object.entries(REPEAT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}

function AddForm({ defaultAuthor, onAdded, isMobile, onSuccess, compact, embedded }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState({
    author: defaultAuthor,
    priority: 'normal',
    duration: 'normal',
    due_at: '',
    task_type: 'normal',
    fixed_bonus: '',
    category: 'maison',
    repeat_type: 'none',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(isMobile || compact);
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
          fixed_bonus: fields.fixed_bonus === '' ? 0 : Number(fields.fixed_bonus) || 0,
        }),
      });
      saveAuthor(fields.author);
      setTitle('');
      setDescription('');
      setFields((f) => ({ ...f, due_at: '', fixed_bonus: '' }));
      if (!isMobile && !compact) setOpen(false);
      onAdded();
      onSuccess?.('Objectif ajouté');
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`add-form-section ${isMobile ? 'add-form-mobile' : ''} ${compact ? 'add-form-compact' : ''}`}>
      {!compact && !embedded && <h3>Nouvel objectif</h3>}
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
        {(open || isMobile || compact) && (
          <textarea
            className="input-touch"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Détails (optionnel)"
            rows={2}
          />
        )}
        {(open || isMobile || compact) && (
          <ObjectiveFields values={fields} onChange={updateField} isParent />
        )}
        <div className="add-row">
          {!open && !isMobile && !compact && (
            <ObjectiveFields values={fields} onChange={updateField} compact isParent />
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

function AddEventForm({ defaultAuthor, onAdded, isMobile, onSuccess, compact }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState({
    author: defaultAuthor,
    event_date: '',
    event_time: '10:00',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  function updateField(key, val) {
    setFields((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const event_at = fromEventParts(fields.event_date, fields.event_time);
    if (!event_at) {
      setError('Choisissez une date');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api('/events', {
        method: 'POST',
        body: JSON.stringify({ title, description, author: fields.author, event_at }),
      });
      saveAuthor(fields.author);
      setTitle('');
      setDescription('');
      setFields((f) => ({ ...f, event_date: '', event_time: '10:00' }));
      onAdded();
      onSuccess?.('Événement ajouté');
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`add-form-section add-event-section ${isMobile ? 'add-form-mobile' : ''} ${compact ? 'add-form-compact' : ''}`}>
      {!compact && <h3>Nouvel événement</h3>}
      {!compact && (
        <p className="hint add-event-hint">
          Ex. : Aider papa à faire les courses — choisissez le jour et l&apos;heure.
        </p>
      )}
      <form className="add-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="input-touch"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Aider papa à faire les courses"
          required
        />
        <textarea
          className="input-touch"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Détails (lieu, consignes…)"
          rows={2}
        />
        <EventFields values={fields} onChange={updateField} />
        <button type="submit" className="btn btn-primary btn-touch add-submit" disabled={loading || !title.trim()}>
          {loading ? 'Ajout…' : '+ Ajouter l\'événement'}
        </button>
        {error && <p className="form-error">{error}</p>}
      </form>
    </section>
  );
}

function SegmentControl({ segments, value, onChange }) {
  return (
    <div className="segment-control" role="tablist">
      {segments.map((seg) => (
        <button
          key={seg.id}
          type="button"
          role="tab"
          aria-selected={value === seg.id}
          className={`segment-btn ${value === seg.id ? 'active' : ''}`}
          onClick={() => onChange(seg.id)}
        >
          {seg.label}
          {seg.count != null && seg.count > 0 && <span className="segment-count">{seg.count}</span>}
        </button>
      ))}
    </div>
  );
}

export default function Dashboard({ auth, onLogout }) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [filter, setFilter] = useState('home');
  const [search, setSearch] = useState('');
  const [todos, setTodos] = useState([]);
  const [events, setEvents] = useState([]);
  const [homePending, setHomePending] = useState([]);
  const [homeEvents, setHomeEvents] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [awaitingCount, setAwaitingCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [pocketTotal, setPocketTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addSheet, setAddSheet] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(null);

  const openArchive = useCallback((payload) => setArchiveOpen(payload), []);

  const isAdmin = auth.role === 'admin';
  const defaultAuthor = getStoredAuth().author;
  const displayName = isAdmin ? ROLE_LABELS.admin : auth.label;

  const loadData = useCallback(async () => {
    const isHistory = filter === 'history';
    const isPocket = filter === 'pocket';
    const isHome = filter === 'home';
    if (!isHistory && !isPocket && !isHome) setLoading(true);

    try {
      const { todos: pending } = await api('/todos?status=pending');
      setPendingCount(pending.length);
      setAwaitingCount(pending.filter((t) => t.status === 'awaiting_validation').length);
      setHomePending(pending);

      const { events: upcoming } = await api('/events?upcoming=1');
      setEventsCount(upcoming.length);
      setHomeEvents(upcoming);

      const summary = await api('/rewards/summary');
      setPocketTotal(summary.current?.total ?? summary.wallet?.economy?.projected_total ?? summary.economy?.projected_total ?? 0);

      if (isHistory || isPocket || isHome) return;

      if (filter === 'events') {
        const { events: list } = await api('/events');
        setEvents(list);
      } else {
        const status = filter === 'all' ? '' : `?status=${filter}`;
        const { todos: list } = await api(`/todos${status}`);
        setTodos(list);
      }
    } catch {
      clearAuth();
      onLogout();
    } finally {
      if (!isHistory && !isPocket && !isHome) setLoading(false);
    }
  }, [filter, onLogout]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!accountOpen && !moreOpen && !addSheet) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setAccountOpen(false);
        setMoreOpen(false);
        setAddSheet(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [accountOpen, moreOpen, addSheet]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (filter === 'events') {
      if (!q) return events;
      return events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.author.toLowerCase().includes(q),
      );
    }
    if (!q) return todos;
    return todos.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.author.toLowerCase().includes(q),
    );
  }, [todos, events, search, filter]);

  async function handleSubmit(todo) {
    try {
      await api(`/todos/${todo.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'submit' }) });
      toast('Tâche envoyée aux parents pour validation');
      loadData();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleValidate(todo) {
    try {
      const res = await api(`/todos/${todo.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'validate' }) });
      toast(res.achievements?.length ? `Validée ✓ · Badge débloqué !` : 'Tâche validée ✓');
      loadData();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleReject(todo) {
    const reason = window.prompt('Motif du refus (optionnel) :', 'À refaire');
    if (reason === null) return;
    try {
      await api(`/todos/${todo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject', refused_reason: reason || 'À refaire' }),
      });
      toast('Tâche refusée');
      loadData();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleReopen(todo) {
    try {
      await api(`/todos/${todo.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'reopen' }) });
      toast('Tâche remise en attente');
      loadData();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function handleDelete(id) {
    setConfirm({
      title: 'Supprimer cet objectif ?',
      message: 'Cette action est définitive.',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api(`/todos/${id}`, { method: 'DELETE' });
          toast('Objectif supprimé');
          loadData();
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    });
  }

  async function handleEdit(id, data) {
    try {
      await api(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      toast('Objectif mis à jour');
      loadData();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleApplyPercents() {
    try {
      await api('/todos/apply-percents', { method: 'POST' });
      toast('Pourcentages recalculés');
      loadData();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleDemoSeed() {
    try {
      const { inserted } = await api('/todos/demo-seed', { method: 'POST' });
      if (inserted > 0) {
        toast(`${inserted} exemple${inserted > 1 ? 's' : ''} ajouté${inserted > 1 ? 's' : ''}`);
        loadData();
      } else {
        toast('Les exemples sont déjà présents', 'info');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function handleEventDelete(id) {
    setConfirm({
      title: 'Supprimer cet événement ?',
      message: 'Cette action est définitive.',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await api(`/events/${id}`, { method: 'DELETE' });
          toast('Événement supprimé');
          loadData();
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    });
  }

  async function handleEventEdit(id, data) {
    try {
      await api(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      toast('Événement mis à jour');
      loadData();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function navigate(view) {
    setMoreOpen(false);
    setFilter(view);
  }

  function handleMobileTab(tabId) {
    if (tabId === 'more') {
      setMoreOpen(true);
      return;
    }
    setMoreOpen(false);
    if (tabId === 'home') setFilter('home');
    if (tabId === 'tasks') setFilter('pending');
    if (tabId === 'events') setFilter('events');
  }

  function getMobileTabActive() {
    if (filter === 'home') return 'home';
    if (isTaskFilter(filter)) return 'tasks';
    if (filter === 'events') return 'events';
    return 'more';
  }

  const sidebarTabs = [
    { id: 'home', label: 'Accueil', sub: 'Vue d\'ensemble' },
    { id: 'pending', label: 'En attente', count: pendingCount, sub: 'Objectifs à réaliser' },
    ...(awaitingCount > 0 && !isAdmin ? [{ id: 'awaiting', label: 'À valider', count: awaitingCount, sub: 'En attente de validation' }] : []),
    { id: 'done', label: 'Terminés', sub: 'Déjà validés' },
    { id: 'events', label: 'Événements', count: eventsCount, sub: 'Agenda familial' },
    {
      id: 'pocket',
      label: isAdmin ? 'Argent de poche' : `Argent · ${ROLE_LABELS.admin}`,
      ...(isAdmin ? { countLabel: formatMoney(pocketTotal) } : {}),
      sub: isAdmin ? 'Allocation 40 € · recompte le 1er' : `${formatMoney(pocketTotal)} ce mois`,
    },
    { id: 'history', label: 'Archives', sub: 'Historique permanent par catégorie' },
    ...(isAdmin ? [{ id: 'all', label: 'Tous', sub: 'Vue complète' }] : []),
  ];

  const filterTitle = {
    home: 'Accueil',
    pending: 'À faire',
    awaiting: 'À valider',
    events: 'Événements',
    done: 'Terminés',
    pocket: isAdmin ? 'Argent de poche' : `Argent · ${ROLE_LABELS.admin}`,
    history: 'Archives permanentes',
    all: 'Tous les objectifs',
  }[filter];

  const isEventsView = filter === 'events';
  const isHistoryView = filter === 'history';
  const isPocketView = filter === 'pocket';
  const isHomeView = filter === 'home';
  const showSearch = !isHistoryView && !isPocketView && !isHomeView;

  const todoListProps = {
    todos: filtered,
    isAdmin,
    onSubmit: handleSubmit,
    onValidate: handleValidate,
    onReject: handleReject,
    onReopen: handleReopen,
    onDelete: handleDelete,
    onEdit: handleEdit,
    onOpenArchive: openArchive,
    ObjectiveFields: (props) => <ObjectiveFields {...props} isParent={!isAdmin} />,
  };

  const eventListProps = {
    events: filtered,
    onDelete: handleEventDelete,
    onEdit: handleEventEdit,
    EventFields,
  };

  const taskSegments = useMemo(
    () => [
      ...TASK_SEGMENTS_BASE.map((s) => ({
        ...s,
        count: s.id === 'pending' ? pendingCount : undefined,
      })),
      ...(!isAdmin && awaitingCount > 0 ? [{ id: 'awaiting', label: 'À valider', count: awaitingCount }] : []),
      ...(isAdmin ? [{ id: 'all', label: 'Tous' }] : []),
    ],
    [pendingCount, awaitingCount, isAdmin],
  );

  const showFab = isMobile && !isAdmin && isHomeView;

  return (
    <div className={`app app-dashboard v2 ${isMobile ? 'is-mobile' : 'is-desktop'}`}>
      {isMobile && (
        <header className="mobile-top-bar">
          <div className="mobile-top-main">
            <h1>{filterTitle}</h1>
            <p className="mobile-top-meta">
              {isAdmin ? `${formatMoney(pocketTotal)} ce mois` : `${pendingCount} à faire · ${formatMoney(pocketTotal)} Aronne`}
            </p>
          </div>
          <NotificationBell isMobile />
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

      {isMobile && showSearch && (
        <div className="mobile-search-bar">
          <input
            type="search"
            className="global-search-input input-touch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isEventsView ? 'Rechercher un événement…' : 'Rechercher une tâche…'}
          />
        </div>
      )}

      <header className="app-header desktop-only">
        <h1>Talkeo</h1>
        {showSearch && (
          <div className="global-search">
            <input
              type="search"
              className="global-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isEventsView ? 'Rechercher un événement…' : 'Rechercher…'}
            />
          </div>
        )}
        <div className="file-bar">
          <NotificationBell />
          <span className="user-pill">{displayName}</span>
          <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(true)}>
            Mot de passe
          </button>
          <button type="button" className="btn btn-secondary" onClick={onLogout}>
            Quitter
          </button>
        </div>
        <span className="meta">
          {pendingCount} en attente · {eventsCount} événement{eventsCount !== 1 ? 's' : ''}
          {!isAdmin && ` · ${formatMoney(pocketTotal)} ${ROLE_LABELS.admin}`}
          {isAdmin && ` · ${formatMoney(pocketTotal)} ce mois`}
        </span>
      </header>

      <div className="layout">
        <div className="card sidebar-card desktop-only">
          <div className="card-header">Navigation</div>
          <div className="card-body">
            {sidebarTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`list-item-btn ${filter === tab.id ? 'active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                <span className="name">
                  {tab.label}
                  {tab.countLabel && <span className="tab-count pocket-count">{tab.countLabel}</span>}
                  {!tab.countLabel && tab.count != null && tab.count > 0 && (
                    <span className="tab-count">{tab.count}</span>
                  )}
                </span>
                <span className="sub">{tab.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card main-card">
          {!isHomeView && (
            <div className="card-header desktop-only">
              <span>{filterTitle}</span>
              {filter !== 'history' && filter !== 'pocket' && !loading && (
                <span className="hint">
                  {filtered.length} {isEventsView ? `événement${filtered.length !== 1 ? 's' : ''}` : `objectif${filtered.length !== 1 ? 's' : ''}`}
                </span>
              )}
              {isPocketView && !loading && (
                <span className="hint">
                  {isAdmin ? `${formatMoney(pocketTotal)} ce mois` : `Comptes ${ROLE_LABELS.admin}`}
                </span>
              )}
            </div>
          )}

          <div className="card-body main-card-body">
            {isMobile && isTaskFilter(filter) && (
              <SegmentControl
                segments={taskSegments}
                value={filter}
                onChange={setFilter}
              />
            )}

            {isMobile && showSearch && !loading && filter !== 'history' && filter !== 'pocket' && (
              <p className="mobile-view-count hint">
                {filtered.length} {isEventsView ? `événement${filtered.length !== 1 ? 's' : ''}` : `objectif${filtered.length !== 1 ? 's' : ''}`}
              </p>
            )}

            {!isAdmin && filter === 'pending' && (
              <AddForm
                defaultAuthor={defaultAuthor}
                onAdded={loadData}
                isMobile={isMobile}
                onSuccess={(msg, type) => toast(msg, type || 'success')}
              />
            )}

            {!isAdmin && filter === 'events' && (
              <AddEventForm
                defaultAuthor={defaultAuthor}
                onAdded={loadData}
                isMobile={isMobile}
                onSuccess={(msg, type) => toast(msg, type || 'success')}
              />
            )}

            {!isAdmin && filter === 'pending' && (
              <p className="admin-banner admin-banner-actions">
                <span>Les % se réajustent à chaque modification. Allocation mensuelle : 40 €.</span>
                <button type="button" className="btn btn-secondary btn-touch" onClick={handleApplyPercents}>
                  Appliquer maintenant
                </button>
              </p>
            )}

            {isAdmin && isTaskFilter(filter) && (
              <p className="admin-banner admin-banner-actions">
                <span>Charger des tâches d&apos;exemple pour démarrer.</span>
                <button type="button" className="btn btn-secondary btn-touch" onClick={handleDemoSeed}>
                  Charger les exemples
                </button>
              </p>
            )}

            {isHomeView ? (
              <HomeView
                isAdmin={isAdmin}
                isMobile={isMobile}
                pendingCount={pendingCount}
                eventsCount={eventsCount}
                pocketTotal={pocketTotal}
                pendingTodos={homePending}
                upcomingEvents={homeEvents}
                onNavigate={navigate}
                onSubmit={handleSubmit}
                onValidate={handleValidate}
              />
            ) : isHistoryView ? (
              <CategoryArchiveHub onOpenArchive={openArchive} />
            ) : isPocketView ? (
              <PocketView key={`${pocketTotal}-${filter}`} isMobile={isMobile} isAdmin={isAdmin} onOpenArchive={openArchive} />
            ) : isEventsView ? (
              <>
                {loading && <p className="state-msg">Chargement…</p>}
                {!loading && filtered.length === 0 && (
                  <p className="empty">
                    {search ? 'Aucun événement trouvé.' : 'Aucun événement planifié.'}
                  </p>
                )}
                {!loading && filtered.length > 0 && (
                  isMobile ? <EventMobileList {...eventListProps} /> : <EventTable {...eventListProps} />
                )}
              </>
            ) : (
              <>
                {loading && <p className="state-msg">Chargement…</p>}
                {!loading && filtered.length === 0 && (
                  <p className="empty">
                    {search
                      ? 'Aucun résultat.'
                      : filter === 'pending'
                        ? 'Aucun objectif en attente.'
                        : 'Rien à afficher ici.'}
                  </p>
                )}
                {!loading && filtered.length > 0 && (
                  isMobile ? <TodoMobileList {...todoListProps} /> : <TodoTable {...todoListProps} />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {isMobile && (
        <nav className="mobile-tab-bar v2-tab-bar" aria-label="Navigation principale">
          {MOBILE_TABS.map((tab) => {
            const active = getMobileTabActive() === tab.id;
            const badge = tab.id === 'tasks' ? pendingCount : tab.id === 'events' ? eventsCount : null;
            return (
              <button
                key={tab.id}
                type="button"
                className={`mobile-tab ${active ? 'active' : ''}`}
                onClick={() => handleMobileTab(tab.id)}
                aria-current={active ? 'page' : undefined}
              >
                <span className="mobile-tab-icon" aria-hidden>{tab.icon}</span>
                <span className="mobile-tab-label">{tab.label}</span>
                {badge != null && badge > 0 && <span className="mobile-tab-badge">{badge}</span>}
              </button>
            );
          })}
        </nav>
      )}

      {showFab && (
        <button
          type="button"
          className="fab"
          onClick={() => setAddSheet('todo')}
          aria-label="Ajouter un objectif"
        >
          +
        </button>
      )}

      {addSheet && (
        <div className="mobile-sheet-overlay" onClick={() => setAddSheet(null)}>
          <div className="mobile-sheet add-sheet add-sheet-full" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-handle" aria-hidden />
            <AddForm
              defaultAuthor={defaultAuthor}
              onAdded={() => { loadData(); setAddSheet(null); }}
              isMobile
              embedded
              onSuccess={(msg, type) => toast(msg, type || 'success')}
            />
            <button type="button" className="btn btn-secondary btn-touch mobile-sheet-close" onClick={() => setAddSheet(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {moreOpen && (
        <div className="mobile-sheet-overlay" onClick={() => setMoreOpen(false)}>
          <div className="mobile-sheet more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-handle" aria-hidden />
            <div className="mobile-sheet-header">
              <span className="mobile-sheet-user">{displayName}</span>
              <span className="hint">{isAdmin ? 'Espace Aronne' : 'Espace parents'}</span>
            </div>
            <nav className="more-menu">
              <button type="button" className="more-menu-item" onClick={() => navigate('home')}>
                <span>Accueil</span>
                <span className="hint">Vue d&apos;ensemble</span>
              </button>
              <button type="button" className="more-menu-item" onClick={() => navigate('pending')}>
                <span>En attente</span>
                <span className="hint">{pendingCount} objectif{pendingCount !== 1 ? 's' : ''}</span>
              </button>
              <button type="button" className="more-menu-item" onClick={() => navigate('done')}>
                <span>Terminés</span>
                <span className="hint">Objectifs validés</span>
              </button>
              <button type="button" className="more-menu-item" onClick={() => navigate('events')}>
                <span>Événements</span>
                <span className="hint">{eventsCount} à venir</span>
              </button>
              <button type="button" className="more-menu-item accent" onClick={() => navigate('pocket')}>
                <span>{isAdmin ? 'Argent de poche' : `Argent · ${ROLE_LABELS.admin}`}</span>
                <span className="hint">{formatMoney(pocketTotal)} ce mois</span>
              </button>
              <button type="button" className="more-menu-item" onClick={() => navigate('history')}>
                <span>Historique</span>
                <span className="hint">30 derniers jours</span>
              </button>
              {isAdmin && (
                <button type="button" className="more-menu-item" onClick={() => navigate('all')}>
                  <span>Tous les objectifs</span>
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  className="more-menu-item"
                  onClick={() => { setMoreOpen(false); handleDemoSeed(); }}
                >
                  <span>Charger les exemples</span>
                  <span className="hint">Tâches de démonstration</span>
                </button>
              )}
            </nav>
            <button
              type="button"
              className="mobile-sheet-action"
              onClick={() => { setMoreOpen(false); setShowSettings(true); }}
            >
              Changer le mot de passe
            </button>
            <button
              type="button"
              className="mobile-sheet-action danger"
              onClick={() => { setMoreOpen(false); onLogout(); }}
            >
              Se déconnecter
            </button>
          </div>
        </div>
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
              onClick={() => { setAccountOpen(false); setShowSettings(true); }}
            >
              Changer le mot de passe
            </button>
            <button
              type="button"
              className="mobile-sheet-action danger"
              onClick={() => { setAccountOpen(false); onLogout(); }}
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

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        danger={confirm?.danger}
        confirmLabel="Supprimer"
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      {archiveOpen && (
        <CategoryArchiveOverlay
          section={archiveOpen.section}
          categoryKey={archiveOpen.categoryKey}
          label={archiveOpen.label}
          onClose={() => setArchiveOpen(null)}
        />
      )}
    </div>
  );
}
