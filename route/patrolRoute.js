// route/patrolRoute.js
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');

// ====================== MULTER SETUP ======================
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, 'patrol_' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// ====================== DATABASE CONNECTION ======================
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Vq3x5p@2022.',           // ← Change if you have a password
  database: 'autoguard_pro_db'
});

// ====================== ROUTES ======================

// Get All Active Sites -> GET /api/patrols/sites
router.get('/sites', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT site_id, site_name, county, region 
      FROM sites 
      WHERE status = 'active' 
      ORDER BY site_name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get Guards / Staff -> GET /api/patrols/guards
router.get('/guards', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id, name, site_id 
      FROM staff 
      WHERE (role LIKE '%guard%' OR role LIKE '%security%') 
        AND status = 'active'
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.json([]); 
  }
});

// Get All Patrol Reports -> GET /api/patrols/
// Note: Changed path from '/patrols' to '/'
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        id,
        user_id as staff_id,
        notes as description,
        report_time as visit_time,
        checklist,
        created_at
      FROM patrol_reports 
      ORDER BY report_time DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create New Patrol -> POST /api/patrols/
// Note: Changed path from '/patrols' to '/'
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { site_id, staff_id, visit_time, description, guard_approved } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const checklistData = {
      type: "supervisor_patrol",
      guard_approved: guard_approved === 'true' || guard_approved === true,
      supervisor_name: "Supervisor GISORE",
      image_url: image_url,
      submitted_at: new Date()
    };

    const [result] = await db.query(`
      INSERT INTO patrol_reports (user_id, checklist, notes, report_time)
      VALUES (?, ?, ?, ?)
    `, [
      staff_id || 'SUPERVISOR',
      JSON.stringify(checklistData),
      description || '',
      visit_time || new Date()
    ]);

    res.status(201).json({
      success: true,
      message: 'Patrol logged successfully',
      id: result.insertId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Submit Guard Checklist -> POST /api/patrols/:patrolId/checklist
// Note: Changed path from '/patrols/:patrolId/checklist' to '/:patrolId/checklist'
router.post('/:patrolId/checklist', async (req, res) => {
  try {
    const { patrolId } = req.params;
    const { uniform, id_card, torch, radio, gate_locked, visitors_log, incident_report, remarks } = req.body;

    const checklistPayload = {
      uniform, id_card, torch, radio, gate_locked,
      visitors_log, incident_report, remarks,
      submitted_at: new Date(),
      submitted_by: "Supervisor"
    };

    await db.query(`
      UPDATE patrol_reports 
      SET checklist = JSON_SET(
        IFNULL(checklist, '{}'),
        '$.guard_checklist', ?,
        '$.status', 'completed'
      )
      WHERE id = ?
    `, [JSON.stringify(checklistPayload), patrolId]);

    res.json({
      success: true,
      message: 'Checklist submitted successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;