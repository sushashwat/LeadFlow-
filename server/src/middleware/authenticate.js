const { verifyToken } = require('../auth');

/**
 * Requires a valid Bearer JWT. Attaches req.user = { id, name, email, role }.
 * This is the SERVER-SIDE enforcement point - the frontend also hides UI it
 * shouldn't show, but every permission decision that actually matters is
 * re-checked here and in authorize(), never trusted from the client alone.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authenticate;
