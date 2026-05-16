// config/emailConfig.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD   // fallback support
  }
});

// Debug Info
console.log("📧 Email Config Check:");
console.log("EMAIL_USER     :", process.env.EMAIL_USER || "❌ MISSING");
console.log("EMAIL_PASS     :", process.env.EMAIL_PASS ? "✅ Present" : "❌ MISSING");
console.log("EMAIL_PASSWORD :", process.env.EMAIL_PASSWORD ? "✅ Present" : "Not set");

if (!process.env.EMAIL_USER || !(process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD)) {
  console.warn("⚠️  Email credentials are incomplete!");
}

transporter.verify(function (error, success) {
  if (error) {
    console.log("❌ Email configuration error:", error.message);
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});

module.exports = transporter;