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
    <div className="cursor-app login-app">
      <header className="titlebar">
        <div className="titlebar-menus">
          <span>File</span><span>Edit</span><span>View</span><span>Help</span>
        </div>
        <div className="titlebar-center">Talkeo</div>
        <div className="titlebar-actions" />
      </header>

      <div className="login-body">
        <div className="login-card">
          <div className="login-brand">
            <div className="cursor-logo">T</div>
            <div>
              <h1>Talkeo</h1>
              <p>Connectez-vous pour continuer</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="token">Code d&apos;accès</label>
            <div className="composer-box login-input">
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Entrez votre code secret…"
                autoFocus
                required
              />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-primary-inline full" disabled={loading}>
              {loading ? 'Connexion…' : 'Continuer'}
            </button>
          </form>

          <p className="login-foot">Parents : utilisez le code qu&apos;Arron vous a donné.</p>
        </div>
      </div>
    </div>
  );
}
