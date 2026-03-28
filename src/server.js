'use strict';

const fs   = require('fs');
const path = require('path');

const { createDatabase } = require('./database');
const { seedDatabase }   = require('./seed');
const { createApp }      = require('./app');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db  = createDatabase();
seedDatabase(db);
const app = createApp(db);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚽  Soccer Manager running on http://localhost:${PORT}`);
});
