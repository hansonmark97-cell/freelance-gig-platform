const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('JWT_SECRET environment variable is required in production'); })()
  : 'dev-secret');

module.exports = { JWT_SECRET };
