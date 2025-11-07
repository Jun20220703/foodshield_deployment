const mongoose = require('mongoose');

const donationListSchema = new mongoose.Schema(
  {
    foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
    qty: { type: Number, required: true },
    location: { type: String, required: true },
    availability: { type: String, required: true },
    notes: { type: String },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // 或 Attendee，看你的系统定义
      required: true
    }
  },
  { timestamps: true } // ✅ 这行放在外层，代表 schema 选项
);

module.exports = mongoose.model('DonationList', donationListSchema);
