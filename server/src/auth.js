import { verifyLogin } from './credentials.js';

export function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  const role = verifyLogin(token);
  if (!role) {
    return res.status(403).json({ error: 'Code incorrect' });
  }

  req.role = role;
  req.token = token;
  next();
}

export function checkRole(role) {
  return (req, res, next) => {
    if (req.role !== role && req.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };
}

export { verifyLogin as verifyToken } from './credentials.js';
