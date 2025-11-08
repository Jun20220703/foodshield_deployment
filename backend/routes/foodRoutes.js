const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Food = require('../models/Food');

/**
 * Auto-update food items that expire today to "expired" status
 */
async function autoUpdateExpiredFoods(ownerId, startUTC, endUTC) {
  try {
    const updateResult = await Food.updateMany(
      {
        ...(ownerId && { owner: ownerId }),
        expiry: { $gte: startUTC, $lte: endUTC },
        status: { $in: ["inventory", "donation"] }
      },
      { 
        $set: { status: "expired" }
      }
    );
    if (updateResult.modifiedCount > 0) {
      console.log(`🔄 Auto-updated ${updateResult.modifiedCount} food items to expired status`);
    }
    return updateResult.modifiedCount;
  } catch (err) {
    console.error("🔥 Error auto-updating expired foods:", err);
    return 0;
  }
}

// ✅ update food item status (Donate / Inventory)
router.put('/status/:name', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Food.findOneAndUpdate(
      { name: req.params.name },
      { status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Food not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating food status', error });
  }
});



router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = userId ? { owner: userId } : {};
    
    // ✅ Auto-update foods that expire today to "expired" status
    if (userId) {
      const now = new Date();
      const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // +8 hours in milliseconds
      const nowMYT = new Date(now.getTime() + MYT_OFFSET_MS);
      const startMYT = new Date(nowMYT);
      startMYT.setUTCHours(0, 0, 0, 0);
      const endMYT = new Date(nowMYT);
      endMYT.setUTCHours(23, 59, 59, 999);
      const startUTC = new Date(startMYT.getTime() - MYT_OFFSET_MS);
      const endUTC = new Date(endMYT.getTime() - MYT_OFFSET_MS);
      
      const ownerId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
      await autoUpdateExpiredFoods(ownerId, startUTC, endUTC);
    }
    
    const foods = await Food.find(filter);
    res.json(foods);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const food = await Food.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(food);
  } catch (err) {
    res.status(500).json({ message: 'Error updating food status', error: err });
  }
});

// server.js or routes/foods.js
router.get('/:id', async (req, res) => {
  try {
    const food = await Food.findById(req.params.id); // Mongoose を想定
    if (!food) return res.status(404).json({ message: 'Food not found' });
    res.json(food);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// app.js または foodRoutes.js
router.put('/api/foods/:id', async (req, res) => {
  try {
    const updatedFood = await Food.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }  // 更新後のデータを返す
    );
    if (!updatedFood) {
      return res.status(404).json({ message: 'Food not found' });
    }
    res.json(updatedFood);
  } catch (error) {
    console.error('Error updating food:', error);
    res.status(500).json({ message: 'Server error while updating food', error });
  }
});






module.exports = router;
