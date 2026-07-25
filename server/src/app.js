const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const publicLeadsRoutes = require('./routes/publicLeads');
const leadsRoutes = require('./routes/leads');
const usersRoutes = require('./routes/users');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/public/leads', publicLeadsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/users', usersRoutes);

// Central error handler - keeps stack traces out of API responses.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
