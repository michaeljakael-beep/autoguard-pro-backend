// routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.use((req, res, next) => {
  req.dbPool = req.app.get('dbPool');
  if (!req.dbPool) return res.status(500).json({ success: false, message: 'Database error' });
  next();
});

// GET Attendance Records
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, search } = req.query;

    let sql = `
      SELECT 
        staff_id,
        date,
        status,
        check_in AS checkInTime,
        check_out AS checkOutTime,
        notes,
        TIMEDIFF(check_out, check_in) AS duration
      FROM attendance
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (search) {
      sql += ` AND staff_id LIKE ?`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY date DESC, check_in DESC`;

    const [records] = await req.dbPool.query(sql, params);

    res.json({
      success: true,
      data: records
    });

  } catch (error) {
    console.error("Attendance Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch attendance" });
  }
});

module.exports = router;