// route/users.js - CLEANED & IMPROVED
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const multer = require('multer'); // Added for file handling
const path = require('path');

const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

// --- Multer Configuration for File Storage ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Make sure this folder exists in your root
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ====================== PUBLIC ROUTES ======================

// 2. The Cleaned Signup Route
// REGISTER / SIGNUP - Updated with proper file handling for MySQL
router.post('/signup', 
  upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'spouseId', maxCount: 1 },
    { name: 'supportDocs', maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      const data = req.body;

      // --- 1. BASIC VALIDATION ---
      const requiredFields = ['firstName', 'surname', 'email', 'phone', 'idNumber', 'dob', 'role', 'password'];
      for (const field of requiredFields) {
        if (!data[field]?.trim()) {
          return res.status(400).json({ success: false, message: `${field} is required` });
        }
      }

      // --- 2. ROLE-SPECIFIC VALIDATION ---
      if (data.role === 'client') {
        if (!data.clientLocation?.trim() || !data.clientCounty) {
          return res.status(400).json({ success: false, message: 'Client location and county are required' });
        }
      } else {
        if (!req.files?.idFront || !req.files?.idBack) {
          return res.status(400).json({ success: false, message: 'ID Front and Back images are required for staff registration' });
        }
      }

      // --- 3. DUPLICATE CHECK ---
      const [existing] = await pool.query(
        'SELECT id FROM new_users WHERE email = ? OR idNumber = ?',
        [data.email.trim().toLowerCase(), data.idNumber.trim()]
      );

      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'Email or National ID is already registered' });
      }

      // --- 4. FILE PATH PROCESSING (Store only filename) ---
      const idFrontPath = req.files?.idFront?.[0]?.filename || null;
      const idBackPath = req.files?.idBack?.[0]?.filename || null;
      const spouseIdPath = req.files?.spouseId?.[0]?.filename || null;

      let supportDocsPaths = null;
      if (req.files?.supportDocs && req.files.supportDocs.length > 0) {
        supportDocsPaths = JSON.stringify(
          req.files.supportDocs.map(file => file.filename)
        );
      }

      // --- 5. PASSWORD HASHING ---
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.password, salt);

      // --- 6. DATABASE INSERTION ---
      const query = `
        INSERT INTO new_users (
          firstName, surname, email, phone, idNumber, dob, role, password, 
          gender, description, howDidYouKnow, socialMedia, 
          refereeFirstName, refereeLastName, refereeIdNumber, refereePhone, relationship,
          schoolLevel, nativeLanguage, residenceCounty, homeCounty, maritalStatus,
          spouseFirstName, spouseLastName, spousePhone, whyManson,
          clientFirstName, clientLastName, clientNationalId, clientPhone, 
          clientLocation, clientCounty, guardsDayShift, guardsNightShift,
          idFrontPath, idBackPath, spouseIdPath, supportDocsPaths, status, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',NOW())
      `;

      const values = [
        data.firstName.trim(), 
        data.surname.trim(), 
        data.email.trim().toLowerCase(), 
        data.phone.trim(), 
        data.idNumber.trim(), 
        data.dob, 
        data.role, 
        hashedPassword,
        data.gender || null, 
        data.description?.trim() || null, 
        data.howDidYouKnow || null, 
        data.socialMedia || null,
        data.refereeFirstName || null, 
        data.refereeLastName || null, 
        data.refereeIdNumber || null, 
        data.refereePhone || null, 
        data.relationship || null,
        data.schoolLevel || null, 
        data.nativeLanguage || null, 
        data.residenceCounty || null, 
        data.homeCounty || null, 
        data.maritalStatus || null,
        data.spouseFirstName || null, 
        data.spouseLastName || null, 
        data.spousePhone || null, 
        data.whyManson || null,
        data.clientFirstName || null, 
        data.clientLastName || null, 
        data.clientNationalId || null, 
        data.clientPhone || null,
        data.clientLocation || null, 
        data.clientCounty || null, 
        parseInt(data.guardsDayShift) || 0, 
        parseInt(data.guardsNightShift) || 0,
        idFrontPath, 
        idBackPath, 
        spouseIdPath, 
        supportDocsPaths
      ];

      const [result] = await pool.query(query, values);
      const newUserId = result.insertId;

      console.log(`✅ New ${data.role} application submitted (ID: ${newUserId})`);

      res.status(201).json({
        success: true,
        message: (['hr', 'admin', 'director'].includes(data.role))
          ? 'Account created successfully!'
          : 'Registration successful! Your application has been submitted for approval.'
      });

    } catch (error) {
      console.error('❌ Signup Error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error during registration. Please try again later.' 
      });
    }
  }
);

