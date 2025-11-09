const mongoose = require('mongoose');

const customMealSchema = new mongoose.Schema({
  foodName: { type: String, required: true },
  ingredients: { type: String, default: '' },
  howToCook: { type: String, default: '' },
  kcal: { type: String, default: '' },
  photo: { type: String, default: null }, // Base64 encoded image or URL
  date: { type: String, required: true }, // YYYY-MM-DD format
  mealType: { type: String, required: true }, // Breakfast, Lunch, Dinner, Snack
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CustomMeal', customMealSchema);

