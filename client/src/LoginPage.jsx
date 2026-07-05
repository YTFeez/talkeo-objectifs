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
    <div className="login-page v2-login">
      <div className="login-bg" aria-hidden />
      <div className="login-content">
        <div className="login-brand">
          <span className="login-logo">T</span>
          <h1>Talkeo</h1>
          <p className="login-tagline">Objectifs familiaux · récompenses · agenda</p>
        </div>

        <div className="card login-card">
          <form onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="token">Code d&apos;accès</label>
            <PasswordInput
              id="token"
              className="input-touch"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Entrez votre code secret"
              autoFocus
              required
            />
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block btn-touch login-submit" disabled={loading}>
              {loading ? 'Connexion…' : 'Entrer'}
            </button>
          </form>
        </div>

        <div className="login-roles">
          <div className="login-role-card">
            <span className="login-role-icon">👨‍👩‍👧</span>
            <div>
              <strong>Parents</strong>
              <p>Ajoutent les objectifs, valident quand c&apos;est fait, planifient les événements.</p>
            </div>
          </div>
          <div className="login-role-card accent">
            <span className="login-role-icon">⭐</span>
            <div>
              <strong>{ROLE_LABELS.admin}</strong>
              <p>Suit ses tâches, consulte l&apos;argent de poche et l&apos;historique.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