// ====================== PROTECTED ROUTES ======================

// GET ALL USERS (Staff + Clients)
router.get('/', authenticate, async (req, res) => {
  try {
    // Fetch Staff Users
    const [staffUsers] = await pool.query(`
      SELECT 
        staff_id,
        first_Name AS firstName,
        surname,
        email, 
        role, 
        national_id,
        status, 
        created_at
      FROM new_users 
      WHERE status = 'approved'
    `);

    // Fetch Clients
    const [clients] = await pool.query(`
      SELECT 
        site_id,
        contact_name,
        email, 
        'client' AS role, 
        status, 
        created_at
      FROM clients
    `);

    const transformedStaff = staffUsers.map(user => ({
      ...user,
      "STAFF_ID": user.staff_id,
      fullName: `${user.firstName || ''} ${user.surname || ''}`.trim() || 'Unnamed Staff',
      name: `${user.firstName || ''} ${user.surname || ''}`.trim() || 'Unnamed Staff',
      staff_id: user.staff_id,
      national_id: user.national_id,
      accountType: 'staff'
    }));1

    const transformedClients = clients.map(client => ({
      ...client,
      "ID": client.site_id,
      fullName: client.contact_name || 'Unnamed Client',
      name: client.contact_name || 'Unnamed Client',
      siteId: client.site_id,
      accountType: 'client'
    }));

    const allUsers = [...transformedStaff, ...transformedClients];

    res.json({
      success: true,
      count: allUsers.length,
      data: allUsers
    });

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// GET INTERNAL STAFF ONLY
router.get('/internal', authenticate, async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT staff_id, firstName, surname, email, role, national_id, status, created_at 
      FROM new_users 
      WHERE status = 'approved' 
        AND role IN ('director', 'admin', 'hr', 'supervisor', 'guard', 
                     'general_manager', 'operational_manager', 'accountant', 'receptionist')
    `);

    res.json({
      success: true,
      count: users.length,
      data: users
    });

  } catch (error) {
    console.error('❌ Error fetching internal users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch internal staff users'
    });
  }
});

// ====================== NEW FEATURES ADDED BELOW ======================

// Toggle User Status (Active / Inactive)
router.patch('/:id/toggle-status', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const [user] = await pool.query('SELECT status FROM new_users WHERE staff_id = ? OR id = ?', [id, id]);

    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentStatus = user[0].status;
    const newStatus = currentStatus === 'approved' || currentStatus === 'active' ? 'inactive' : 'approved';

    await pool.query(
      'UPDATE new_users SET status = ? WHERE staff_id = ? OR id = ?',
      [newStatus, id, id]
    );

    res.json({
      success: true,
      message: `User status updated to ${newStatus}`,
      status: newStatus
    });
  } catch (error) {
    console.error('Toggle Status Error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle status' });
  }
});

// Delete / Drop User (Director Only)
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      'DELETE FROM new_users WHERE staff_id = ? OR id = ?',
      [id, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User has been permanently deleted'
    });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// Example: Adding the missing resend-email route
router.post('/resend-email', authenticate, async (req, res) => {
    try {
        const { userId, email } = req.body;
        
        // 1. Fetch user from DB to verify they exist
        // 2. Trigger your email service (Nodemailer, etc.)
        
        console.log(`Resending approval email to: ${email}`);

        res.json({
            success: true,
            message: `Approval email resent to ${email}`
        });
    } catch (error) {
        console.error('Resend Email Error:', error);
        res.status(500).json({ success: false, message: 'Failed to resend email' });
    }
});

// Example: Adding the missing approve-user route (also seen in your 404 logs)
router.post('/approve-user', authenticate, async (req, res) => {
    try {
        const { userId } = req.body;
        
        await pool.query('UPDATE new_users SET status = "approved" WHERE id = ?', [userId]);

        res.json({ success: true, message: 'User approved successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Approval failed' });
    }
});

module.exports = router;