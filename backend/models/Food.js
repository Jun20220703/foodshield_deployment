const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    qty: { type: Number, required: true }, // 建议用 Number 比较好计算
    expiry: { type: Date, required: true },
    category: { type: String, required: true },
    storage: { type: String, required: true },
    notes: { type: String, default: '' },

    // ✅ 状态字段
    status: { 
      type: String, 
      enum: ['inventory', 'consumed', 'donation', 'expired'],
      default: 'inventory'
    },

    // ✅ 拥有者
    owner: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    }
  },
  { timestamps: true } // 👈 自动生成 createdAt / updatedAt
);

module.exports = mongoose.model('Food', foodSchema);
