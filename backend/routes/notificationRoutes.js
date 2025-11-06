const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Food = require('../models/Food');
const { sendNotification } = require('../services/notificationService');
// 全通知を取得
router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 通知を作成
router.post('/', async (req, res) => {
  try {
    const newNotification = new Notification(req.body);
    const savedNotification = await newNotification.save();
    res.status(201).json(savedNotification);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 既読状態を更新
router.patch('/:id/read', async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🟢 NEW: 賞味期限チェックAPI（Notificationページ用）
// 🟢 NEW: 賞味期限チェックAPI（Notificationページ用）
router.post('/check-expiry', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'Missing userId' });

    const today = new Date();

    // 該当ユーザーのinventoryにある食材を取得
    const foods = await Food.find({ owner: userId, status: 'inventory' });

    let sentCount = 0;
    for (const food of foods) {
      if (!food.expiry) continue;

      const expiryDate = new Date(food.expiry);
      const diffInDays = (expiryDate - today) / (1000 * 3600 * 24);

      // 3日以内に期限切れ
      if (diffInDays <= 3 && diffInDays >= 0) {
        // ✅ 同じ食材に対してまだ通知が送られていないか確認
        const existingNotification = await Notification.findOne({
          userId,
          type: 'expiry',
          'meta.foodId': food._id, // 食材IDで重複確認
          read: false               // まだ未読のものだけ対象
        });

        if (existingNotification) {
          console.log(`⚠️ Skipped duplicate notification for ${food.name}`);
          continue; // 同じ通知があるならスキップ
        }

        // ✅ 新しい通知を作成
        await sendNotification({
          userId,
          type: 'expiry',
          title: 'Food Expiring Soon',
          message: `Your item "${food.name}" will expire on ${food.expiry}. Please take action soon.`,
          meta: { foodId: food._id },
          read: false
        });
        sentCount++;
      }
    }

    res.json({ message: `Checked ${foods.length} foods, sent ${sentCount} new notifications.` });
  } catch (err) {
    console.error('Error checking expiry:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



module.exports = router;
