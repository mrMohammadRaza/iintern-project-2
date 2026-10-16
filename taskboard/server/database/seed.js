const fs = require('fs');
const path = require('path');
const db = require('../config/db');

try {
  const seedPath = path.resolve(__dirname, 'seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf8');
  db.exec(seedSql);
  console.log('✅ Database successfully re-seeded with demo data!');
  console.log('Demo accounts:');
  console.log('  1. demo@taskboard.com / password123 (Owner of Board 1)');
  console.log('  2. alice@taskboard.com / password123 (Owner of Board 2)');
  console.log('  3. bob@taskboard.com / password123');
  console.log('  4. charlie@taskboard.com / password123');
} catch (error) {
  console.error('Failed to seed database:', error);
  process.exit(1);
}
