// services/analyticsService.js
const mongoose = require('mongoose');
const Food = require('../models/Food');
const DonationList = require('../models/DonationList');

function dayRange() {
  const start = new Date();
  start.setHours(0,0,0,0);
  const end = new Date();
  end.setHours(23,59,59,999);
  return { start, end };
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999);
  return { start, end };
}

async function totalByPeriod({ model, match, start, end }) {
  const rows = await model.aggregate([
    { $match: { ...match, createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: null, total: { $sum: '$qty' } } }
  ]);
  return rows[0]?.total ?? 0;
}

exports.getDailyStats = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const { start, end } = dayRange();

  const consumed = await totalByPeriod({
    model: Food,
    match: { owner: userObjectId, status: 'used' },
    start, end
  });

  const donated = await totalByPeriod({
    model: DonationList,
    match: { owner: userObjectId },
    start, end
  });

  const expired = await totalByPeriod({
    model: Food,
    match: { owner: userObjectId, status: 'expired' },
    start, end
  });

  return {
    header: { consumed, donation: donated, expired },
    pie: {
      labels: ['Consumed', 'Donated', 'Expired'],
      values: [consumed, donated, expired]
    },
    topExpired: [] // 可后续补每日Top N
  };
};

exports.getMonthlyStats = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const { start, end } = monthRange();

  const consumed = await totalByPeriod({
    model: Food,
    match: { owner: userObjectId, status: 'used' },
    start, end
  });

  const donated = await totalByPeriod({
    model: DonationList,
    match: { owner: userObjectId },
    start, end
  });

  const expired = await totalByPeriod({
    model: Food,
    match: { owner: userObjectId, status: 'expired' },
    start, end
  });

  return {
    header: { consumed, donation: donated, expired },
    pie: {
      labels: ['Consumed', 'Donated', 'Expired'],
      values: [consumed, donated, expired]
    },
    topExpired: [] // 可后续补本月Top N
  };
};
