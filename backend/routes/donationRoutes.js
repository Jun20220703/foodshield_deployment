const express = require('express');
const router = express.Router();
const DonationList = require('../models/DonationList');
const { sendNotification } = require('../services/notificationService');
// ➕ Add to donation
router.post('/', async (req, res) => {
  try {
    // 🟢 ここで全ての必要なデータを受け取る
    const { foodId, owner, qty, location, availability, notes } = req.body;

    // 🟡 バリデーション（必須チェック）
    if (!foodId || !owner || !qty || !location || !availability) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // 🟢 新しいDonationListドキュメントを作成
    const donation = new DonationList({
      foodId,
      owner,
      qty,
      location,
      availability,
      notes,
      donationAt: new Date()
    });

    // 🟢 保存
    await donation.save();

    // ✅ 成功レスポンスを返す
    res.status(201).json(donation);
  } catch (err) {
    console.error('❌ Error saving donation:', err);
    res.status(400).json({ message: err.message });
  }
});


// 📥 Get donations for a specific user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query; // ← URLに?userId=xxxx を渡す

    let query = {};
    if (userId) {
      query.owner = userId; // ← ログイン中ユーザーのみ取得
    }

    const donations = await DonationList.find(query).populate('foodId');
    res.json(donations);
  } catch (err) {
    console.error('Error fetching donations:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// 📥 Get donation by ID
router.get('/:id', async (req, res) => {
  try {
    const donation = await DonationList.findById(req.params.id).populate('foodId');
    if (!donation) {
      return res.status(404).json({ message: 'Donation not found' });
    }
    res.json(donation);
  } catch (err) {
    console.error('Error fetching donation by id:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



// ❌ Remove from donation list
router.delete('/:id', async (req, res) => {
  try {
    await DonationList.findByIdAndDelete(req.params.id);
    res.json({ message: 'Donation removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update donation
router.put('/:id', async (req, res) => {
  try {
    const updatedDonation = await DonationList.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedDonation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating donation' });
  }
});


module.exports = router;
