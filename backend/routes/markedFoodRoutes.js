const express = require('express');
const router = express.Router();
const MarkedFood = require('../models/MarkedFood');

// ➕ Add to marked food
router.post('/', async (req, res) => {
  try {
    const { foodId, owner, qty, name, category, storage, expiry, notes } = req.body;

    // Validation
    if (!foodId || !owner || !qty || !name || !category || !storage || !expiry) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create new MarkedFood document
    const markedFood = new MarkedFood({
      foodId,
      owner,
      qty,
      name,
      category,
      storage,
      expiry: new Date(expiry),
      notes: notes || ''
    });

    // Save
    await markedFood.save();

    // Return success response
    res.status(201).json(markedFood);
  } catch (err) {
    console.error('❌ Error saving marked food:', err);
    res.status(400).json({ message: err.message });
  }
});

// 📥 Get marked foods for a specific user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    let query = {};
    if (userId) {
      query.owner = userId;
    }

    const markedFoods = await MarkedFood.find(query).populate('foodId');
    res.json(markedFoods);
  } catch (err) {
    console.error('Error fetching marked foods:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ❌ Remove from marked food list
router.delete('/:id', async (req, res) => {
  try {
    await MarkedFood.findByIdAndDelete(req.params.id);
    res.json({ message: 'Marked food removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

