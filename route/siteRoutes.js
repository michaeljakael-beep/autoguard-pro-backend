// routes/siteRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    // Better way: Use the model instead of direct db access
    const db = require('../config/db');   // ← Import directly

    const [sites] = await db.query(`
      SELECT 
        site_id,
        site_name,
        zone,
        county,
        region,
        address,
        status
      FROM sites 
      WHERE status = 'active' 
      ORDER BY site_name ASC
    `);

    res.json(sites);
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ 
      message: 'Failed to fetch sites',
      error: error.message 
    });
  }
});

module.exports = router;