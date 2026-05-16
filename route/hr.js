// routes/hr.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { authenticate } = require('../middleware/auth');

const generateTemporaryPassword = (length = 12) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // Use SSL/TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      // This is the secret sauce for localhost errors:
      tls: {
        rejectUnauthorized: false
      }
    });

// Send Approval Email
const sendApprovalEmail = async (user, tempPassword) => {
  try {
    await transporter.sendMail({
      from: `"Manson Security HR" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "✅ Your Account Has Been Approved - Manson Security",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #10b981;">Congratulations ${user.first_name}!</h2>
          <p>Your registration has been approved by the HR Team.</p>
          
          <h3>Your Login Credentials:</h3>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Temporary Password:</strong> <strong style="color:#ef4444; font-size: 16px;">${tempPassword}</strong></p>
          
          <p style="color: #dc2626; font-weight: bold;">
            ⚠️ Please change your password immediately after your first login.
          </p>
          
          <p>You can login here: <a href="http://localhost:5173/login" style="color:#10b981;">Manson Security Portal</a></p>
          <hr>
          <p>Best regards,<br><strong>HR Team - Manson Security</strong></p>
        </div>
      `
    });
    console.log(`✅ Approval email sent to ${user.email}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send email to ${user.email}:`, err.message);
    return false;
  }
};

// ==================== HR DASHBOARD ====================
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');

    const [statsResult] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE is_active = 1 AND status = 'approved') as totalStaff,
        (SELECT COUNT(*) FROM users WHERE status = 'pending') as pendingApprovals,
        (SELECT COUNT(DISTINCT staff_id) FROM attendance WHERE date = CURDATE() AND check_in IS NOT NULL) as activeToday,
        (SELECT COUNT(*) FROM leaves WHERE status = 'approved' AND CURDATE() BETWEEN start_date AND end_date) as onLeave,
        (SELECT COALESCE(SUM(amount), 0) FROM staff_advances 
         WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())) as totalAdvances
    `);

    const [recentPending] = await db.query(`
      SELECT national_id, first_name, surname, email, created_at 
      FROM users 
      WHERE status = 'pending' 
      ORDER BY created_at DESC LIMIT 5
    `);

    res.json({
      success: true,
      stats: statsResult[0] || {},
      pendingApprovals: recentPending.map(u => ({
        id: u.national_id,
        name: `${u.first_name} ${u.surname}`,
        national_id: u.national_id,
        applied_date: new Date(u.created_at).toLocaleDateString()
      }))
    });

  } catch (error) {
    console.error('HR Dashboard Error:', error);
    res.status(500).json({ success: false, message: "Failed to load HR dashboard" });
  }
});

// ==================== PENDING USERS ====================
router.get('/pending-users', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');
    const [users] = await db.query(`
        SELECT 
            u.national_id, 
            u.first_name, 
            u.surname, 
            u.email, 
            u.phone, 
            u.gender, 
            r.role_name AS role, 
            u.created_at 
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        WHERE u.status = 'pending' 
        ORDER BY u.created_at DESC
    `);

    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Pending users error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch pending users' });
  }
});

// ==================== APPROVED USERS ====================
router.get('/approved-users', authenticate, async (req, res) => {
  try {
    const db = req.app.get('dbPool');
    const [users] = await db.query(`
        SELECT 
            u.national_id, 
            u.first_name, 
            u.surname, 
            u.email, 
            u.phone, 
            u.gender, 
            r.role_name AS role,
            u.staff_id, 
            u.default_site_id AS site_id, 
            u.home_county AS county, 
            u.created_at, 
            u.updated_at AS updatedAt 
        FROM users u
        JOIN roles r ON u.role_id = r.role_id
        WHERE u.status = 'approved' 
        ORDER BY u.updated_at DESC
    `);

    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Approved users error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch approved users' });
  }
});
// COMPLETE USER ASSIGNMENT (HR)
// COMPLETE USER ASSIGNMENT (HR) - Using new 'assignments' table
router.post('/complete-user-assignment', authenticate, async (req, res) => {
  const { national_id, staff_id, zone, county, shift_type, contract_start, contract_stop } = req.body;
  const db = req.app.get('dbPool');

  try {
    // 1. First, update the users table to assign the staff_id and make them approved
    // This satisfies the Foreign Key requirement for the assignments table
    const [userUpdate] = await db.query(
      "UPDATE users SET staff_id = ?, status = 'approved' WHERE national_id = ?",
      [staff_id, national_id]
    );

    if (userUpdate.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2. Now insert into assignments
    await db.query(
      `INSERT INTO assignments (Staff_id, zone, county, shift_type, contract_start, contract_end, assigned_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [staff_id, zone, county, shift_type, contract_start, contract_stop, req.user.id]
    );

    res.json({ success: true, message: "Onboarding and assignment completed!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Assignment failed" });
  }
});

// ==================== APPROVE / REJECT USER ====================
router.post('/approve-user', authenticate, async (req, res) => {
  const { national_id, action } = req.body;

  if (!national_id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  try {
    const db = req.app.get('dbPool');

    if (action === 'approve') {
      const tempPassword = generateTemporaryPassword(12);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(tempPassword, salt);

      const [result] = await db.query(`
        UPDATE users 
        SET status = 'approved', 
            password = ?, 
            is_active = 1, 
            must_change_password = 1,
            updatedAt = CURRENT_TIMESTAMP 
        WHERE national_id = ? AND status = 'pending'
      `, [hashedPassword, national_id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'User not found or already processed' });
      }

      const [userRows] = await db.query(
        'SELECT first_name, surname, email FROM users WHERE national_id = ?', 
        [national_id]
      );

      const user = userRows[0];
      const emailSent = user?.email ? await sendApprovalEmail(user, tempPassword) : false;

      res.json({
        success: true,
        message: emailSent ? 'User approved and email sent successfully' : 'User approved successfully',
        temporaryPassword: tempPassword
      });

    } else { // reject
      const [result] = await db.query(`
        UPDATE users 
        SET status = 'rejected', is_active = 0, updatedAt = CURRENT_TIMESTAMP 
        WHERE national_id = ? AND status = 'pending'
      `, [national_id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'User not found or already processed' });
      }

      res.json({ success: true, message: 'User rejected successfully' });
    }
  } catch (err) {
    console.error('Approval error:', err);
    res.status(500).json({ success: false, message: 'Server error during approval process' });
  }
});
router.post('/resend-email', authenticate, async (req, res) => {
    const { national_id } = req.body;
    const db = req.app.get('dbPool');

    try {
        const [userRows] = await db.query(
            'SELECT first_name, surname, email FROM users WHERE national_id = ?', 
            [national_id]
        );

        if (userRows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

        const user = userRows[0];
        // Generate a new temporary password since the old one is hashed and unreadable
        const tempPassword = generateTemporaryPassword(12);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        // Update the DB with the new hash
        await db.query('UPDATE users SET password = ? WHERE national_id = ?', [hashedPassword, national_id]);

        // Send the email
        const emailSent = await sendApprovalEmail(user, tempPassword);

        res.json({
            success: emailSent,
            message: emailSent ? 'New login credentials sent!' : 'Gmail Auth failed. Check App Password.'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;