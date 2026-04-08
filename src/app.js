const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const usersRouter = require('./routes/users');
const gigsRouter = require('./routes/gigs');
const jobsRouter = require('./routes/jobs');
const bidsRouter = require('./routes/bids');
const reviewsRouter = require('./routes/reviews');

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json());
app.use(express.static('public'));
app.use('/api/', limiter);

app.use('/api/users', usersRouter);
app.use('/api/gigs', gigsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/bids', bidsRouter);
app.use('/api/reviews', reviewsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
