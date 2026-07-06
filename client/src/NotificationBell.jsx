import { useState, useEffect, useCallback } from 'react';
import { api } from './api';

export default function NotificationBell({ isMobile }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    api('/notifications')
      .then((d) => {
        setItems(d.notifications || []);
        setUnread(d.unread || 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  async function markAll() {
    await api('/notifications/read-all', { method: 'POST' });
    load();
  }

  return (
    <div className={`notification-bell ${isMobile ? 'mobile' : ''}`}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && <span className="notification-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <>
          <button type="button" className="notification-backdrop" onClick={() => setOpen(false)} aria-label="Fermer" />
          <div className="notification-panel">
            <div className="notification-panel-header">
              <strong>Notifications</strong>
              {unread > 0 && (
                <button type="button" className="link-btn" onClick={markAll}>Tout lire</button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="hint notification-empty">Rien pour l&apos;instant</p>
            ) : (
              <ul className="notification-list">
                {items.map((n) => (
                  <li key={n.id} className={n.read ? '' : 'unread'}>
                    <strong>{n.title}</strong>
                    {n.body && <p className="hint">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
