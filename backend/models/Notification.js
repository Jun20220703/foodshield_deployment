const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: { type: String, required: true },        // 通知タイプ（例: booking, event, systemなど）
  title: { type: String, required: true },       // 通知タイトル
  message: { type: String, required: true },     // 通知本文
  meta: { type: Object }, // ✅ これを追加
  createdAt: { type: Date, default: Date.now },  // 作成日時
  read: { type: Boolean, default: false },       // 既読状態
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // 通知対象ユーザー
});

module.exports = mongoose.model('Notification', notificationSchema);
