const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create test database
const dbPath = path.join(__dirname, '..', 'test-database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Creating test SQLite database...');

db.serialize(() => {
  // Create users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create products table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create orders table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    total_price REAL NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);

  // Insert sample data
  const stmt = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)");
  stmt.run("John Doe", "john@example.com");
  stmt.run("Jane Smith", "jane@example.com");
  stmt.run("Bob Johnson", "bob@example.com");
  stmt.finalize();

  const productStmt = db.prepare("INSERT INTO products (name, price, stock) VALUES (?, ?, ?)");
  productStmt.run("Widget", 9.99, 100);
  productStmt.run("Gadget", 19.99, 50);
  productStmt.run("Doohickey", 14.99, 75);
  productStmt.run("Thingamajig", 24.99, 30);
  productStmt.finalize();

  const orderStmt = db.prepare("INSERT INTO orders (user_id, product_id, quantity, total_price) VALUES (?, ?, ?, ?)");
  orderStmt.run(1, 1, 2, 19.98);
  orderStmt.run(2, 2, 1, 19.99);
  orderStmt.run(1, 3, 3, 44.97);
  orderStmt.finalize();

  console.log('✅ Test database created successfully at:', dbPath);
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('Database connection closed.');
  }
});