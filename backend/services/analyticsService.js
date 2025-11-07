// services/analyticsService.js
const mongoose = require('mongoose');
const Food = require('../models/Food');
const DonationList = require('../models/DonationList');

exports.getMonthlyStats = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const consumed = await Food.aggregate([
    { $match: { status: 'used', owner: userObjectId } },
    { $group: { _id: { month: { $month: "$createdAt" } }, total: { $sum: "$qty" } } }
  ]);

  const donated = await DonationList.aggregate([
    { $match: { owner: userObjectId } },
    { $group: { _id: { month: { $month: "$createdAt" } }, total: { $sum: "$qty" } } }
  ]);

  const expired = await Food.aggregate([
    { $match: { status: 'expired', owner: userObjectId } },
    { $group: { _id: { month: { $month: "$createdAt" } }, total: { $sum: "$qty" } } }
  ]);

  return formatResponse(consumed, donated, expired);
};


exports.getYearlyStats = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const consumed = await Food.aggregate([
    { $match: { status: 'used', owner: userObjectId } },
    { $group: { _id: { year: { $year: "$createdAt" } }, total: { $sum: "$qty" } } }
  ]);

  const donated = await DonationList.aggregate([
    { $match: { owner: userObjectId } },
    { $group: { _id: { year: { $year: "$createdAt" } }, total: { $sum: "$qty" } } }
  ]);

  const expired = await Food.aggregate([
    { $match: { status: 'expired', owner: userObjectId } },
    { $group: { _id: { year: { $year: "$createdAt" } }, total: { $sum: "$qty" } } }
  ]);

  return formatResponse(consumed, donated, expired);
};


function formatResponse(consumed, donated, expired) {
  return {
    header: {
      consumed: consumed[0]?.total ?? 0,
      donation: donated[0]?.total ?? 0,
      expired: expired[0]?.total ?? 0
    },
    pie: {
      labels: ['Consumed', 'Donated', 'Expired'],
      values: [
        consumed[0]?.total ?? 0,
        donated[0]?.total ?? 0,
        expired[0]?.total ?? 0
      ]
    },
    topExpired: []
  };
}

