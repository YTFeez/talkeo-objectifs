import { useState } from 'react';
import { api, saveAuth, getStoredAuth, getRoleLabel } from './api';

export default function SettingsModal({ onClose, onPasswordChanged }) {
  const { role, label } = getStoredAuth();
  const displayLabel = getRoleLabel(role, label);
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Changer le mot de passe</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="hint">Modifier votre code d&apos;accès ({displayLabel}).</p>
            <label className="field-label">
              Code actuel
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
            </label>
            <label className="field-label">
              Nouveau code
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={4} />
            </label>
            <label className="field-label">
              Confirmer
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </label>
            {error && <p className="form-error">{error}</p>}
            {success && <p className="form-success">{success}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
