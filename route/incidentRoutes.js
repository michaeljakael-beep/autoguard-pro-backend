// route/incidentRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const { authenticate } = require('../middleware/auth');

// ====================== MULTER CONFIG ======================
const uploadDir = 'uploads/incidents';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// ====================== DB POOL MIDDLEWARE ======================
router.use((req, res, next) => {
  req.dbPool = req.app.get('dbPool');
  if (!req.dbPool) {
    return res.status(500).json({ 
      success: false, 
      message: 'Database connection error' 
    });
  }
  next();
});

// ====================== GET ALL INCIDENTS ======================
router.get('/', authenticate, async (req, res) => {
  try {
    const [incidents] = await req.dbPool.query(`
      SELECT 
        id,
        staff_id, 
        title, 
        description, 
        incident_type AS incidentType,
        location, 
        incident_date AS incidentDate, 
        reported_by,
        latitude,
        longitude,
        created_at, 
        status, 
        images
      FROM incidents 
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: incidents || []
    });
  } catch (error) {
    console.error("❌ Error fetching incidents:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch incidents" 
    });
  }
});

// ====================== GET MY INCIDENTS ======================
router.get('/my', authenticate, async (req, res) => {
  try {
    const userId = req.user?.staff_id || req.user?.user_id || req.user?.id;

    const [incidents] = await req.dbPool.query(`
      SELECT 
        id,
        staff_id,
        title, 
        description, 
        incident_type AS incidentType,
        location, 
        incident_date AS incidentDate, 
        reported_by,
        latitude,
        longitude,
        created_at, 
        status, 
        images
      FROM incidents 
      WHERE staff_id = ? OR reported_by = ?
      ORDER BY created_at DESC
    `, [userId, userId]);

    res.json({
      success: true,
      data: incidents || []
    });
  } catch (error) {
    console.error("❌ Error fetching my incidents:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch your incidents" 
    });
  }
});

// ====================== CREATE NEW INCIDENT ======================
router.post('/', 
  authenticate, 
  upload.array('photos', 5),
  async (req, res) => {
    try {
      const { 
        title, 
        description, 
        incident_type, 
        location, 
        incident_date,
        latitude,
        longitude 
      } = req.body;

      const staffId = req.user?.staff_id || req.user?.user_id || req.user?.id;

      if (!staffId) {
        return res.status(401).json({
          success: false,
          message: "User authentication failed: staff_id not found"
        });
      }

      const imagePaths = req.files ? 
        req.files.map(file => `/uploads/incidents/${file.filename}`) : [];

      // Validation
      if (!description?.trim()) {
        return res.status(400).json({ 
          success: false, 
          message: "Description is required" 
        });
      }

      if (!location?.trim()) {
        return res.status(400).json({ 
          success: false, 
          message: "Location is required" 
        });
      }

      const [result] = await req.dbPool.query(`
        INSERT INTO incidents 
        (title, description, incident_type, location, incident_date, 
         staff_id, reported_by, images, latitude, longitude, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `, [
        title?.trim() || 'Untitled Incident',
        description.trim(),
        incident_type || 'security',
        location.trim(),
        incident_date || new Date().toISOString().split('T')[0],
        staffId,
        staffId,
        JSON.stringify(imagePaths),
        latitude || null,
        longitude || null
      ]);

      const newIncident = {
        id: result.insertId,
        title: title?.trim() || 'Untitled Incident',
        description: description.trim(),
        incidentType: incident_type || 'security',
        location: location.trim(),
        incidentDate: incident_date || new Date().toISOString().split('T')[0],
        staff_id: staffId,
        reported_by: staffId,
        latitude: latitude || null,
        longitude: longitude || null,
        images: imagePaths,
        status: 'pending',
        created_at: new Date()
      };

      // Real-time notification
      const io = req.app.get('io');
      if (io) {
        io.emit('new-incident', newIncident);
      }

      res.status(201).json({
        success: true,
        message: "Incident reported successfully",
        data: newIncident
      });

    } catch (error) {
      console.error("❌ Incident creation error:", error);

      if (error instanceof multer.MulterError) {
        return res.status(400).json({ 
          success: false, 
          message: error.message 
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to report incident. Please try again."
      });
    }
  }
);

// ====================== UPDATE INCIDENT STATUS ======================
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const [result] = await req.dbPool.query(
      'UPDATE incidents SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Incident not found" 
      });
    }

    res.json({ 
      success: true, 
      message: `Incident marked as ${status}` 
    });
  } catch (error) {
    console.error("❌ Status update error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update incident status" 
    });
  }
});
// ====================== NEW: RECENT INCIDENTS ======================
router.get('/recent', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');
    const limit = parseInt(req.query.limit) || 5;

    const [recentIncidents] = await db.query(`
      SELECT 
        id,
        title,
        incident_type AS type,
        location,
        status,
        created_at,
        description
      FROM incidents 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [limit]);

    // Format time for frontend display
    const formatted = recentIncidents.map(inc => ({
      ...inc,
      time: inc.created_at 
        ? new Date(inc.created_at).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) 
        : ''
    }));

    res.json(formatted);

  } catch (error) {
    console.error('❌ Recent Incidents Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recent incidents' 
    });
  }
});

module.exports = router;