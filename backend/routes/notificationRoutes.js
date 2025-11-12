const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Food = require('../models/Food');
const { sendNotification } = require('../services/notificationService');

console.log('🚀 notificationRoutes.js loaded');
// 全通知を取得
// middlewareでreq.userを取得できる前提 (JWTなど)
router.get('/', async (req, res) => {
  try {
    // 1️⃣ 認証済みユーザーのIDを取得（JWTまたはセッションから）
    const userId = req.user?._id || req.query.userId; // fallbackとしてqueryも対応

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // 2️⃣ userIdで絞り込み
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error });
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
// ✅ 賞味期限チェックAPI
router.post('/check-expiry', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'Missing userId' });

    const today = new Date();
    const foods = await Food.find({ owner: userId, status: 'inventory' });

    let sentCount = 0;
    for (const food of foods) {
      if (!food.expiry) continue;

      const expiry = new Date(food.expiry);
      const diffInDays = (expiry - today) / (1000 * 3600 * 24);
      console.log(`🧾 ${food.name} expires in ${diffInDays.toFixed(1)} days`);

      // 3日以内に期限切れ
      if (diffInDays <= 3 && diffInDays >= 0) {
        const existingNotification = await Notification.findOne({
          userId,
          type: 'expiry',
          'meta.foodId': food._id,
        });

        if (existingNotification) {
          console.log(`⚠️ Skipped duplicate notification for ${food.name}`);
          continue;
        }

        // ✅ 日付整形
        const formattedDate = expiry.toLocaleDateString('en-GB', {
          day: '2-digit', month: 'long', year: 'numeric'
        });

        // ✅ メッセージ候補
        const suggestions = [
          `Your "${food.name}" is nearing its expiry on ${formattedDate}. Maybe you can cook something tasty with it today! 🍽️`,
          `Heads up! Your "${food.name}" will expire soon (${formattedDate}). Consider using it soon or donating it to someone in need. 💚`,
          `Your "${food.name}" will reach its best-by date on ${formattedDate}. Don’t let it go to waste — use or share it! 🌍`
        ];

        // ✅ メッセージを確実に取得
        const message = suggestions.length > 0 ? suggestions[Math.floor(Math.random() * suggestions.length)] : 
          `Your "${food.name}" will expire on ${formattedDate}. Please take action soon.`;

        // ✅ 通知作成
        await sendNotification({
          userId,
          type: 'expiry',
          title: 'Food Expiring Soon',
          message, // ✅ これで常に定義される
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


//detail表示 GET /api/notifications/:id　
router.get('/:id', async (req, res) => {
  console.log('🔥 Route reached with ID:', req.params.id);
  console.log('📨 userId received:', req.query.userId);

  try {
    const { id } = req.params;
    const userId = req.query.userId;
    const notification = await Notification.findById(id);
    res.json(notification);
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({ message: 'Error fetching notification' });
  }
});





module.exports = router;
