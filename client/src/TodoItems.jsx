import { useState } from 'react';
import {
  formatDate,
  formatDue,
  formatMoney,
  formatPercent,
  isOverdue,
  toDatetimeLocal,
  PRIORITY_LABELS,
  DURATION_LABELS,
  TASK_CATEGORIES,
  TASK_STATUS_LABELS,
} from './api';

function Badge({ type, value }) {
  return (
    <span className={`badge badge-${type}-${value}`}>
      {type === 'priority' ? PRIORITY_LABELS[value] : DURATION_LABELS[value]}
    </span>
  );
}

function StatusBadge({ status }) {
  if (!status || status === 'pending') return null;
  return <span className={`status-badge status-${status}`}>{TASK_STATUS_LABELS[status] || status}</span>;
}

export function TodoEditForm({ title, setTitle, description, setDescription, fields, onFieldChange, error, saving, onCancel, onSubmit, ObjectiveFields }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="todo-edit-form"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Titre" />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Détails (optionnel)"
        rows={2}
      />
      <ObjectiveFields values={fields} onChange={onFieldChange} />
      {error && <p className="form-error">{error}</p>}
      <div className="todo-edit-actions">
        <button type="button" className="btn btn-secondary btn-touch" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="btn btn-primary btn-touch" disabled={saving}>
          {saving ? '…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

function RewardBadge({ todo }) {
  if (todo.task_type === 'special') {
    const bonus = Number(todo.fixed_bonus) || 0;
    if (bonus <= 0) return null;
    return (
      <span className={`reward-badge special ${todo.status === 'done' ? 'earned' : 'pending'}`}>
        ★ {formatMoney(bonus)}
      </span>
    );
  }
  const pct = Number(todo.reward_percent) || 0;
  if (pct <= 0) return null;
  const earned = todo.status === 'done' && Number(todo.earned_amount) > 0;
  return (
    <span className={`reward-badge ${todo.status === 'done' ? 'earned' : 'pending'}`}>
      {earned ? formatMoney(todo.earned_amount) : formatPercent(pct)}
    </span>
  );
}

function hasRewardDisplay(todo) {
  if (todo.task_type === 'special') return Number(todo.fixed_bonus) > 0;
  return Number(todo.reward_percent) > 0 || (todo.status === 'done' && Number(todo.earned_amount) > 0);
}

function useTodoEditor(todo, onEdit) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description || '');
  const [fields, setFields] = useState({
    author: todo.author,
    priority: todo.priority || 'normal',
    duration: todo.duration || 'normal',
    due_at: toDatetimeLocal(todo.due_at),
    task_type: todo.task_type || 'normal',
    fixed_bonus: todo.fixed_bonus || 0,
    category: todo.category || 'maison',
    repeat_type: todo.repeat_type || 'none',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveEdit() {
    setSaving(true);
    setError('');
    try {
      await onEdit(todo.id, {
        title,
        description,
        ...fields,
        due_at: fields.due_at || null,
        fixed_bonus: fields.fixed_bonus === '' ? 0 : Number(fields.fixed_bonus) || 0,
      });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return {
    editing,
    setEditing,
    title,
    setTitle,
    description,
    setDescription,
    fields,
    onFieldChange: (k, v) => setFields((f) => ({ ...f, [k]: v })),
    saving,
    error,
    saveEdit,
  };
}

function isActiveTodo(todo) {
  return ['pending', 'awaiting_validation', 'refused'].includes(todo.status);
}

function todoRowClass(todo) {
  return [
    'todo-row',
    `priority-${todo.priority || 'normal'}`,
    todo.status === 'done' ? 'done' : '',
    todo.status === 'refused' ? 'refused' : '',
    todo.status === 'awaiting_validation' ? 'awaiting' : '',
    isOverdue(todo.due_at) && todo.status === 'pending' ? 'overdue' : '',
  ].filter(Boolean).join(' ');
}

function todoCardClass(todo) {
  return [
    'todo-mobile-card',
    `priority-${todo.priority || 'normal'}`,
    todo.status === 'done' ? 'done' : '',
    todo.status === 'refused' ? 'refused' : '',
    todo.status === 'awaiting_validation' ? 'awaiting' : '',
    isOverdue(todo.due_at) && todo.status === 'pending' ? 'overdue' : '',
  ].filter(Boolean).join(' ');
}

function TodoTaskActions({ todo, isAdmin, onSubmit, onValidate, onReject, onReopen, layout }) {
  const wrapClass = layout === 'mobile' ? 'todo-task-actions' : 'todo-task-actions inline';

  if (isAdmin && todo.can_submit) {
    return (
      <div className={wrapClass}>
        <button type="button" className="btn btn-primary btn-touch" onClick={() => onSubmit(todo)}>
          J&apos;ai terminé ✓
        </button>
      </div>
    );
  }

  if (!isAdmin && todo.status === 'awaiting_validation') {
    return (
      <div className={wrapClass}>
        <button type="button" className="btn btn-primary btn-touch" onClick={() => onValidate(todo)}>Valider</button>
        <button type="button" className="btn btn-secondary btn-touch danger" onClick={() => onReject(todo)}>Refuser</button>
      </div>
    );
  }

  if (!isAdmin && todo.status === 'done') {
    return (
      <div className={wrapClass}>
        <button type="button" className="btn btn-secondary btn-touch" onClick={() => onReopen(todo)}>Rouvrir</button>
      </div>
    );
  }

  if (todo.status === 'refused' && todo.refused_reason) {
    return <p className="hint refused-reason">Refus : {todo.refused_reason}</p>;
  }

  if (todo.status === 'awaiting_validation' && isAdmin) {
    return <p className="hint awaiting-hint">En attente de validation des parents</p>;
  }

  return null;
}

function TodoActions({ todo, onDelete, onEditStart, layout }) {
  const canEdit = todo.can_edit;
  const canDelete = todo.can_delete;
  const btnClass = layout === 'mobile' ? 'btn btn-secondary btn-touch' : 'link-btn';
  const dangerClass = layout === 'mobile' ? 'btn btn-secondary btn-touch danger' : 'link-btn danger';

  if (!canEdit && !canDelete) {
    return layout === 'desktop' ? <td className="actions" /> : null;
  }

  const content = (
    <>
      {canEdit && (
        <button type="button" className={btnClass} onClick={onEditStart}>
          Modifier
        </button>
      )}
      {canDelete && (
        <button type="button" className={dangerClass} onClick={() => onDelete(todo.id)}>
          Supprimer
        </button>
      )}
    </>
  );

  if (layout === 'desktop') {
    return <td className="actions">{content}</td>;
  }

  return <div className="todo-mobile-actions">{content}</div>;
}

export function TodoRow({ todo, isAdmin, onSubmit, onValidate, onReject, onReopen, onDelete, onEdit, ObjectiveFields, colSpan }) {
  const editor = useTodoEditor(todo, onEdit);

  if (editor.editing) {
    return (
      <tr className="todo-edit-row">
        <td colSpan={colSpan}>
          <TodoEditForm
            {...editor}
            onFieldChange={editor.onFieldChange}
            onCancel={() => editor.setEditing(false)}
            onSubmit={editor.saveEdit}
            ObjectiveFields={ObjectiveFields}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className={todoRowClass(todo)}>
      <td className="col-title">
        <span className="todo-title">{todo.title}</span>
        <StatusBadge status={todo.status} />
        {todo.category && <span className="category-chip">{TASK_CATEGORIES[todo.category] || todo.category}</span>}
        {todo.description && <p className="todo-desc">{todo.description}</p>}
        <TodoTaskActions
          todo={todo}
          isAdmin={isAdmin}
          onSubmit={onSubmit}
          onValidate={onValidate}
          onReject={onReject}
          onReopen={onReopen}
          layout="inline"
        />
      </td>
      <td className="col-reward">
        {hasRewardDisplay(todo) ? <RewardBadge todo={todo} /> : <span className="hint">—</span>}
      </td>
      <td className="col-priority">
        <Badge type="priority" value={todo.priority || 'normal'} />
      </td>
      <td className="col-duration">
        <Badge type="duration" value={todo.duration || 'normal'} />
      </td>
      <td className="col-due">
        {todo.due_at ? (
          <span className={isOverdue(todo.due_at) && isActiveTodo(todo) ? 'due-overdue' : 'due-text'}>
            {formatDue(todo.due_at)}
          </span>
        ) : (
          <span className="hint">—</span>
        )}
      </td>
      <td className="col-meta">
        <span>{todo.author}</span>
        <span className="meta-sep">·</span>
        <span>{formatDate(todo.created_at)}</span>
        {todo.status === 'done' && todo.completed_at && (
          <>
            <span className="meta-sep">·</span>
            <span className="meta-done">Fait {formatDate(todo.completed_at)}</span>
          </>
        )}
      </td>
      <TodoActions todo={todo} onDelete={onDelete} onEditStart={() => editor.setEditing(true)} layout="desktop" />
    </tr>
  );
}

export function TodoMobileCard({ todo, isAdmin, onSubmit, onValidate, onReject, onReopen, onDelete, onEdit, ObjectiveFields }) {
  const editor = useTodoEditor(todo, onEdit);

  if (editor.editing) {
    return (
      <article className={`${todoCardClass(todo)} editing`}>
        <TodoEditForm
          {...editor}
          onFieldChange={editor.onFieldChange}
          onCancel={() => editor.setEditing(false)}
          onSubmit={editor.saveEdit}
          ObjectiveFields={ObjectiveFields}
        />
      </article>
    );
  }

  return (
    <article className={todoCardClass(todo)}>
      <div className="todo-mobile-header">
        <div className="todo-mobile-main">
          <h3 className="todo-title">{todo.title}</h3>
          <StatusBadge status={todo.status} />
          {todo.description && <p className="todo-desc">{todo.description}</p>}
        </div>
      </div>
      <div className="todo-mobile-badges">
        <RewardBadge todo={todo} />
        <Badge type="priority" value={todo.priority || 'normal'} />
        <Badge type="duration" value={todo.duration || 'normal'} />
        {todo.category && <span className="category-chip">{TASK_CATEGORIES[todo.category]}</span>}
        {todo.due_at && (
          <span className={`due-chip ${isOverdue(todo.due_at) && isActiveTodo(todo) ? 'due-overdue' : ''}`}>
            {formatDue(todo.due_at)}
          </span>
        )}
      </div>
      <TodoTaskActions
        todo={todo}
        isAdmin={isAdmin}
        onSubmit={onSubmit}
        onValidate={onValidate}
        onReject={onReject}
        onReopen={onReopen}
        layout="mobile"
      />
      <p className="todo-mobile-meta">
        <span>{todo.author}</span>
        <span className="meta-sep">·</span>
        <span>{formatDate(todo.created_at)}</span>
        {todo.status === 'done' && todo.completed_at && (
          <>
            <span className="meta-sep">·</span>
            <span className="meta-done">Fait {formatDate(todo.completed_at)}</span>
          </>
        )}
      </p>
      <TodoActions todo={todo} onDelete={onDelete} onEditStart={() => editor.setEditing(true)} layout="mobile" />
    </article>
  );
}

export function TodoTable({ todos, isAdmin, onSubmit, onValidate, onReject, onReopen, onDelete, onEdit, ObjectiveFields }) {
  const colSpan = 7;
  return (
    <div className="table-wrap todo-table desktop-only">
      <table>
        <thead>
          <tr>
            <th>Objectif</th>
            <th className="col-reward">% / Bonus</th>
            <th className="col-priority">Priorité</th>
            <th className="col-duration">Durée</th>
            <th className="col-due">Échéance</th>
            <th className="col-meta">Info</th>
            <th className="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {todos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              isAdmin={isAdmin}
              onSubmit={onSubmit}
              onValidate={onValidate}
              onReject={onReject}
              onReopen={onReopen}
              onDelete={onDelete}
              onEdit={onEdit}
              ObjectiveFields={ObjectiveFields}
              colSpan={colSpan}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TodoMobileList({ todos, isAdmin, onSubmit, onValidate, onReject, onReopen, onDelete, onEdit, ObjectiveFields }) {
  return (
    <div className="todo-mobile-list mobile-only">
      {todos.map((todo) => (
        <TodoMobileCard
          key={todo.id}
          todo={todo}
          isAdmin={isAdmin}
          onSubmit={onSubmit}
          onValidate={onValidate}
          onReject={onReject}
          onReopen={onReopen}
          onDelete={onDelete}
          onEdit={onEdit}
          ObjectiveFields={ObjectiveFields}
        />
      ))}
    </div>
  );
}
