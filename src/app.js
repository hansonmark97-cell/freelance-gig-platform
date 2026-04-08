'use strict';

const express = require('express');
const path = require('path');

const usersRouter = require('./routes/users');
const gigsRouter = require('./routes/gigs');
const jobsRouter = require('./routes/jobs');
const bidsRouter = require('./routes/bids');
const reviewsRouter = require('./routes/reviews');
const paymentsRouter = require('./routes/payments');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/users', usersRouter);
app.use('/api/gigs', gigsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/bids', bidsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/payments', paymentsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = app;
