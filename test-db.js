// config/db.js  (or db.js)
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Vq3x5p@2022.',
  database: process.env.DB_NAME || 'autoguard_pro_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  connectTimeout: 20000,
  timezone: 'Z',
  // Optional: Enable debug mode during development
  // debug: process.env.NODE_ENV === 'development'
});

// Test the connection when the module is loaded
(async () => {
  try {
    const connection = await pool.getConnection();
    
    console.log('✅ Database pool created successfully');
    
    // Run basic tests
    const [testResult] = await connection.query('SELECT 1 + 1 AS result');
    console.log('✅ Database test query successful:', testResult[0].result);

    // Check important tables
    const [tables] = await connection.query(`
      SHOW TABLES LIKE 'new_users'
    `);
    
    console.log('📋 new_users table exists?', tables.length > 0 ? '✅ Yes' : '❌ No');

    const [usersTable] = await connection.query(`
      SHOW TABLES LIKE 'users'
    `);
    console.log('📋 users table exists?', usersTable.length > 0 ? '✅ Yes' : '❌ No');

    connection.release();

  } catch (err) {
    console.error('❌ Database connection FAILED:', err.message);
    console.error('Please check your .env file and database credentials');
  }
})();

// Export the pool so it can be used in server.js and routes
module.exports = pool;