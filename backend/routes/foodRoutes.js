const express = require('express');
const router = express.Router();
const Food = require('../models/Food');

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
