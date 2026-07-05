import { useState } from 'react';
import { getStoredAuth, clearAuth, getRoleLabel } from './api';
import { ToastProvider } from './useToast.jsx';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';

export default function App() {
  const stored = getStoredAuth();
  const [auth, setAuth] = useState(
    stored.token && stored.role
      ? { role: stored.role, label: getRoleLabel(stored.role, stored.label) }
      : null,
  );

  function handleLogout() {
    clearAuth();
    setAuth(null);
  }

  return (
    <ToastProvider>
      {!auth ? (
        <LoginPage onLogin={setAuth} />
      ) : (
        <Dashboard auth={auth} onLogout={handleLogout} />
      )}
    </ToastProvider>
  );
}
