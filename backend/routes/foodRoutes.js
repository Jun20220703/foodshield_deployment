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
// ✅ Update food item (qty, etc.) - split consumed quantity into new item, keep remainder in inventory
router.put('/:id', async (req, res) => {
  try {
    const { qty } = req.body;
    
    // Get current food item to compare qty
    const currentFood = await Food.findById(req.params.id);
    if (!currentFood) {
      return res.status(404).json({ message: 'Food not found' });
    }
    
    // If qty is being decreased (used/consumed), split the item
    if (qty !== undefined && qty < currentFood.qty && currentFood.status === 'inventory') {
      const consumedQty = currentFood.qty - qty;
      
      // Create a new consumed item with the consumed quantity
      const consumedFood = new Food({
        name: currentFood.name,
        qty: consumedQty,
        expiry: currentFood.expiry,
        category: currentFood.category,
        storage: currentFood.storage,
        notes: currentFood.notes,
        status: 'consumed',
        owner: currentFood.owner
      });
      
      await consumedFood.save();
      console.log(`✅ Created consumed item: ${currentFood.name} (qty: ${consumedQty})`);
      
      // Update the original item with remaining quantity, keep status as "inventory"
      const updateData = { ...req.body, status: 'inventory' };
      const updatedFood = await Food.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );
      
      console.log(`✅ Updated original item: ${currentFood.name} (qty: ${qty}, status: inventory)`);
      return res.json(updatedFood);
    }
    
    // If qty is not decreased or status is not inventory, just update normally
    const updateData = { ...req.body };
    const updatedFood = await Food.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json(updatedFood);

    } catch (error) {                 // ← 1️⃣ Closing the try/catch
      res.status(500).json({ message: 'Server error while updating food', error: error.message });
    }

    });  
    
// Update food item by ID
router.put('/:id', async (req, res) => {
  try {
    console.log('📝 Updating food:', req.params.id, 'with data:', req.body);
    
    // Prepare update data - ensure all fields are included
    const updateData = {
      name: req.body.name,
      qty: req.body.qty,
      expiry: req.body.expiry,
      category: req.body.category,
      storage: req.body.storage,
      notes: req.body.notes
    };
    
    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    console.log('📝 Update data (cleaned):', updateData);
    
    const updatedFood = await Food.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }  // 更新後のデータを返す、バリデーションも実行
    );
    
    if (!updatedFood) {
      return res.status(404).json({ message: 'Food not found' });
    }
    
    console.log('✅ Food updated successfully:', updatedFood);
    res.json(updatedFood);
  } catch (error) {
    console.error('❌ Error updating food:', error);
    res.status(500).json({ message: 'Server error while updating food', error: error.message });
  }
});






module.exports = router;
