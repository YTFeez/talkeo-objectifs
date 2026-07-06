import { useState, useEffect, useCallback } from 'react';
import { api, DURATION_LABELS, PRIORITY_LABELS, saveAuthor } from './api';

export default function TaskQuickSuggestions({
  defaultAuthor,
  onAdded,
  onSuccess,
  compact,
  canManage,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTitle, setLoadingTitle] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [savingIdea, setSavingIdea] = useState(false);
  const [addError, setAddError] = useState('');

  const loadSuggestions = useCallback(() => {
    api('/suggestions')
      .then(({ suggestions: list }) => setSuggestions(list))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  async function quickAdd(suggestion) {
    const key = suggestion.id ?? suggestion.title;
    setLoadingTitle(key);
    try {
      await api('/todos', {
        method: 'POST',
        body: JSON.stringify({
          title: suggestion.title,
          description: '',
          author: defaultAuthor,
          priority: suggestion.priority || 'normal',
          duration: suggestion.duration || 'normal',
          due_at: null,
          task_type: 'normal',
        }),
      });
      saveAuthor(defaultAuthor);
      onAdded?.();
      onSuccess?.(`${suggestion.title} ajouté`);
    } catch (err) {
      onSuccess?.(err.message, 'error');
    } finally {
      setLoadingTitle(null);
    }
  }

  async function handleSaveIdea(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSavingIdea(true);
    setAddError('');
    try {
      await api('/suggestions', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          priority: 'normal',
          duration: 'normal',
        }),
      });
      setNewTitle('');
      setShowAdd(false);
      loadSuggestions();
      onSuccess?.('Idée enregistrée');
    } catch (err) {
      setAddError(err.message);
    } finally {
      setSavingIdea(false);
    }
  }

  async function handleDeleteIdea(id, title) {
    try {
      await api(`/suggestions/${id}`, { method: 'DELETE' });
      setSuggestions((list) => list.filter((s) => s.id !== id));
      onSuccess?.(`« ${title} » retirée des idées`);
    } catch (err) {
      onSuccess?.(err.message, 'error');
    }
  }

  function suggestionMeta(suggestion) {
    const parts = [
      PRIORITY_LABELS[suggestion.priority || 'normal'],
      DURATION_LABELS[suggestion.duration || 'normal'],
    ];
    return parts.join(' · ');
  }

  return (
    <div className={`task-suggestions ${compact ? 'task-suggestions-compact' : ''}`}>
      <div className="task-suggestions-header">
        <span className="task-suggestions-label">
          {compact ? 'Ajouter en 1 tap :' : 'Idées rapides — toucher pour ajouter :'}
        </span>
        {canManage && (
          <button
            type="button"
            className="link-btn task-suggestions-add-toggle"
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? 'Fermer' : '+ Nos idées'}
          </button>
        )}
      </div>

      {canManage && showAdd && (
        <form className="task-suggestion-add-form" onSubmit={handleSaveIdea}>
          <input
            type="text"
            className="input-touch"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nom de la tâche"
            required
          />
          <button type="submit" className="btn btn-secondary btn-touch" disabled={savingIdea || !newTitle.trim()}>
            {savingIdea ? '…' : 'Enregistrer l\'idée'}
          </button>
          {addError && <p className="form-error">{addError}</p>}
        </form>
      )}

      {loadingList ? (
        <p className="hint task-suggestions-loading">Chargement des idées…</p>
      ) : (
        <div className="task-suggestions-list">
          {suggestions.map((suggestion) => {
            const key = suggestion.id ?? suggestion.title;
            const isLoading = loadingTitle === key;
            return (
              <div key={key} className="task-suggestion-chip">
                <button
                  type="button"
                  className="task-suggestion-btn"
                  onClick={() => quickAdd(suggestion)}
                  disabled={isLoading}
                >
                  {isLoading ? '…' : suggestion.title}
                  <span className="suggestion-reward">{suggestionMeta(suggestion)}</span>
                </button>
                {canManage && !suggestion.is_builtin && (
                  <button
                    type="button"
                    className="task-suggestion-remove"
                    onClick={() => handleDeleteIdea(suggestion.id, suggestion.title)}
                    aria-label={`Supprimer l'idée ${suggestion.title}`}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
