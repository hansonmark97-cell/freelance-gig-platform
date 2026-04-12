const express = require('express');

const app = express();
app.use(express.json());

app.use('/api/users', require('./routes/users'));
app.use('/api/gigs', require('./routes/gigs'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/bids', require('./routes/bids'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/payments', require('./routes/payments'));

module.exports = app;
