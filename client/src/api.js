const TOKEN_KEY = 'talkeo-token';
const ROLE_KEY = 'talkeo-role';
const LABEL_KEY = 'talkeo-label';
const AUTHOR_KEY = 'talkeo-author';

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

export function getStoredAuth() {
  return {
    token: localStorage.getItem(TOKEN_KEY),
    role: localStorage.getItem(ROLE_KEY),
    label: localStorage.getItem(LABEL_KEY),
    author: localStorage.getItem(AUTHOR_KEY) || 'Maman',
  };
}

export function saveAuth(token, role, label) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(LABEL_KEY, label);
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

export const PRIORITY_LABELS = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
};
