const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Resolve database path
const defaultDbPath = path.resolve(__dirname, '../database/taskboard.db');
const dbPath = process.env.DB_PATH ? path.resolve(process.cwd(), process.env.DB_PATH) : defaultDbPath;

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite connection
const db = new Database(dbPath, {
  // verbose: process.env.NODE_ENV === 'development' ? console.log : null
});

// Explicitly enable foreign keys
db.pragma('foreign_keys = ON;');
db.pragma('journal_mode = WAL;');

// Initialize schema if tables don't exist
const schemaPath = path.resolve(__dirname, '../database/schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

// Auto-seed if database is completely empty (no users)
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount && userCount.count === 0) {
  const seedPath = path.resolve(__dirname, '../database/seed.sql');
  if (fs.existsSync(seedPath)) {
    const seed = fs.readFileSync(seedPath, 'utf8');
    db.exec(seed);
    console.log('Database initialized and seeded with demo data.');
  }
}

module.exports = db;
