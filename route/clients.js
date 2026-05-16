// route/clients.js - FINAL FIXED VERSION
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// ==================== GET ALL CLIENTS ====================
router.get('/', async (req, res) => {
  try {
    const [clients] = await pool.query(`
      SELECT 
        site_id,
        company_name,
        contact_name,
        email,
        phone,
        primary_phone,
        address,
        property_location,
        latitude,
        longitude,
        role,
        status,
        created_at,
        updated_at
      FROM clients
      ORDER BY created_at DESC
    `);

    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch clients from database',
      error: error.message 
    });
  }
});

// ==================== REGISTER NEW CLIENT ====================
router.post('/register', async (req, res) => {
  const {
    site_id,
    company_name,
    contact_name,
    email,
    phone,
    primary_phone,
    address,
    property_location,
    latitude,
    longitude,
    password,
    role = 'client',
    status = 'active'
  } = req.body;

  try {
    if (!company_name || !contact_name || !email || !phone || !password || !site_id) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: site_id, company_name, contact_name, email, phone, password' 
      });
    }

    // Check if email already exists
    const [existing] = await pool.query(
      'SELECT site_id FROM clients WHERE email = ?', 
      [email.toLowerCase().trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ 
        success: false,
        message: 'A client with this email already exists' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new client
    const [result] = await pool.query(`
      INSERT INTO clients 
      (site_id, company_name, contact_name, email, phone, primary_phone, address, 
       property_location, latitude, longitude, password, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      site_id.trim(),
      company_name.trim(),
      contact_name.trim(),
      email.toLowerCase().trim(),
      phone.trim(),
      primary_phone ? primary_phone.trim() : phone.trim(),
      address ? address.trim() : null,
      property_location ? property_location.trim() : null,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      hashedPassword,
      role,
      status
    ]);

    res.status(201).json({
      success: true,
      message: 'Client registered successfully',
      site_id: site_id.trim(),
      company_name: company_name.trim()
    });

  } catch (error) {
    console.error('Client registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to register new client',
      error: error.message 
    });
  }
});

// ==================== DELETE CLIENT ====================
router.delete('/:site_id', async (req, res) => {
  const { site_id } = req.params;

  try {
    const [result] = await pool.query(
      'DELETE FROM clients WHERE site_id = ?', 
      [site_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Client not found' 
      });
    }

    res.json({ 
      success: true,
      message: 'Client deleted successfully',
      site_id 
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete client',
      error: error.message 
    });
  }
});

// ==================== GET SINGLE CLIENT ====================
router.get('/:site_id', async (req, res) => {
  const { site_id } = req.params;

  try {
    const [client] = await pool.query(`
      SELECT 
        site_id, company_name, contact_name, email, phone, primary_phone,
        address, property_location, latitude, longitude, role, status, 
        created_at, updated_at
      FROM clients 
      WHERE site_id = ?
    `, [site_id]);

    if (client.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Client not found' 
      });
    }

    res.json(client[0]);
  } catch (error) {
    console.error('Error fetching single client:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch client details' 
    });
  }
});

module.exports = router;