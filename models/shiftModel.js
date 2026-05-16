// models/shiftModel.js
const db = require('../config/db');

class Shift {

  // ==================== GET ALL SHIFTS ====================
  static async getAll() {
    try {
      const [rows] = await db.query(`
        SELECT 
          s.shift_id,
          s.site_id,
          s.shift_date,
          s.start_time,
          s.end_time,
          s.shift_type,
          s.status,
          s.created_by,
          s.created_at,
          
          COALESCE(c.site_name, 'Unknown Site') AS site_name,
          COALESCE(c.site_id, '') AS site_code,
          COALESCE(c.zone, '') AS zone,
          COALESCE(c.county, '') AS county,
          COALESCE(c.region, '') AS region

        FROM shifts s
        LEFT JOIN sites c ON s.site_id = c.site_id
        ORDER BY s.shift_date DESC, s.start_time ASC;
      `);

      return rows;
    } catch (error) {
      console.error('Error in Shift.getAll():', error);
      throw error;
    }
  }

  // ==================== CREATE SHIFT ====================
  static async create(shiftData) {
    try {
      const {
        site_id,
        shift_date,
        start_time,
        end_time,
        shift_type = 'dayshift',
        status = 'Scheduled',
        created_by
      } = shiftData;

      const [result] = await db.query(`
        INSERT INTO shifts 
          (site_id, shift_date, start_time, end_time, shift_type, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [site_id, shift_date, start_time, end_time, shift_type, status, created_by]);

      // Return the created shift with site details
      const [newShift] = await db.query(`
        SELECT 
          s.*,
          COALESCE(c.site_name, 'Unknown Site') AS site_name
        FROM shifts s
        LEFT JOIN sites c ON s.site_id = c.site_id
        WHERE s.shift_id = ?
      `, [result.insertId]);

      return newShift[0];
    } catch (error) {
      console.error('Error in Shift.create():', error);
      throw error;
    }
  }

  // ==================== ASSIGN STAFF (Updated with staff_id) ====================
  static async assignGuard(shift_id, staff_id, assigned_by) {
    try {
      // Check if already assigned
      const [existing] = await db.query(`
        SELECT * FROM shift_assignments 
        WHERE shift_id = ? AND staff_id = ?
      `, [shift_id, staff_id]);

      if (existing.length > 0) {
        throw new Error('Staff is already assigned to this shift');
      }

      const [result] = await db.query(`
        INSERT INTO shift_assignments 
          (shift_id, staff_id, assigned_by, assigned_at)
        VALUES (?, ?, ?, NOW())
      `, [shift_id, staff_id, assigned_by]);

      return { 
        message: 'Staff assigned successfully',
        assignment_id: result.insertId 
      };
    } catch (error) {
      console.error('Error in Shift.assignGuard():', error);
      throw error;
    }
  }

  // ==================== GET SHIFT BY ID ====================
  static async getById(shift_id) {
    try {
      const [rows] = await db.query(`
        SELECT 
          s.*,
          COALESCE(c.site_name, 'Unknown Site') AS site_name
        FROM shifts s
        LEFT JOIN sites c ON s.site_id = c.site_id
        WHERE s.shift_id = ?
      `, [shift_id]);

      return rows[0];
    } catch (error) {
      console.error('Error in Shift.getById():', error);
      throw error;
    }
  }

}

module.exports = Shift;