const express = require('express');
const router = express.Router();
const CustomMeal = require('../models/CustomMeal');

// Create a new custom meal
router.post('/', async (req, res) => {
  try {
    const { foodName, ingredients, howToCook, kcal, photo, date, mealType, owner } = req.body;

    if (!foodName || !foodName.trim()) {
      return res.status(400).json({ message: 'Food name is required' });
    }

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    if (!mealType) {
      return res.status(400).json({ message: 'Meal type is required' });
    }

    if (!owner) {
      return res.status(400).json({ message: 'Owner (user ID) is required' });
    }

    const customMeal = new CustomMeal({
      foodName: foodName.trim(),
      ingredients: ingredients || '',
      howToCook: howToCook || '',
      kcal: kcal || '',
      photo: photo || null,
      date: date, // YYYY-MM-DD format
      mealType: mealType, // Breakfast, Lunch, Dinner, Snack
      owner: owner
    });

    const savedMeal = await customMeal.save();
    console.log('✅ Custom meal created:', savedMeal.foodName);
    res.status(201).json(savedMeal);
  } catch (err) {
    console.error('❌ Error creating custom meal:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get all custom meals for a user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const customMeals = await CustomMeal.find({ owner: userId })
      .sort({ createdAt: -1 })
      .populate('owner', 'name email');
    
    res.json(customMeals);
  } catch (err) {
    console.error('❌ Error fetching custom meals:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get a single custom meal by ID
router.get('/:id', async (req, res) => {
  try {
    const customMeal = await CustomMeal.findById(req.params.id)
      .populate('owner', 'name email');
    
    if (!customMeal) {
      return res.status(404).json({ message: 'Custom meal not found' });
    }
    
    res.json(customMeal);
  } catch (err) {
    console.error('❌ Error fetching custom meal:', err);
    res.status(500).json({ message: err.message });
  }
});

// Update a custom meal
router.put('/:id', async (req, res) => {
  try {
    const { foodName, ingredients, howToCook, kcal, photo, date, mealType } = req.body;
    
    const updateData = {
      foodName: foodName?.trim(),
      ingredients: ingredients || '',
      howToCook: howToCook || '',
      kcal: kcal || '',
      photo: photo || null
    };
    
    if (date) updateData.date = date;
    if (mealType) updateData.mealType = mealType;
    
    const customMeal = await CustomMeal.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!customMeal) {
      return res.status(404).json({ message: 'Custom meal not found' });
    }
    
    console.log('✅ Custom meal updated:', customMeal.foodName);
    res.json(customMeal);
  } catch (err) {
    console.error('❌ Error updating custom meal:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete a custom meal
router.delete('/:id', async (req, res) => {
  try {
    const customMeal = await CustomMeal.findByIdAndDelete(req.params.id);
    
    if (!customMeal) {
      return res.status(404).json({ message: 'Custom meal not found' });
    }
    
    console.log('✅ Custom meal deleted:', customMeal.foodName);
    res.json({ message: 'Custom meal deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting custom meal:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

