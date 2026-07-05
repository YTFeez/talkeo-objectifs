import { useState } from 'react';
import {
  formatDate,
  formatDue,
  isOverdue,
  toDatetimeLocal,
  PRIORITY_LABELS,
  DURATION_LABELS,
} from './api';

function Badge({ type, value }) {
  return (
    <span className={`badge badge-${type}-${value}`}>
      {type === 'priority' ? PRIORITY_LABELS[value] : DURATION_LABELS[value]}
    </span>
  );
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

function useTodoEditor(todo, onEdit) {
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

  async function saveEdit() {
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

function todoRowClass(todo) {
  return [
    'todo-row',
    `priority-${todo.priority || 'normal'}`,
    todo.status === 'done' ? 'done' : '',
    isOverdue(todo.due_at) && todo.status === 'pending' ? 'overdue' : '',
  ].filter(Boolean).join(' ');
}

function todoCardClass(todo) {
  return [
    'todo-mobile-card',
    `priority-${todo.priority || 'normal'}`,
    todo.status === 'done' ? 'done' : '',
    isOverdue(todo.due_at) && todo.status === 'pending' ? 'overdue' : '',
  ].filter(Boolean).join(' ');
}

function TodoActions({ todo, isAdmin, onToggle, onDelete, onEditStart, layout }) {
  const canEditPending = (isAdmin || todo.can_edit) && todo.status === 'pending';
  const canManageDone = isAdmin && todo.status === 'done';
  const btnClass = layout === 'mobile' ? 'btn btn-secondary btn-touch' : 'link-btn';
  const dangerClass = layout === 'mobile' ? 'btn btn-secondary btn-touch danger' : 'link-btn danger';

  if (!canEditPending && !canManageDone) {
    return layout === 'desktop' ? <td className="actions" /> : null;
  }

  const content = (
    <>
      {canEditPending && todo.can_edit && (
        <button type="button" className={btnClass} onClick={onEditStart}>
          Modifier
        </button>
      )}
      {canEditPending && (
        <button type="button" className={dangerClass} onClick={() => onDelete(todo.id)}>
          Supprimer
        </button>
      )}
      {canManageDone && (
        <>
          <button type="button" className={btnClass} onClick={() => onToggle(todo)}>
            Réouvrir
          </button>
          <button type="button" className={dangerClass} onClick={() => onDelete(todo.id)}>
            Supprimer
          </button>
        </>
      )}
    </>
  );

  if (layout === 'desktop') {
    return <td className="actions">{content}</td>;
  }

  return <div className="todo-mobile-actions">{content}</div>;
}

export function TodoRow({ todo, isAdmin, onToggle, onDelete, onEdit, ObjectiveFields, colSpan }) {
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
      {isAdmin && (
        <td className="col-check">
          <button
            type="button"
            className={`check-btn ${todo.status === 'done' ? 'checked' : ''}`}
            onClick={() => onToggle(todo)}
            aria-label={todo.status === 'done' ? 'Remettre en attente' : 'Terminer'}
          />
        </td>
      )}
      <td className="col-title">
        <span className="todo-title">{todo.title}</span>
        {todo.description && <p className="todo-desc">{todo.description}</p>}
      </td>
      <td className="col-priority">
        <Badge type="priority" value={todo.priority || 'normal'} />
      </td>
      <td className="col-duration">
        <Badge type="duration" value={todo.duration || 'normal'} />
      </td>
      <td className="col-due">
        {todo.due_at ? (
          <span className={isOverdue(todo.due_at) && todo.status === 'pending' ? 'due-overdue' : 'due-text'}>
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
      <TodoActions
        todo={todo}
        isAdmin={isAdmin}
        onToggle={onToggle}
        onDelete={onDelete}
        onEditStart={() => editor.setEditing(true)}
        layout="desktop"
      />
    </tr>
  );
}

export function TodoMobileCard({ todo, isAdmin, onToggle, onDelete, onEdit, ObjectiveFields }) {
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
        {isAdmin && (
          <button
            type="button"
            className={`check-btn check-btn-lg ${todo.status === 'done' ? 'checked' : ''}`}
            onClick={() => onToggle(todo)}
            aria-label={todo.status === 'done' ? 'Remettre en attente' : 'Terminer'}
          />
        )}
        <div className="todo-mobile-main">
          <h3 className="todo-title">{todo.title}</h3>
          {todo.description && <p className="todo-desc">{todo.description}</p>}
        </div>
      </div>
      <div className="todo-mobile-badges">
        <Badge type="priority" value={todo.priority || 'normal'} />
        <Badge type="duration" value={todo.duration || 'normal'} />
        {todo.due_at && (
          <span className={`due-chip ${isOverdue(todo.due_at) && todo.status === 'pending' ? 'due-overdue' : ''}`}>
            {formatDue(todo.due_at)}
          </span>
        )}
      </div>
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
      <TodoActions
        todo={todo}
        isAdmin={isAdmin}
        onToggle={onToggle}
        onDelete={onDelete}
        onEditStart={() => editor.setEditing(true)}
        layout="mobile"
      />
    </article>
  );
}

export function TodoTable({ todos, isAdmin, onToggle, onDelete, onEdit, ObjectiveFields }) {
  const colSpan = isAdmin ? 7 : 6;
  return (
    <div className="table-wrap todo-table desktop-only">
      <table>
        <thead>
          <tr>
            {isAdmin && <th className="col-check" aria-label="Terminer" />}
            <th>Objectif</th>
            <th className="col-priority">Priorité</th>
            <th className="col-duration">Durée</th>
            <th className="col-due">Échéance</th>
            <th className="col-meta">Info</th>
            <th className="actions" />
          </tr>
        </thead>
        <tbody>
          {todos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              isAdmin={isAdmin}
              onToggle={onToggle}
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

export function TodoMobileList({ todos, isAdmin, onToggle, onDelete, onEdit, ObjectiveFields }) {
  return (
    <div className="todo-mobile-list mobile-only">
      {todos.map((todo) => (
        <TodoMobileCard
          key={todo.id}
          todo={todo}
          isAdmin={isAdmin}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
          ObjectiveFields={ObjectiveFields}
        />
      ))}
    </div>
  );
}
