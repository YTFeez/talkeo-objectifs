import { useState } from 'react';
import { formatDate, formatEventAt, formatEventShort, isEventPast, toEventParts, fromEventParts } from './api';

export function EventFields({ values, onChange }) {
  return (
    <div className="event-fields">
      <label className="field-inline">
        De
        <select value={values.author} onChange={(e) => onChange('author', e.target.value)}>
          <option>Maman</option>
          <option>Papa</option>
          <option>Parent</option>
        </select>
      </label>
      <label className="field-inline">
        Date
        <input
          type="date"
          className="input-touch"
          value={values.event_date}
          onChange={(e) => onChange('event_date', e.target.value)}
          required
        />
      </label>
      <label className="field-inline">
        Heure
        <input
          type="time"
          className="input-touch"
          value={values.event_time}
          onChange={(e) => onChange('event_time', e.target.value)}
          required
        />
      </label>
    </div>
  );
}

function EventEditForm({ title, setTitle, description, setDescription, fields, onFieldChange, error, saving, onCancel, onSubmit, EventFields: Fields }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="todo-edit-form"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Titre de l'événement" />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Détails (optionnel)"
        rows={2}
      />
      <Fields values={fields} onChange={onFieldChange} />
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

function useEventEditor(event, onEdit) {
  const parts = toEventParts(event.event_at);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || '');
  const [fields, setFields] = useState({
    author: event.author,
    event_date: parts.event_date,
    event_time: parts.event_time,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function saveEdit() {
    const event_at = fromEventParts(fields.event_date, fields.event_time);
    if (!event_at) {
      setError('La date est obligatoire');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onEdit(event.id, {
        title,
        description,
        author: fields.author,
        event_at,
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

function EventActions({ event, onDelete, onEditStart, layout }) {
  if (!event.can_edit && !event.can_delete) {
    return layout === 'desktop' ? <td className="actions" /> : null;
  }

  const btnClass = layout === 'mobile' ? 'btn btn-secondary btn-touch' : 'link-btn';
  const dangerClass = layout === 'mobile' ? 'btn btn-secondary btn-touch danger' : 'link-btn danger';

  const content = (
    <>
      {event.can_edit && (
        <button type="button" className={btnClass} onClick={onEditStart}>
          Modifier
        </button>
      )}
      {event.can_delete && (
        <button type="button" className={dangerClass} onClick={() => onDelete(event.id)}>
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

export function EventRow({ event, onDelete, onEdit, EventFields: Fields }) {
  const editor = useEventEditor(event, onEdit);
  const past = isEventPast(event.event_at);

  if (editor.editing) {
    return (
      <tr className="todo-edit-row">
        <td colSpan={4}>
          <EventEditForm
            {...editor}
            onFieldChange={editor.onFieldChange}
            onCancel={() => editor.setEditing(false)}
            onSubmit={editor.saveEdit}
            EventFields={Fields}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className={`event-row ${past ? 'past' : ''}`}>
      <td className="col-title">
        <span className="todo-title">{event.title}</span>
        {event.description && <p className="todo-desc">{event.description}</p>}
      </td>
      <td className="col-event-at">
        <span className={`event-datetime ${past ? 'past' : 'upcoming'}`}>{formatEventAt(event.event_at)}</span>
      </td>
      <td className="col-meta">
        <span>{event.author}</span>
        <span className="meta-sep">·</span>
        <span>Ajouté {formatDate(event.created_at)}</span>
      </td>
      <EventActions event={event} onDelete={onDelete} onEditStart={() => editor.setEditing(true)} layout="desktop" />
    </tr>
  );
}

export function EventMobileCard({ event, onDelete, onEdit, EventFields: Fields }) {
  const editor = useEventEditor(event, onEdit);
  const past = isEventPast(event.event_at);

  if (editor.editing) {
    return (
      <article className={`event-mobile-card editing ${past ? 'past' : ''}`}>
        <EventEditForm
          {...editor}
          onFieldChange={editor.onFieldChange}
          onCancel={() => editor.setEditing(false)}
          onSubmit={editor.saveEdit}
          EventFields={Fields}
        />
      </article>
    );
  }

  return (
    <article className={`event-mobile-card ${past ? 'past' : ''}`}>
      <div className="event-mobile-when">
        <span className={`event-date-chip ${past ? 'past' : 'upcoming'}`}>{formatEventShort(event.event_at)}</span>
      </div>
      <h3 className="todo-title">{event.title}</h3>
      {event.description && <p className="todo-desc">{event.description}</p>}
      <p className="todo-mobile-meta">
        <span>{event.author}</span>
        <span className="meta-sep">·</span>
        <span>Ajouté {formatDate(event.created_at)}</span>
      </p>
      <EventActions event={event} onDelete={onDelete} onEditStart={() => editor.setEditing(true)} layout="mobile" />
    </article>
  );
}

export function EventTable({ events, onDelete, onEdit, EventFields: Fields }) {
  return (
    <div className="table-wrap event-table desktop-only">
      <table>
        <thead>
          <tr>
            <th>Événement</th>
            <th className="col-event-at">Date et heure</th>
            <th className="col-meta">Info</th>
            <th className="actions" />
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <EventRow key={event.id} event={event} onDelete={onDelete} onEdit={onEdit} EventFields={Fields} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EventMobileList({ events, onDelete, onEdit, EventFields: Fields }) {
  return (
    <div className="event-mobile-list mobile-only">
      {events.map((event) => (
        <EventMobileCard key={event.id} event={event} onDelete={onDelete} onEdit={onEdit} EventFields={Fields} />
      ))}
    </div>
  );
}
