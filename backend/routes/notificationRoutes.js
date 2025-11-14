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
      // ✅ 日付整形
      const formattedDate = expiry.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric'
      });
      const quantity = parseInt(food.qty, 10);

      console.log(`🧾 ${food.name} expires in ${diffInDays.toFixed(1)} days (qty=${quantity})`);

      // 3日以内に期限切れ
      if (diffInDays <= 3 && diffInDays >= 0) {
        const existingExpiry = await Notification.findOne({
          userId,
          type: 'expiry',
          'meta.foodId': food._id,
        });
        if (!existingExpiry) {
          await sendNotification({
            userId,
            type: 'expiry',
            title: 'Food Expiring Soon',
            message: `Your <strong>${food.name}</strong> will expire on ${formattedDate}. Please use or donate it soon.`,
            meta: { foodId: food._id },
            read: false
          });
          sentCount++;
        }
      }
      
      //賞味期限切れ
      if (diffInDays < 0) {
        const existingExpired = await Notification.findOne({
          userId,
          type: 'expired',
          'meta.foodId': food._id,
        });
        if (!existingExpired) {
          await sendNotification({
            userId,
            type: 'expired',
            title: 'Food Expired',
            message: `Your <strong>${food.name}</strong> has expired on ${formattedDate}. Please discard or handle it safely.`,
            meta: { foodId: food._id },
            read: false
          });
          sentCount++;
        }
      }
      
      // 🟠 3️⃣ Low quantity notification（在庫が少ない）
      if (quantity <= 1) {
        const existingLow = await Notification.findOne({
          userId,
          type: 'low_quantity',
          'meta.foodId': food._id,
        });
        if (!existingLow) {
          await sendNotification({
            userId,
            type: 'low_quantity',
            title: 'Low Quantity Alert',
            message: `Your <strong>${food.name}</strong> is running low. Consider restocking soon.`,
            meta: { foodId: food._id },
            read: false
          });
          sentCount++;
        }
      }

    }
    // -------------------------
  // 🟢 4️⃣ 今日のカスタムミール通知（food ループの外）
  // -------------------------
  const CustomMeal = require('../models/CustomMeal');

  const todayString = new Date().toISOString().substring(0, 10);

  // 🔥 CustomMeal のクエリは「owner」で検索
  const todayMeals = await CustomMeal.find({
    owner: userId,
    date: todayString
  });

  console.log("🟢 Today meals:", todayMeals);

  for (const meal of todayMeals) {

    // 🔥 Notification 側は「userId」で検索
    const existingMealNotification = await Notification.findOne({
      userId,
      type: 'meal_today',
      'meta.mealId': meal._id,
    });

    console.log("🟡 Found existing notification:", existingMealNotification);

    if (!existingMealNotification) {
      await sendNotification({
        userId,
        type: 'meal_today',
        title: 'Your Meal for Today',
        message: `Your planned meal <strong>${meal.foodName}</strong> is scheduled for today.`,
        meta: { mealId: meal._id },
        read: false
      });

      console.log("🟢 Meal notification sent:", meal.foodName);
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
