// ✅ notificationService.js
const Notification = require('../models/Notification');

async function sendNotification({ type, title, message, userId, meta, read = false }) {
  try {
    const newNotification = new Notification({
      type,
      title,
      message,
      userId,
      meta,
      read,
      createdAt: new Date()
    });
    await newNotification.save();
    console.log(`✅ Notification sent: ${title}`);
    return newNotification;
  } catch (error) {
    console.error("❌ Failed to send notification:", error);
    throw err;
  }
}

module.exports = { sendNotification };
