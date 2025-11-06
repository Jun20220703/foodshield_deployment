const mongoose = require('mongoose');

const foodHistorySchema = new mongoose.Schema({
  foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  action: { type: String, enum: ['consumed', 'donated', 'expired'], required: true },
  qty: { type: Number, required: true },   // ✅ 几份被处理
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now } // ✅ 用于计算每月
});
