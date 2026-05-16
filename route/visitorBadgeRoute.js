// route/visitorBadgeRoute.js
const express = require('express');
const router = express.Router();

// Get All Visitor Badges
router.get('/badges', async (req, res) => {
  try {
    const [badges] = await req.app.get('dbPool').query(`
      SELECT * FROM visitor_badges 
      ORDER BY issued_at DESC
    `);
    
    res.json({
      success: true,
      count: badges.length,
      data: badges
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch badges' });
  }
});

// Get Active Badges Only
router.get('/badges/active', async (req, res) => {
  try {
    const [badges] = await req.app.get('dbPool').query(`
      SELECT * FROM visitor_badges 
      WHERE status = 'Active' 
      ORDER BY issued_at DESC
    `);
    
    res.json({
      success: true,
      count: badges.length,
      data: badges
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch active badges' });
  }
});

// Get Single Badge by ID
router.get('/badges/:badgeId', async (req, res) => {
  try {
    const [badge] = await req.app.get('dbPool').query(
      'SELECT * FROM visitor_badges WHERE badge_id = ?', 
      [req.params.badgeId]
    );
    
    if (badge.length === 0) {
      return res.status(404).json({ success: false, message: 'Badge not found' });
    }
    
    res.json({ success: true, data: badge[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Get Recent Visitors (Matching the frontend call)
router.get('/recent', async (req, res) => {
  try {
    // Assuming you want the 5 most recent badges
    const [badges] = await req.app.get('dbPool').query(`
      SELECT * FROM visitor_badges 
      ORDER BY issued_at DESC 
      LIMIT 5
    `);
    
    // The frontend code in image_1e1390.png expects an array 
    // to perform .slice(0, 5) on it.
    res.json(badges); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch recent badges' });
  }
});

module.exports = router;