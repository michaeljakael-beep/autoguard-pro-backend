const db = require('../config/db');

const Role = {
  getAll: async () => {
    const [rows] = await db.execute("SELECT * FROM roles");
    return rows;
  }
};

module.exports = Role;