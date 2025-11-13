// backend/controllers/analyticsController.js
console.log("📌 analyticsController loaded");
const mongoose = require('mongoose');
const Food = require('../models/Food');
const DonationList = require('../models/DonationList');

/**
 * Auto-update food items that expire today to "expired" status
 * This ensures expired items don't show in inventory
 */
async function autoUpdateExpiredFoods(ownerId, startUTC, endUTC) {
  try {
    // Find foods that expire today but status is still "inventory"
    const foodsToExpire = await Food.find({
      ...(ownerId && { owner: ownerId }),
      expiry: { $gte: startUTC, $lte: endUTC },
      status: { $in: ["inventory", "donation"] } // Only update if still in inventory or donation status
    });

    if (foodsToExpire.length > 0) {
      const updateResult = await Food.updateMany(
        {
          ...(ownerId && { owner: ownerId }),
          expiry: { $gte: startUTC, $lte: endUTC },
          status: { $in: ["inventory", "donation"] }
        },
        { 
          $set: { status: "expired" }
        }
      );
      console.log(`🔄 Auto-updated ${updateResult.modifiedCount} food items to expired status`);
      return updateResult.modifiedCount;
    }
    return 0;
  } catch (err) {
    console.error("🔥 Error auto-updating expired foods:", err);
    return 0;
  }
}

