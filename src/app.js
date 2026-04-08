'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRouter     = require('./routes/auth');
const usersRouter    = require('./routes/users');
const loadsRouter    = require('./routes/loads');
const routesRouter   = require('./routes/routes');
const matchesRouter  = require('./routes/matches');
const bookingsRouter = require('./routes/bookings');
const reviewsRouter  = require('./routes/reviews');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth',     authRouter);
app.use('/api/users',    usersRouter);
app.use('/api/loads',    loadsRouter);
app.use('/api/routes',   routesRouter);
app.use('/api/matches',  matchesRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/reviews',  reviewsRouter);

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
