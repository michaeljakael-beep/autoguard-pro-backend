// routes/auth.js - Fixed Login with staff_id in JWT
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const transporter = require('../config/emailConfig');
//const multer = require('multer');

// Multer Setup - Disk Storage (Better for MySQL project)
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// STAFF LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email and password are required' 
    });
  }

  try {
    console.log('🔑 Login attempt for:', email.trim().toLowerCase());

    const [rows] = await req.app.get('dbPool').query(
      `SELECT 
        u.staff_id,
        u.national_id,
        u.first_name,
        u.surname,
        u.email,
        u.password,
        u.is_active,
        u.status,
        r.role_name as role
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.role_id 
       WHERE u.email = ?`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const user = rows[0];

    if (user.is_active !== 1 || user.status !== 'approved') {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is inactive or awaiting approval.' 
      });
    }

    // HR Demo Bypass
    if (email.trim().toLowerCase() === 'hr@mansonsecurity.com' && password === 'hr123') {
      const token = jwt.sign(
        { 
          staff_id: user.staff_id,
          national_id: user.national_id,
          first_name: user.first_name,
          surname: user.surname,
          email: user.email,
          role: user.role 
        },
        process.env.JWT_SECRET || 'your-secret-key-change-me',
        { expiresIn: '8h' }
      );

      return res.json({ 
        success: true, 
        token, 
        user: { 
          staff_id: user.staff_id,
          first_name: user.first_name,
          surname: user.surname,
          email: user.email,
          role: user.role 
        }
      });
    }

    const match = await bcrypt.compare(password, user.password || '');
    if (!match) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Main JWT with staff_id
    const token = jwt.sign(
      { 
        staff_id: user.staff_id,
        national_id: user.national_id,
        first_name: user.first_name,
        surname: user.surname,
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key-change-me',
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful → staff_id:', user.staff_id);

    res.json({ 
      success: true, 
      token, 
      user: { 
        staff_id: user.staff_id,
        first_name: user.first_name,
        surname: user.surname,
        email: user.email,
        role: user.role 
      }
    });

  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});
// REGISTER / SIGNUP - Updated with Multer
// REGISTER / SIGNUP - Clean & Improved
router.post('/signup', 
  upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'spouseId', maxCount: 1 },
    { name: 'supportDocs', maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      console.log("=== SIGNUP BODY ===", req.body);
      console.log("=== SIGNUP FILES ===", req.files);

      // Destructure all fields
      const { 
        firstName, surname, email, password, role, phone, idNumber, dob, gender,
        residenceCounty, homeCounty, maritalStatus, schoolLevel, nativeLanguage,
        whyManson, description, howDidYouKnow, refereeFirstName, refereeLastName,
        refereeIdNumber, refereePhone, relationship
      } = req.body;

      console.log("✅ All fields received successfully");

      if (!email || !password) {
        return res.status(400).json({ 
          success: false, 
          message: "Email and password required",
          received: Object.keys(req.body)
        });
      }

      // Check if user already exists
      const [existing] = await req.app.get('dbPool').query('SELECT * FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: "User already exists" });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const staffId = 'Mssl-' + Date.now(); 

      const [result] = await req.app.get('dbPool').query(
        `INSERT INTO users (
          staff_id, first_name, surname, email, password, role_id, 
          phone, national_id, dob, gender, description, 
          residence_county, home_county, marital_status, 
          school_level, native_language, why_manson, 
          how_did_you_know, status
        ) 
        VALUES (?, ?, ?, ?, ?, 
                (SELECT role_id FROM roles WHERE role_name = ?), 
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          staffId, firstName, surname, email.toLowerCase(), hashedPassword, 
          role, phone, idNumber, dob, gender, description,
          residenceCounty, homeCounty, maritalStatus, 
          schoolLevel, nativeLanguage, whyManson, 
          howDidYouKnow
        ]
      );

      res.status(201).json({ 
        success: true, 
        message: "Registration successful! Awaiting approval." 
      });

    } catch (err) {
      console.error('❌ Signup error:', err);
      res.status(500).json({ success: false, message: "Server error during signup" });
    }
  }
);

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const [rows] = await req.app.get('dbPool').query(
      'SELECT first_name FROM users WHERE email = ?', 
      [email.toLowerCase()]
    );

    if (rows.length > 0) {
      const user = rows[0];
      
      // The "Pro" way: Send the actual email
      await transporter.sendMail({
        from: '"Manson Security" <no-reply@mansonsecurity.com>',
        to: email,
        subject: "Password Reset Request",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #0a3d21;">
            <h2>Hello, ${user.first_name}</h2>
            <p>You requested a password reset for your Manson Security account.</p>
            <p>Click the link below to set a new password:</p>
            <a href="http://localhost:5173/reset-password" 
               style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
               Reset Password
            </a>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `
      });
    }

    // Always return success to the frontend for security
    res.json({ success: true, message: "Reset link sent!" });

  } catch (error) {
    console.error("Email Error:", error);
    res.status(500).json({ success: false, message: "Error sending email" });
  }
});
// ==================== GET ALL APPLICATIONS (Admin/HR/Director Only) ====================
// ==================== GET ALL APPLICATIONS (Full Data) ====================
router.get('/applications', async (req, res) => {
  try {
    const [applications] = await req.app.get('dbPool').query(`
      SELECT 
        u.staff_id,
        u.first_name AS firstName,
        u.surname,
        u.email,
        u.phone,
        u.national_id AS idNumber,
        u.dob,
        u.gender,
        r.role_name AS role,
        u.description,
        u.why_manson AS whyManson,
        u.school_level AS schoolLevel,
        u.native_language AS nativeLanguage,
        u.residence_county AS residenceCounty,
        u.home_county AS homeCounty,
        u.marital_status AS maritalStatus,
        u.how_did_you_know AS howDidYouKnow,
        u.referee_name AS refereeName,
        u.referee_national_id AS refereeIdNumber,
        u.referee_phone AS refereePhone,
        u.status,
        u.created_at AS createdAt,
        u.id_front AS idFrontPath,
        u.id_back AS idBackPath,
        u.spouse_id AS spouseIdPath,
        u.support_docs AS supportDocsPaths,
        u.client_Location AS clientLocation,     -- if exists
        u.about_me                                 -- backup for description
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.role_id
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      count: applications.length,
      data: applications
    });

  } catch (err) {
    console.error('❌ Error fetching applications:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching applications',
      error: err.message
    });
  }
});
// ==================== SERVE UPLOADED FILES ====================
// This allows images and documents to be viewed in the Admin panel
//const path = require('path');
const fs = require('fs');

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files
router.use('/uploads', express.static(uploadsDir));
// ==================== APPROVE APPLICATION ====================
router.put('/applications/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await req.app.get('dbPool').query(
      `UPDATE new_users 
       SET status = 'approved', 
           is_active = 1,
           updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.json({
      success: true,
      message: 'Application approved successfully'
    });

  } catch (err) {
    console.error('❌ Approve error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while approving application'
    });
  }
});


// ==================== REJECT APPLICATION ====================
router.put('/applications/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;   // Optional rejection reason

    const [result] = await req.app.get('dbPool').query(
      `UPDATE new_users 
       SET status = 'rejected', 
           is_active = 0,
           updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    res.json({
      success: true,
      message: 'Application rejected successfully'
    });

  } catch (err) {
    console.error('❌ Reject error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting application'
    });
  }
});

module.exports = router;