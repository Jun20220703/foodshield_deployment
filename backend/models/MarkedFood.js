const mongoose = require('mongoose');

const markedFoodSchema = new mongoose.Schema({
  foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  qty: { type: Number, required: true }, // marked quantity
  name: { type: String, required: true }, // food name (for easy reference)
  category: { type: String, required: true },
  storage: { type: String, required: true },
  expiry: { type: Date, required: true },
  notes: { type: String, default: '' },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MarkedFood', markedFoodSchema);

