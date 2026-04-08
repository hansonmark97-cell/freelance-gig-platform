const express = require('express');
const path = require('path');

const usersRouter = require('./routes/users');
const gigsRouter = require('./routes/gigs');
const jobsRouter = require('./routes/jobs');
const bidsRouter = require('./routes/bids');
const reviewsRouter = require('./routes/reviews');

const app = express();

app.use(express.json());
app.use(express.static('public'));

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
