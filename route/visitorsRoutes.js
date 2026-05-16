// routes/visitorsRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.use((req, res, next) => {
  req.dbPool = req.app.get('dbPool');
  if (!req.dbPool) return res.status(500).json({ success: false, message: 'Database error' });
  next();
});

// GET Visitors Log
router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;

    let sql = `
      SELECT 
        id,
        visitor_name AS name,
        purpose,
        host_office AS visitedStaff,
        check_in AS checkIn,
        check_out AS checkOut,
        status,
        phone_number
      FROM visitor_logs
      WHERE 1=1
    `;

    const params = [];

    if (search) {
      sql += ` AND (visitor_name LIKE ? OR purpose LIKE ? OR host_office LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY check_in DESC`;

    const [records] = await req.dbPool.query(sql, params);

    res.json({
      success: true,
      data: records
    });

  } catch (error) {
    console.error("Visitors Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch visitors" });
  }
});

module.exports = router;