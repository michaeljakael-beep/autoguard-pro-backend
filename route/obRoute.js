// routes/obRoute.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

// Multer Setup
const storage = multer.diskStorage({
  destination: 'uploads/ob/',
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ====================== AUTH MIDDLEWARE ======================
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT Error:", err.message);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// ====================== SUBMIT OB ======================
router.post('/submit', authenticateJWT, upload.single('image'), async (req, res) => {
  try {
    const { staff_id, site_id, shift_type, latitude, longitude, description } = req.body;
    const dbPool = req.app.get('dbPool');

    const isLate = (new Date().getHours() === 6 || new Date().getHours() === 18) && new Date().getMinutes() > 30;
    const image_url = req.file ? `/uploads/ob/${req.file.filename}` : null;

    await dbPool.execute(`
      INSERT INTO ob_reports 
      (staff_id, site_id, shift_type, latitude, longitude, description, image_url, is_late, device_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [staff_id, site_id, shift_type || 'Day', latitude || 0, longitude || 0, description, image_url, isLate, req.headers['user-agent']]);

    res.status(201).json({ message: 'OB submitted successfully' });
  } catch (err) {
    console.error("Submit Error:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ====================== GET SITES ======================
router.get('/sites', authenticateJWT, async (req, res) => {
  try {
    const dbPool = req.app.get('dbPool');
    const [rows] = await dbPool.execute(`
      SELECT site_id, site_name, zone, county, region 
      FROM sites ORDER BY region, county, site_name
    `);
    res.json(rows);
  } catch (err) {
    console.error("Sites Error:", err);
    res.status(500).json({ message: "Failed to fetch sites" });
  }
});

// ====================== GET REPORTS (Fixed) ======================
router.get('/reports', authenticateJWT, async (req, res) => {
  try {
    const dbPool = req.app.get('dbPool');
    const { role, staff_id, site_id } = req.user || {};

    let query = 'SELECT * FROM ob_reports WHERE 1=1';
    const params = [];

    if (role === 'Guard' || role.toLowerCase() === 'guard') {
      query += ' AND staff_id = ?';
      params.push(staff_id);
    } 
    else if (role === 'Supervisor' || role.toLowerCase() === 'supervisor') {
      query += ' AND site_id = ?';
      params.push(site_id);
    }
    // Director and Admin see all

    query += ' ORDER BY report_time DESC';

    const [rows] = await dbPool.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Reports Error:", err);
    res.status(500).json({ message: 'Failed to fetch reports', error: err.message });
  }
});

module.exports = router;