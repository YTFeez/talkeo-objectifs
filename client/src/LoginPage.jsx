import { useState } from 'react';
import { api, saveAuth } from './api';

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
      onLogin({ role, label });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="logo lg">T</div>
          <div>
            <h1>Talkeo</h1>
            <p>Objectifs partagés en famille</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="token">Votre code d&apos;accès</label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Code secret"
            autoFocus
            required
          />
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-primary full" disabled={loading}>
            {loading ? 'Connexion…' : 'Entrer'}
          </button>
        </form>

        <div className="login-help">
          <p><strong>Parents</strong> — ajoutez des objectifs pour Arron</p>
          <p><strong>Arron</strong> — gérez et cochez les objectifs</p>
        </div>
      </div>
    </div>
  );
}
