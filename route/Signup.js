const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt'); // Highly recommended for passwords

// 1. Configure Multer for File Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Ensure this folder exists
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 2. Updated Signup Route
router.post('/signup', upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'spouseId', maxCount: 1 },
    { name: 'supportDocs', maxCount: 10 }
]), async (req, res) => {
    try {
        // Extract all text fields from req.body
        const data = req.body;
        
        // Extract file paths
        const idFrontPath = req.files['idFront'] ? req.files['idFront'][0].path : null;
        const idBackPath = req.files['idBack'] ? req.files['idBack'][0].path : null;
        const spouseIdPath = req.files['spouseId'] ? req.files['spouseId'][0].path : null;
        const supportDocsPaths = req.files['supportDocs'] 
            ? JSON.stringify(req.files['supportDocs'].map(f => f.path)) 
            : null;

        // Validation logic
        if (!data.email || !data.password || !data.idNumber) {
            return res.status(400).json({ success: false, message: 'Missing required credentials' });
        }

        // Check for duplicates
        const [existing] = await pool.query(
            'SELECT id FROM new_users WHERE email = ? OR idNumber = ?',
            [data.email.trim().toLowerCase(), data.idNumber.trim()]
        );

        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Email or ID Number already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(data.password, 10);

        // Prepare SQL query with ALL fields from the React form
        const query = `
            INSERT INTO new_users (
                firstName, surname, email, phone, idNumber, dob, role, password, 
                gender, description, clientLocation, howDidYouKnow, socialMedia,
                refereeFirstName, refereeLastName, refereeIdNumber, refereePhone, 
                relationship, schoolLevel, nativeLanguage, residenceCounty, homeCounty,
                maritalStatus, spouseFirstName, spouseLastName, spousePhone, whyManson,
                clientFirstName, clientLastName, clientNationalId, clientPhone, clientCounty,
                idFrontPath, idBackPath, spouseIdPath, supportDocsPaths
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            data.firstName, data.surname, data.email.toLowerCase(), data.phone, data.idNumber, data.dob, data.role, hashedPassword,
            data.gender, data.description, data.clientLocation, data.howDidYouKnow, data.socialMedia,
            data.refereeFirstName, data.refereeLastName, data.refereeIdNumber, data.refereePhone,
            data.relationship, data.schoolLevel, data.nativeLanguage, data.residenceCounty, data.homeCounty,
            data.maritalStatus, data.spouseFirstName, data.spouseLastName, data.spousePhone, data.whyManson,
            data.clientFirstName, data.clientLastName, data.clientNationalId, data.clientPhone, data.clientCounty,
            idFrontPath, idBackPath, spouseIdPath, supportDocsPaths
        ];

        await pool.query(query, values);

        res.status(201).json({ 
            success: true, 
            message: 'Registration successful! You can now log in.' 
        });

    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;