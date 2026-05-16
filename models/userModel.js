// backend/models/userModel.js
const db = require('../config/db');

const User = {
  findById: async (id) => {
    const [rows] = await db.execute(`
      SELECT u.id, u.name, u.email, u.role_id, r.role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.role_id 
      WHERE u.id = ?`, [id]);
    return rows[0];
  },

  findByEmail: async (email) => {
    const [rows] = await db.execute(`
      SELECT u.*, r.role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.role_id 
      WHERE u.email = ?`, [email]);
    return rows[0];
  }
};

module.exports = User;