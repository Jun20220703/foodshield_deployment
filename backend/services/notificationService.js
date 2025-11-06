const Notification = require('../models/Notification');

// 通知を作成する共通関数
async function sendNotification(type, title, message, userId) {
  try {
    const newNotification = new Notification({
      type,
      title,
      message,
      userId,
      createdAt: new Date(),
      read: false
    });
    await newNotification.save();
    console.log(`✅ Notification sent: ${title}`);
  } catch (err) {
    console.error("❌ Failed to send notification:", err);
  }
}

module.exports = { sendNotification };
