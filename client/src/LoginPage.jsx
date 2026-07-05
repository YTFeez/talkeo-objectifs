import { useState } from 'react';
import { api, saveAuth, getRoleLabel, ROLE_LABELS } from './api';
import PasswordInput from './PasswordInput';

export default function LoginPage({ onLogin }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { role, label } = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim() }),
      });
      saveAuth(token.trim(), role, label);
      onLogin({ role, label: getRoleLabel(role, label) });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="card-header">
          <span>Talkeo</span>
          <span className="hint">Objectifs partagés</span>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <p className="hint" style={{ marginBottom: 12 }}>
              Entrez votre code d&apos;accès pour continuer.
            </p>
            <label className="field-label" htmlFor="token">Code d&apos;accès</label>
            <PasswordInput
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Code secret"
              autoFocus
              required
            />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12, height: 32 }} disabled={loading}>
              {loading ? 'Connexion…' : 'Entrer'}
            </button>
          </form>
          <div className="divider" />
          <p className="hint"><strong>Parents</strong> — ajoutez des objectifs pour {ROLE_LABELS.admin}</p>
          <p className="hint"><strong>{ROLE_LABELS.admin}</strong> — gérez et cochez les objectifs</p>
        </div>
      </div>
    </div>
  );
}
