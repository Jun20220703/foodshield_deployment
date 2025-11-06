const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true }, // 建议用 Number 比较好计算
  expiry: { type: Date, required: true },
  category: { type: String, required: true },
  storage: { type: String, required: true },
  notes: { type: String, default: '' },
  

  // ✅ 新增字段：状态 (inventory / donation)
  status: { type: String, enum: ['inventory', 'used', 'donation', 'expired'],
    default: 'inventory' },

  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }


});

module.exports = mongoose.model('Food', foodSchema);