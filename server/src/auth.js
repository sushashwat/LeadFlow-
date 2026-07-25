const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const EXPIRES_IN = '8h';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken, SECRET };
