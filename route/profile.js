// route/profile.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// ====================== MULTER SETUP FOR PROFILE PICTURE ======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/profile_pictures';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const userId = req.user?.staff_id || req.user?.user_id || 'unknown';
    cb(null, `profile-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only JPG, JPEG, PNG and WebP images are allowed'));
  }
});

// ====================== GET PROFILE ======================
router.get('/', async (req, res) => {
  try {
    const staffId = req.user?.staff_id || req.user?.user_id || req.user?.id;

    if (!staffId) {
      console.log('❌ Profile route: No staff_id or user_id in token', req.user);
      return res.status(401).json({ 
        success: false, 
        message: 'User ID not found in authentication token' 
      });
    }

    const [rows] = await req.app.get('dbPool').query(`
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
        is_active,
        status
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
      user: user
    });

  } catch (err) {
    console.error('❌ Profile GET error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch profile' 
    });
  }
});

// ====================== UPDATE PROFILE ======================
router.put('/', upload.single('profilePicture'), async (req, res) => {
  try {
    const staffId = req.user?.staff_id || req.user?.user_id || req.user?.id;

    if (!staffId) {
      return res.status(401).json({ 
        success: false, 
        message: 'No staff_id in token' 
      });
    }

    const { fullName, email } = req.body;
    let profilePicturePath = null;

    if (req.file) {
      profilePicturePath = req.file.filename;
    }

    const updateFields = [];
    const params = [];

    if (fullName) {
      const nameParts = fullName.trim().split(/\s+/);
      const first_name = nameParts[0] || '';
      const surname = nameParts.slice(1).join(' ') || '';

      updateFields.push('first_name = ?', 'surname = ?');
      params.push(first_name, surname);
    }

    if (email) {
      updateFields.push('email = ?');
      params.push(email);
    }

    if (profilePicturePath) {
      updateFields.push('profile_picture = ?');
      params.push(profilePicturePath);
    }

    if (updateFields.length > 0) {
      params.push(staffId);

      await req.app.get('dbPool').query(`
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE staff_id = ?
      `, params);

      console.log(`✅ Profile updated for staff_id: ${staffId}`);
    }

    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      profilePicture: profilePicturePath ? `/uploads/profile_pictures/${profilePicturePath}` : undefined
    });

  } catch (err) {
    console.error('❌ Profile PUT error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to update profile' 
    });
  }
});

module.exports = router;