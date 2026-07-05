import { useState } from 'react';
import { api, saveAuth, getStoredAuth } from './api';

export default function SettingsModal({ onClose, onPasswordChanged }) {
  const { role, label } = getStoredAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (next !== confirm) {
      setError('Les nouveaux codes ne correspondent pas');
      return;
    }
    if (next.length < 4) {
      setError('Minimum 4 caractères');
      return;
    }

    setLoading(true);
    try {
      const { token: newToken } = await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      saveAuth(newToken, role, label);
      setSuccess('Code mis à jour');
      setCurrent('');
      setNext('');
      setConfirm('');
      onPasswordChanged?.(newToken);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Changer le mot de passe</span>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <p className="modal-desc">Modifier votre code d&apos;accès ({label}).</p>
          <label>
            Code actuel
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Nouveau code
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={4}
            />
          </label>
          <label>
            Confirmer
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary-inline" disabled={loading}>
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
