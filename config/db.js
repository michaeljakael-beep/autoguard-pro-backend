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

  // ✅ Correct way
  charset: 'utf8mb4'
});

module.exports = pool;