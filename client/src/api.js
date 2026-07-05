const TOKEN_KEY = 'talkeo-token';
const ROLE_KEY = 'talkeo-role';
const LABEL_KEY = 'talkeo-label';
const AUTHOR_KEY = 'talkeo-author';

export const ROLE_LABELS = {
  admin: 'Aronne',
  parent: 'Parent',
};

const LEGACY_KEYS = {
  'parent-todos-token': TOKEN_KEY,
  'parent-todos-role': ROLE_KEY,
  'parent-todos-label': LABEL_KEY,
  'parent-todos-author': AUTHOR_KEY,
};

function migrateLegacyStorage() {
  for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
    const value = localStorage.getItem(oldKey);
    if (value && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, value);
    }
    localStorage.removeItem(oldKey);
  }
}

migrateLegacyStorage();

function normalizeLabel(role, label) {
  if (role === 'admin') return ROLE_LABELS.admin;
  if (label === 'Arron') return ROLE_LABELS.admin;
  return label || ROLE_LABELS.parent;
}

function migrateStoredLabel() {
  const role = localStorage.getItem(ROLE_KEY);
  const label = localStorage.getItem(LABEL_KEY);
  if (!role || !label) return;
  const normalized = normalizeLabel(role, label);
  if (normalized !== label) {
    localStorage.setItem(LABEL_KEY, normalized);
  }
}

migrateStoredLabel();

export function getRoleLabel(role, label) {
  return normalizeLabel(role, label);
}

export function getStoredAuth() {
  const role = localStorage.getItem(ROLE_KEY);
  const label = localStorage.getItem(LABEL_KEY);
  return {
    token: localStorage.getItem(TOKEN_KEY),
    role,
    label: normalizeLabel(role, label),
    author: localStorage.getItem(AUTHOR_KEY) || 'Maman',
  };
}

export function saveAuth(token, role, label) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(LABEL_KEY, normalizeLabel(role, label));
}

export function saveAuthor(author) {
  localStorage.setItem(AUTHOR_KEY, author);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(LABEL_KEY);
}

export async function api(path, options = {}) {
  const { token } = getStoredAuth();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Auth-Token': token } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur réseau');
  return data;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDue(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Aujourd'hui ${time}`;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isOverdue(dueAt) {
  if (!dueAt) return false;
  const d = new Date(dueAt.includes('T') ? dueAt : dueAt.replace(' ', 'T') + 'Z');
  return d < new Date();
}

export function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const PRIORITY_LABELS = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
};

export const DURATION_LABELS = {
  short: 'Faible',
  normal: 'Normale',
  long: 'Longue',
};

export const DURATION_HINTS = {
  short: '~15 min',
  normal: '~1 h',
  long: 'Plusieurs h',
};
