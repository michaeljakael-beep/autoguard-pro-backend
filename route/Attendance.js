// backend/models/Attendance.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['present', 'absent', 'late'], default: 'present' },
  checkInTime: { type: Date },
  checkOutTime: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);