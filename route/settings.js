// route/settings.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// ====================== GET SETTINGS ======================
router.get('/', authenticate, async (req, res) => {
  try {
    const dbPool = req.app.get('dbPool');
    const staffId = req.user?.staff_id || req.user?.user_id || req.user?.id;

    if (!staffId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User ID not found in authentication token' 
      });
    }

    console.log(`🔍 Fetching settings for staff_id: ${staffId}`);

    const [rows] = await dbPool.query(`
      SELECT 
        staff_id,
        first_name,
        surname,
        CONCAT(COALESCE(first_name, ''), ' ', COALESCE(surname, '')) AS fullName,
        email,
        phone,
        national_id,
        profile_picture,
        role_id AS role,
        native_language,
        notifications,
        darkMode
      FROM users 
      WHERE staff_id = ?
    `, [staffId]);

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const user = rows[0];

    res.json({
      success: true,
      fullName: user.fullName.trim(),
      email: user.email,
      profilePicture: user.profile_picture 
        ? `/uploads/profile_pictures/${user.profile_picture}` 
        : null,
      staff_id: user.staff_id,
      national_id: user.national_id,
      role: user.role,
      settings: {
        language: user.native_language || 'en',
        notifications: Boolean(user.notifications),
        darkMode: Boolean(user.darkMode),
      }
    });

  } catch (error) {
    console.error('❌ Settings fetch error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load settings' 
    });
  }
});

// ====================== UPDATE SETTINGS ======================
router.put('/', authenticate, async (req, res) => {
  try {
    const dbPool = req.app.get('dbPool');
    const staffId = req.user?.staff_id || req.user?.user_id || req.user?.id;

    if (!staffId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User ID not found in token' 
      });
    }

    const { language, notifications, darkMode } = req.body;

    await dbPool.query(`
      UPDATE users 
      SET 
        native_language = ?,
        notifications = ?,
        darkMode = ?
      WHERE staff_id = ?
    `, [
      language || 'en',
      notifications ? 1 : 0,
      darkMode ? 1 : 0,
      staffId
    ]);

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('❌ Settings update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update settings' 
    });
  }
});

module.exports = router;