exports.getDaily = async (req, res) => {
  try {
    // ✅ owner filter from JWT
    const ownerIdRaw = req.user?.userId;
    // Convert to ObjectId if it's a string (Mongoose handles this automatically, but explicit is safer)
    let ownerId = null;
    if (ownerIdRaw) {
      if (typeof ownerIdRaw === 'string' && mongoose.Types.ObjectId.isValid(ownerIdRaw)) {
        ownerId = new mongoose.Types.ObjectId(ownerIdRaw);
      } else {
        ownerId = ownerIdRaw; // Already ObjectId or handle as-is
      }
    }
    console.log("📌 Analytics request - ownerId:", ownerId, "raw:", ownerIdRaw);

    // ✅ Malaysia time (+8) "today" range
    // Get current UTC time
    const now = new Date();
    const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // +8 hours in milliseconds
    
    // Get current time in Malaysia timezone (UTC + 8)
    const nowMYT = new Date(now.getTime() + MYT_OFFSET_MS);
    
    // Get start of today in MYT (00:00:00 MYT)
    const startMYT = new Date(nowMYT);
    startMYT.setUTCHours(0, 0, 0, 0);
    
    // Get end of today in MYT (23:59:59.999 MYT)
    const endMYT = new Date(nowMYT);
    endMYT.setUTCHours(23, 59, 59, 999);
    
    // Convert MYT times back to UTC for MongoDB query
    const startUTC = new Date(startMYT.getTime() - MYT_OFFSET_MS);
    const endUTC = new Date(endMYT.getTime() - MYT_OFFSET_MS);

    console.log("📅 Date range - startUTC:", startUTC, "endUTC:", endUTC);
    console.log("📅 Current time:", now, "MYT equivalent:", nowMYT);

    // ✅ Auto-update foods that expire today to "expired" status
    if (ownerId) {
      const updatedCount = await autoUpdateExpiredFoods(ownerId, startUTC, endUTC);
      if (updatedCount > 0) {
        console.log(`✅ Auto-updated ${updatedCount} food items to expired status`);
      }
    }

    // Debug: Check total counts for this user (regardless of date)
    if (ownerId) {
      const totalFoods = await Food.countDocuments({ owner: ownerId });
      const totalDonations = await DonationList.countDocuments({ owner: ownerId });
      console.log("🔍 Debug - Total foods for user:", totalFoods);
      console.log("🔍 Debug - Total donations for user:", totalDonations);
      
      // Check status breakdown (all time)
      const consumedAllTime = await Food.countDocuments({ owner: ownerId, status: "consumed" });
      const expiredAllTime = await Food.countDocuments({ owner: ownerId, status: "expired" });
      const donationAllTime = await Food.countDocuments({ owner: ownerId, status: "donation" });
      console.log("🔍 Debug - All time status counts - Consumed:", consumedAllTime, "Expired:", expiredAllTime, "Donation:", donationAllTime);
      
      // Check recent updates (last 7 days)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentConsumed = await Food.countDocuments({ 
        owner: ownerId, 
        status: "consumed",
        updatedAt: { $gte: sevenDaysAgo }
      });
      const recentExpired = await Food.countDocuments({ 
        owner: ownerId, 
        status: "expired",
        updatedAt: { $gte: sevenDaysAgo }
      });
      console.log("🔍 Debug - Last 7 days - Consumed:", recentConsumed, "Expired:", recentExpired);
      
      // Show sample of today's records (if any)
      const todayConsumedSamples = await Food.find({
        owner: ownerId,
        status: "consumed",
        updatedAt: { $gte: startUTC, $lte: endUTC }
      }).limit(3).select('name status updatedAt');
      const todayExpiredSamples = await Food.find({
        owner: ownerId,
        status: "expired",
        updatedAt: { $gte: startUTC, $lte: endUTC }
      }).limit(3).select('name status updatedAt');
      console.log("🔍 Debug - Today's consumed samples:", todayConsumedSamples);
      console.log("🔍 Debug - Today's expired samples:", todayExpiredSamples);
    }

    // ====== ✅ DAILY DONATION (donationList.createdAt is today) ======
    const donationMatch = {
      ...(ownerId && { owner: ownerId }),
      createdAt: { $gte: startUTC, $lte: endUTC }
    };
    console.log("🔍 Donation match filter:", JSON.stringify(donationMatch, null, 2));
    
    const donationToday = await DonationList.aggregate([
      { $match: donationMatch },
      {
        $group: {
          _id: null,
          totalQty: { $sum: "$qty" }
        }
      }
    ]);

    const donationCount = donationToday[0]?.totalQty ?? 0;
    console.log("📊 Donation count:", donationCount);
    
    // Debug: Show donation samples
    if (ownerId) {
      const donationSamples = await DonationList.find(donationMatch).limit(3).select('qty createdAt');
      console.log("🔍 Debug - Today's donation samples:", donationSamples);
    }

    // ====== ✅ DAILY CONSUMED (status changed to consumed today) ======
    const consumedMatch = {
      ...(ownerId && { owner: ownerId }),
      status: "consumed",
      updatedAt: { $gte: startUTC, $lte: endUTC }
    };
    console.log("🔍 Consumed match filter:", JSON.stringify(consumedMatch, null, 2));
    
    const consumedCount = await Food.countDocuments(consumedMatch);
    console.log("📊 Consumed count:", consumedCount);

    // ====== ✅ DAILY EXPIRED (expiry date is today OR status changed to expired today) ======
    // Count foods that expire today OR status changed to expired today
    const expiredTodayQuery = {
      ...(ownerId && { owner: ownerId }),
      $or: [
        // Case 1: Status changed to expired today
        {
          status: "expired",
          updatedAt: { $gte: startUTC, $lte: endUTC }
        },
        // Case 2: Expiry date is today (after auto-update, these should now have status="expired")
        {
          expiry: { 
            $gte: startUTC, 
            $lte: endUTC 
          },
          status: "expired"
        }
      ]
    };
    console.log("🔍 Expired match filter:", JSON.stringify(expiredTodayQuery, null, 2));
    
    // Use aggregate to get unique count (avoid double counting if both conditions match)
    const expiredResult = await Food.aggregate([
      { $match: expiredTodayQuery },
      { $group: { _id: "$_id" } }, // Group by food ID to get unique count
      { $count: "total" }
    ]);
    
    const expiredCount = expiredResult[0]?.total ?? 0;
    console.log("📊 Expired count:", expiredCount);
    
    // Debug: Show expired samples
    if (ownerId) {
      const expiredSamples = await Food.find(expiredTodayQuery)
        .limit(5)
        .select('name status expiry updatedAt');
      console.log("🔍 Debug - Today's expired samples:", expiredSamples);
    }

    // ====== ✅ TOP 3 EXPIRED FOODS (ALL TIME, sorted by qty) ======
    const topExpiredQuery = {
      ...(ownerId && { owner: ownerId }),
      status: "expired"
    };
    console.log("🔍 Top Expired Query (ALL TIME):", JSON.stringify(topExpiredQuery, null, 2));
    
    let topExpired = [];
    try {
      // Debug: Check total expired foods first
      const totalExpired = await Food.countDocuments(topExpiredQuery);
      console.log("🔍 Total expired foods for user (all time):", totalExpired);
      
      if (totalExpired > 0) {
        topExpired = await Food.aggregate([
          { $match: topExpiredQuery },
          { $group: { 
            _id: "$name", 
            count: { $sum: { $ifNull: ["$qty", 0] } } 
          } },
          { $sort: { count: -1 } }, // Sort by count descending (highest first)
          { $limit: 3 }, // Get top 3
          { $project: { name: "$_id", count: 1, _id: 0 } }
        ]);
        console.log("📊 Top 3 expired foods aggregation result:", JSON.stringify(topExpired, null, 2));
      } else {
        console.log("⚠️ No expired foods found, returning empty array");
      }
    } catch (err) {
      console.error("🔥 Error in topExpired aggregation:", err);
      topExpired = [];
    }

    // ====== ✅ TOP 3 CONSUMED FOODS (ALL TIME, sorted by qty) ======
    const topConsumedQuery = {
      ...(ownerId && { owner: ownerId }),
      status: "consumed"
    };
    console.log("🔍 Top Consumed Query (ALL TIME):", JSON.stringify(topConsumedQuery, null, 2));
    
    let topConsumed = [];
    try {
      // Debug: Check total consumed foods first
      const totalConsumed = await Food.countDocuments(topConsumedQuery);
      console.log("🔍 Total consumed foods for user (all time):", totalConsumed);
      
      if (totalConsumed > 0) {
        topConsumed = await Food.aggregate([
          { $match: topConsumedQuery },
          { $group: { 
            _id: "$name", 
            count: { $sum: { $ifNull: ["$qty", 0] } } 
          } },
          { $sort: { count: -1 } }, // Sort by count descending (highest first)
          { $limit: 3 }, // Get top 3
          { $project: { name: "$_id", count: 1, _id: 0 } }
        ]);
        console.log("📊 Top 3 consumed foods aggregation result:", JSON.stringify(topConsumed, null, 2));
      } else {
        console.log("⚠️ No consumed foods found, returning empty array");
      }
    } catch (err) {
      console.error("🔥 Error in topConsumed aggregation:", err);
      topConsumed = [];
    }

    // ====== ✅ TOP 3 DONATED FOODS (ALL TIME, sorted by qty) ======
    // Note: DonationList has foodId reference, need to lookup Food to get name
    const topDonatedQuery = {
      ...(ownerId && { owner: ownerId })
    };
    console.log("🔍 Top Donated Query (ALL TIME):", JSON.stringify(topDonatedQuery, null, 2));
    
    let topDonated = [];
    try {
      // Debug: Check total donations first
      const totalDonations = await DonationList.countDocuments(topDonatedQuery);
      console.log("🔍 Total donations for user (all time):", totalDonations);
      
      if (totalDonations > 0) {
        topDonated = await DonationList.aggregate([
          { $match: topDonatedQuery },
          { 
            $lookup: {
              from: 'foods', // Collection name in MongoDB (usually lowercase plural)
              localField: 'foodId',
              foreignField: '_id',
              as: 'food'
            }
          },
          { $unwind: { path: '$food', preserveNullAndEmptyArrays: false } }, // Only include documents with matching food
          { $group: { 
            _id: "$food.name", // Group by food name from the looked-up Food document
            count: { $sum: { $ifNull: ["$qty", 0] } } // Sum the qty from DonationList
          } },
          { $sort: { count: -1 } }, // Sort by count descending (highest first)
          { $limit: 3 }, // Get top 3
          { $project: { name: "$_id", count: 1, _id: 0 } }
        ]);
        console.log("📊 Top 3 donated foods aggregation result:", JSON.stringify(topDonated, null, 2));
      } else {
        console.log("⚠️ No donations found, returning empty array");
      }
    } catch (err) {
      console.error("🔥 Error in topDonated aggregation:", err);
      topDonated = [];
    }

    // Ensure all arrays are always arrays (never null/undefined)
    const safeTopExpired = Array.isArray(topExpired) ? topExpired : [];
    const safeTopConsumed = Array.isArray(topConsumed) ? topConsumed : [];
    const safeTopDonated = Array.isArray(topDonated) ? topDonated : [];

    const result = {
      header: {
        consumed: consumedCount,
        donation: donationCount,
        expired: expiredCount
      },
      pie: {
        labels: ["Consumed", "Donation", "Expired"],
        values: [consumedCount, donationCount, expiredCount]
      },
      topExpired: safeTopExpired,
      topConsumed: safeTopConsumed,
      topDonated: safeTopDonated
    };
    
    console.log("✅ Final result:", JSON.stringify(result, null, 2));
    return res.json(result);

  } catch (err) {
    console.error("🔥 analytics/daily error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getMonthly = async (req, res) => {
  try {
    // ✅ Normalize ownerId early
    let ownerId = null;
    if (req.user?.userId && mongoose.Types.ObjectId.isValid(req.user.userId)) {
      ownerId = new mongoose.Types.ObjectId(req.user.userId);
    }
    console.log("📌 Monthly Analytics request - ownerId:", ownerId);

    // ✅ Malaysia time (+8) "this month" range
    // Get current UTC time
    const now = new Date();
    const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // +8 hours in milliseconds
    
    // Get current time in Malaysia timezone (UTC + 8)
    const nowMYT = new Date(now.getTime() + MYT_OFFSET_MS);
    
    // Get start of this month in MYT (00:00:00 MYT on 1st day)
    const startMYT = new Date(nowMYT.getFullYear(), nowMYT.getMonth(), 1);
    startMYT.setUTCHours(0, 0, 0, 0);
    
    // Get end of this month in MYT (23:59:59.999 MYT on last day)
    const endMYT = new Date(nowMYT.getFullYear(), nowMYT.getMonth() + 1, 0);
    endMYT.setUTCHours(23, 59, 59, 999);
    
    // Convert MYT times back to UTC for MongoDB query
    const startUTC = new Date(startMYT.getTime() - MYT_OFFSET_MS);
    const endUTC = new Date(endMYT.getTime() - MYT_OFFSET_MS);

    console.log("📅 Monthly date range - startUTC:", startUTC, "endUTC:", endUTC);

    // ✅ Auto-update foods that expire this month to "expired" status
    if (ownerId) {
      const updatedCount = await autoUpdateExpiredFoods(ownerId, startUTC, endUTC);
      if (updatedCount > 0) {
        console.log(`✅ Auto-updated ${updatedCount} food items to expired status`);
      }
    }

    // ====== ✅ MONTHLY DONATION (donationList.createdAt is this month) ======
    const donationMatch = {
      ...(ownerId && { owner: ownerId }),
      createdAt: { $gte: startUTC, $lte: endUTC }
    };
    
    const donationThisMonth = await DonationList.aggregate([
      { $match: donationMatch },
      {
        $group: {
          _id: null,
          totalQty: { $sum: "$qty" }
        }
      }
    ]);

    const donationCount = donationThisMonth[0]?.totalQty ?? 0;
    console.log("📊 Monthly donation count:", donationCount);

    // ====== ✅ MONTHLY CONSUMED (status changed to consumed this month) ======
    const consumedMatch = {
      ...(ownerId && { owner: ownerId }),
      status: "consumed",
      updatedAt: { $gte: startUTC, $lte: endUTC }
    };
    
    const consumedCount = await Food.countDocuments(consumedMatch);
    console.log("📊 Monthly consumed count:", consumedCount);

    // ====== ✅ MONTHLY EXPIRED (expiry date is this month OR status changed to expired this month) ======
    const expiredThisMonthQuery = {
      ...(ownerId && { owner: ownerId }),
      $or: [
        {
          status: "expired",
          updatedAt: { $gte: startUTC, $lte: endUTC }
        },
        {
          expiry: { 
            $gte: startUTC, 
            $lte: endUTC 
          },
          status: "expired"
        }
      ]
    };
    
    const expiredResult = await Food.aggregate([
      { $match: expiredThisMonthQuery },
      { $group: { _id: "$_id" } },
      { $count: "total" }
    ]);
    
    const expiredCount = expiredResult[0]?.total ?? 0;
    console.log("📊 Monthly expired count:", expiredCount);

    // ====== ✅ TOP 3 EXPIRED FOODS (ALL TIME, sorted by qty) ======
    const topExpiredQuery = {
      ...(ownerId && { owner: ownerId }),
      status: "expired"
    };
    
    let topExpired = [];
    try {
      const totalExpired = await Food.countDocuments(topExpiredQuery);
      if (totalExpired > 0) {
        topExpired = await Food.aggregate([
          { $match: topExpiredQuery },
          { $group: { 
            _id: "$name", 
            count: { $sum: { $ifNull: ["$qty", 0] } } 
          } },
          { $sort: { count: -1 } },
          { $limit: 3 },
          { $project: { name: "$_id", count: 1, _id: 0 } }
        ]);
        console.log("📊 Monthly - Top 3 expired foods:", JSON.stringify(topExpired, null, 2));
      }
    } catch (err) {
      console.error("🔥 Error in monthly topExpired aggregation:", err);
      topExpired = [];
    }

    // ====== ✅ TOP 3 CONSUMED FOODS (ALL TIME, sorted by qty) ======
    const topConsumedQuery = {
      ...(ownerId && { owner: ownerId }),
      status: "consumed"
    };
    
    let topConsumed = [];
    try {
      const totalConsumed = await Food.countDocuments(topConsumedQuery);
      if (totalConsumed > 0) {
        topConsumed = await Food.aggregate([
          { $match: topConsumedQuery },
          { $group: { 
            _id: "$name", 
            count: { $sum: { $ifNull: ["$qty", 0] } } 
          } },
          { $sort: { count: -1 } },
          { $limit: 3 },
          { $project: { name: "$_id", count: 1, _id: 0 } }
        ]);
        console.log("📊 Monthly - Top 3 consumed foods:", JSON.stringify(topConsumed, null, 2));
      }
    } catch (err) {
      console.error("🔥 Error in monthly topConsumed aggregation:", err);
      topConsumed = [];
    }

    // ====== ✅ TOP 3 DONATED FOODS (ALL TIME, sorted by qty) ======
    const topDonatedQuery = {
      ...(ownerId && { owner: ownerId })
    };
    
    let topDonated = [];
    try {
      const totalDonations = await DonationList.countDocuments(topDonatedQuery);
      if (totalDonations > 0) {
        topDonated = await DonationList.aggregate([
          { $match: topDonatedQuery },
          { 
            $lookup: {
              from: 'foods',
              localField: 'foodId',
              foreignField: '_id',
              as: 'food'
            }
          },
          { $unwind: { path: '$food', preserveNullAndEmptyArrays: false } },
          { $group: { 
            _id: "$food.name",
            count: { $sum: { $ifNull: ["$qty", 0] } }
          } },
          { $sort: { count: -1 } },
          { $limit: 3 },
          { $project: { name: "$_id", count: 1, _id: 0 } }
        ]);
        console.log("📊 Monthly - Top 3 donated foods:", JSON.stringify(topDonated, null, 2));
      }
    } catch (err) {
      console.error("🔥 Error in monthly topDonated aggregation:", err);
      topDonated = [];
    }

    // Ensure all arrays are always arrays (never null/undefined)
    const safeTopExpired = Array.isArray(topExpired) ? topExpired : [];
    const safeTopConsumed = Array.isArray(topConsumed) ? topConsumed : [];
    const safeTopDonated = Array.isArray(topDonated) ? topDonated : [];

    const result = {
      header: {
        consumed: consumedCount,
        donation: donationCount,
        expired: expiredCount
      },
      pie: {
        labels: ["Consumed", "Donation", "Expired"],
        values: [consumedCount, donationCount, expiredCount]
      },
      topExpired: safeTopExpired,
      topConsumed: safeTopConsumed,
      topDonated: safeTopDonated
    };
    
    console.log("✅ Monthly final result:", JSON.stringify(result, null, 2));
    return res.json(result);

  } catch (err) {
    console.error("🔥 analytics/monthly error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
