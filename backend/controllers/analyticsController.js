// backend/controllers/analyticsController.js
console.log("📌 analyticsController loaded");
const mongoose = require('mongoose');
const Food = require('../models/Food');
const DonationList = require('../models/DonationList');

/**
 * Auto-update food items that have ALREADY expired (expiry date < today) to "expired" status
 * This ensures expired items don't show in inventory
 * IMPORTANT: This function IGNORES startUTC/endUTC parameters and only expires foods that have already passed their expiry date
 */
async function autoUpdateExpiredFoods(ownerId, startUTC, endUTC) {
  try {
    // Calculate today's start in Malaysia timezone (UTC+8), then convert to UTC
    // This ensures we only expire foods that have ALREADY passed their expiry date
    const now = new Date();
    const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // +8 hours in milliseconds
    
    // Get current time in MYT (add 8 hours to UTC)
    const nowMYT = new Date(now.getTime() + MYT_OFFSET_MS);
    
    // Extract year, month, day from MYT time
    const year = nowMYT.getUTCFullYear();
    const month = nowMYT.getUTCMonth();
    const day = nowMYT.getUTCDate();
    
    // Create today's start (00:00:00) in MYT as UTC date
    const todayStartMYT = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    
    // Convert MYT 00:00:00 to UTC (subtract 8 hours)
    const todayStartUTC = new Date(todayStartMYT.getTime() - MYT_OFFSET_MS);
    
    console.log(`📅 Auto-expire check (ignoring startUTC/endUTC parameters):`);
    console.log(`   Current UTC: ${now.toISOString()}`);
    console.log(`   Today start UTC: ${todayStartUTC.toISOString()}`);
    console.log(`   Will expire foods with expiry < ${todayStartUTC.toISOString()}`);
    
    // Only update foods that have ALREADY expired (expiry < today's start in UTC)
    // IGNORE the startUTC/endUTC parameters passed from analytics API
    const updateResult = await Food.updateMany(
      {
        ...(ownerId && { owner: ownerId }),
        expiry: { $lt: todayStartUTC }, // Only foods that expired BEFORE today
        status: { $in: ["inventory", "donation"] } // Only update if still in inventory or donation status
      },
      { 
        $set: { status: "expired" }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log(`🔄 Auto-updated ${updateResult.modifiedCount} food items to expired status (expired before today)`);
    } else {
      console.log(`✅ No foods to auto-expire (all foods are still valid)`);
    }
    return updateResult.modifiedCount;
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
      await autoUpdateExpiredFoods(ownerId, startUTC, endUTC);
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
        createdAt: { $gte: startUTC, $lte: endUTC }
      }).limit(3).select('name status createdAt qty');
      const todayExpiredSamples = await Food.find({
        owner: ownerId,
        status: "expired",
        updatedAt: { $gte: startUTC, $lte: endUTC }
      }).limit(3).select('name status updatedAt');
      console.log("🔍 Debug - Today's consumed samples:", todayConsumedSamples);
      console.log("🔍 Debug - Today's expired samples:", todayExpiredSamples);
    }

    // ====== ✅ DAILY DONATION (donationList.createdAt is today) ======
    // Sum qty of donations made today (e.g., if 5 watermelons donated, count = 5, not 1)
    const donationMatch = {
      ...(ownerId && { owner: ownerId }),
      createdAt: { $gte: startUTC, $lte: endUTC }
    };
    console.log("🔍 Donation match filter:", JSON.stringify(donationMatch, null, 2));
    
    // ✅ IMPORTANT: Sum qty (quantity) not count documents
    // If 5 watermelons donated, donationCount = 5 (sum of qty), not 1 (count of items)
    const donationToday = await DonationList.aggregate([
      { $match: donationMatch },
      {
        $group: {
          _id: null,
          totalQty: { $sum: { $ifNull: ["$qty", 0] } } // Sum all qty values
        }
      }
    ]);

    console.log("🔍 Debug - Daily donation aggregation result:", JSON.stringify(donationToday, null, 2));
    const donationCount = donationToday[0]?.totalQty ?? 0; // Use totalQty (sum of qty)
    console.log("📊 Daily Donation count (qty sum):", donationCount);
    
    // Debug: Show donation samples with qty
    if (ownerId) {
      const donationSamples = await DonationList.find(donationMatch).select('qty createdAt foodId');
      console.log("🔍 Debug - Today's donation samples with qty:", JSON.stringify(donationSamples, null, 2));
      const manualSum = donationSamples.reduce((sum, item) => sum + (item.qty || 0), 0);
      console.log("🔍 Debug - Manual qty sum:", manualSum);
    }

    // ====== ✅ DAILY CONSUMED (status changed to consumed today) ======
    // Sum qty of foods consumed today (e.g., if 7 apples consumed, count = 7, not 1)
    const consumedMatch = {
      ...(ownerId && { owner: ownerId }),
      status: "consumed",
      createdAt: { $gte: startUTC, $lte: endUTC }
    };
    console.log("🔍 Consumed match filter:", JSON.stringify(consumedMatch, null, 2));
    
    // ✅ IMPORTANT: Sum qty (quantity) not count documents
    // If 7 apples consumed, consumedCount = 7 (sum of qty), not 1 (count of items)
    let consumedCount = 0;
    try {
      const consumedResult = await Food.aggregate([
        { $match: consumedMatch },
        {
          $group: {
            _id: null,
            totalQty: { $sum: { $ifNull: ["$qty", 0] } } // Sum all qty values
          }
        }
      ]);
      
      console.log("🔍 Debug - Daily consumed aggregation result:", JSON.stringify(consumedResult, null, 2));
      consumedCount = (consumedResult && consumedResult.length > 0 && consumedResult[0].totalQty) ? consumedResult[0].totalQty : 0;
      console.log("📊 Daily Consumed count (qty sum):", consumedCount);
      
      // Debug: Show consumed samples with qty
      if (ownerId) {
        const consumedSamples = await Food.find(consumedMatch).select('name qty createdAt');
        console.log("🔍 Debug - Today's consumed samples with qty:", JSON.stringify(consumedSamples, null, 2));
        const manualSum = consumedSamples.reduce((sum, item) => sum + (item.qty || 0), 0);
        console.log("🔍 Debug - Manual qty sum:", manualSum);
        console.log("🔍 Debug - Aggregation sum:", consumedCount);
        if (manualSum !== consumedCount) {
          console.error("⚠️ WARNING: Manual sum and aggregation sum don't match!");
        }
      }
    } catch (err) {
      console.error("🔥 Error in consumed aggregation:", err);
      consumedCount = 0;
    }

    // ====== ✅ DAILY EXPIRED (expiry date is today only) ======
    // Sum qty of foods that expire today (e.g., if 5 watermelons expired, count = 5, not 1)
    const expiredTodayQuery = {
      ...(ownerId && { owner: ownerId }),
      expiry: { 
        $gte: startUTC, 
        $lte: endUTC 
      },
      status: "expired"
    };
    console.log("🔍 Expired match filter:", JSON.stringify(expiredTodayQuery, null, 2));
    
    // ✅ IMPORTANT: Sum qty (quantity) not count documents
    // If 5 watermelons expired, expiredCount = 5 (sum of qty), not 1 (count of items)
    const expiredResult = await Food.aggregate([
      { $match: expiredTodayQuery },
      {
        $group: {
          _id: null,
          totalQty: { $sum: { $ifNull: ["$qty", 0] } }, // Sum all qty values
          count: { $sum: 1 } // Count of items (for debugging only)
        }
      }
    ]);
    
    console.log("🔍 Debug - Expired aggregation result:", JSON.stringify(expiredResult, null, 2));
    const expiredCount = expiredResult[0]?.totalQty ?? 0; // Use totalQty (sum of qty)
    console.log("📊 Daily Expired count (qty sum):", expiredCount, "| items count:", expiredResult[0]?.count ?? 0);
    
    // Additional debug: Show all matching items with their qty
    if (ownerId) {
      const allExpiredItems = await Food.find(expiredTodayQuery).select('name qty expiry status');
      console.log("🔍 Debug - All expired items today with qty:", JSON.stringify(allExpiredItems, null, 2));
      const manualSum = allExpiredItems.reduce((sum, item) => sum + (item.qty || 0), 0);
      console.log("🔍 Debug - Manual qty sum:", manualSum);
    }
    
    // Debug: Show expired samples
    if (ownerId) {
      const expiredSamples = await Food.find(expiredTodayQuery)
        .limit(5)
        .select('name status expiry updatedAt');
      console.log("🔍 Debug - Today's expired samples:", expiredSamples);
    }

    // ====== ✅ TOP 3 EXPIRED FOODS (TODAY, sorted by qty) ======
    const topExpiredQuery = {
      ...(ownerId && { owner: ownerId }),
      status: "expired",
      expiry: { 
        $gte: startUTC, 
        $lte: endUTC 
      }
    };
    console.log("🔍 Top Expired Query (TODAY):", JSON.stringify(topExpiredQuery, null, 2));
    
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

    // ====== ✅ TOP 3 CONSUMED FOODS (TODAY, sorted by qty) ======
    const topConsumedQuery = {
      ...(ownerId && { owner: ownerId }),
      status: "consumed",
      createdAt: { $gte: startUTC, $lte: endUTC }
    };
    console.log("🔍 Top Consumed Query (TODAY):", JSON.stringify(topConsumedQuery, null, 2));
    
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

    // ====== ✅ TOP 3 DONATED FOODS (TODAY, sorted by qty) ======
    // Note: DonationList has foodId reference, need to lookup Food to get name
    const topDonatedQuery = {
      ...(ownerId && { owner: ownerId }),
      createdAt: { $gte: startUTC, $lte: endUTC }
    };
    console.log("🔍 Top Donated Query (TODAY):", JSON.stringify(topDonatedQuery, null, 2));
    
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
      await autoUpdateExpiredFoods(ownerId, startUTC, endUTC);
    }

    // ====== ✅ MONTHLY DONATION (donationList.createdAt is this month) ======
    // Sum qty of donations made this month (e.g., if 5 watermelons donated, count = 5, not 1)
    const donationMatch = {
      ...(ownerId && { owner: ownerId }),
      createdAt: { $gte: startUTC, $lte: endUTC }
    };
    
    // ✅ IMPORTANT: Sum qty (quantity) not count documents
    // If 5 watermelons donated, donationCount = 5 (sum of qty), not 1 (count of items)
    const donationThisMonth = await DonationList.aggregate([
      { $match: donationMatch },
      {
        $group: {
          _id: null,
          totalQty: { $sum: { $ifNull: ["$qty", 0] } } // Sum all qty values
        }
      }
    ]);

    console.log("🔍 Debug - Monthly donation aggregation result:", JSON.stringify(donationThisMonth, null, 2));
    const donationCount = donationThisMonth[0]?.totalQty ?? 0; // Use totalQty (sum of qty)
    console.log("📊 Monthly Donation count (qty sum):", donationCount);
    
    // Debug: Show donation samples with qty
    if (ownerId) {
      const donationSamples = await DonationList.find(donationMatch).select('qty createdAt foodId');
      console.log("🔍 Debug - This month's donation samples with qty:", JSON.stringify(donationSamples, null, 2));
      const manualSum = donationSamples.reduce((sum, item) => sum + (item.qty || 0), 0);
      console.log("🔍 Debug - Manual qty sum:", manualSum);
    }

    // ====== ✅ MONTHLY CONSUMED (status changed to consumed this month) ======
    // Sum qty of foods consumed this month (e.g., if 7 apples consumed, count = 7, not 1)
    // IMPORTANT: Only count consumed items created THIS MONTH up to NOW (not future dates)
    const nowUTC = new Date();
    // Use the earlier of endUTC (end of month) or nowUTC (current time) to exclude future dates
    const maxCreatedAt = nowUTC < endUTC ? nowUTC : endUTC;
    
    const consumedMatch = {
      ...(ownerId && { owner: ownerId }),
      status: "consumed",
      createdAt: { $gte: startUTC, $lte: maxCreatedAt } // Only up to current time, not future
    };
    console.log("🔍 Monthly Consumed match filter:", JSON.stringify(consumedMatch, null, 2));
    console.log("🔍 Monthly date range - startUTC:", startUTC, "maxCreatedAt:", maxCreatedAt, "endUTC:", endUTC, "nowUTC:", nowUTC);
    
    // ✅ IMPORTANT: Sum qty (quantity) not count documents
    // If 7 apples consumed, consumedCount = 7 (sum of qty), not 1 (count of items)
    let consumedCount = 0;
    try {
      const consumedResult = await Food.aggregate([
        { $match: consumedMatch },
        {
          $group: {
            _id: null,
            totalQty: { $sum: { $ifNull: ["$qty", 0] } }, // Sum all qty values
            itemCount: { $sum: 1 } // Count of items for debugging
          }
        }
      ]);
      
      console.log("🔍 Debug - Monthly consumed aggregation result:", JSON.stringify(consumedResult, null, 2));
      consumedCount = (consumedResult && consumedResult.length > 0 && consumedResult[0].totalQty) ? consumedResult[0].totalQty : 0;
      const itemCount = (consumedResult && consumedResult.length > 0 && consumedResult[0].itemCount) ? consumedResult[0].itemCount : 0;
      console.log("📊 Monthly Consumed count (qty sum):", consumedCount, "| items count:", itemCount);
      
      // Debug: Show consumed samples with qty
      if (ownerId) {
        const consumedSamples = await Food.find(consumedMatch)
          .select('name qty createdAt status')
          .sort({ createdAt: -1 })
          .limit(10);
        console.log("🔍 Debug - This month's consumed samples (last 10):", JSON.stringify(consumedSamples, null, 2));
        const manualSum = consumedSamples.reduce((sum, item) => sum + (item.qty || 0), 0);
        console.log("🔍 Debug - Manual qty sum (from samples):", manualSum);
        console.log("🔍 Debug - Aggregation sum (all items):", consumedCount);
        
        // Check for duplicate consumed items (same name, same createdAt within 1 second)
        const duplicates = [];
        for (let i = 0; i < consumedSamples.length; i++) {
          for (let j = i + 1; j < consumedSamples.length; j++) {
            const item1 = consumedSamples[i];
            const item2 = consumedSamples[j];
            if (item1.name === item2.name && 
                Math.abs(new Date(item1.createdAt) - new Date(item2.createdAt)) < 1000) {
              duplicates.push({ item1, item2 });
            }
          }
        }
        if (duplicates.length > 0) {
          console.error("⚠️ WARNING: Found potential duplicate consumed items:", duplicates);
        }
      }
    } catch (err) {
      console.error("🔥 Error in monthly consumed aggregation:", err);
      consumedCount = 0;
    }

    // ====== ✅ MONTHLY EXPIRED (expiry date is this month and has already expired) ======
    // Sum qty of foods that expired this month (e.g., if 5 watermelons expired, count = 5, not 1)
    // Reuse nowUTC from above (line 487) - use the earlier of endUTC (end of month) or nowUTC (current time) to exclude future dates
    const maxExpiryDate = nowUTC < endUTC ? nowUTC : endUTC;
    const expiredThisMonthQuery = {
      ...(ownerId && { owner: ownerId }),
      expiry: { 
        $gte: startUTC, 
        $lte: maxExpiryDate // Only include items that have already expired (not future dates)
      },
      status: "expired"
    };
    
    // Debug: Check what items match the query
    if (ownerId) {
      const expiredSamples = await Food.find(expiredThisMonthQuery)
        .limit(5)
        .select('name status expiry qty updatedAt createdAt');
      console.log("🔍 Debug - Monthly expired samples:", expiredSamples);
      console.log("🔍 Debug - Monthly expired query date range:", { startUTC, maxExpiryDate, nowUTC, endUTC });
      
      // Also check if there are expired items outside this month
      const allExpired = await Food.countDocuments({ 
        ...(ownerId && { owner: ownerId }),
        status: "expired"
      });
      console.log("🔍 Debug - Total expired items (all time):", allExpired);
    }
    
    // ✅ IMPORTANT: Sum qty (quantity) not count documents
    // If 5 watermelons expired, expiredCount = 5 (sum of qty), not 1 (count of items)
    const expiredResult = await Food.aggregate([
      { $match: expiredThisMonthQuery },
      {
        $group: {
          _id: null,
          totalQty: { $sum: { $ifNull: ["$qty", 0] } }, // Sum all qty values
          count: { $sum: 1 } // Count of items (for debugging only)
        }
      }
    ]);
    
    console.log("🔍 Debug - Monthly expired aggregation result:", JSON.stringify(expiredResult, null, 2));
    const expiredCount = expiredResult[0]?.totalQty ?? 0; // Use totalQty (sum of qty)
    console.log("📊 Monthly Expired count (qty sum):", expiredCount, "| items count:", expiredResult[0]?.count ?? 0);
    
    // Additional debug: Show all matching items with their qty
    if (ownerId) {
      const allExpiredItems = await Food.find(expiredThisMonthQuery).select('name qty expiry status');
      console.log("🔍 Debug - All expired items this month with qty:", JSON.stringify(allExpiredItems, null, 2));
      const manualSum = allExpiredItems.reduce((sum, item) => sum + (item.qty || 0), 0);
      console.log("🔍 Debug - Manual qty sum:", manualSum);
    }

    // ====== ✅ TOP 3 EXPIRED FOODS (THIS MONTH, sorted by qty) ======
    const topExpiredQuery = {
      ...(ownerId && { owner: ownerId }),
      status: "expired",
      expiry: { 
        $gte: startUTC, 
        $lte: maxExpiryDate // Only include items that have already expired (not future dates)
      }
    };
    
    console.log("🔍 Monthly Top Expired Query:", JSON.stringify(topExpiredQuery, null, 2));
    
    let topExpired = [];
    try {
      const totalExpired = await Food.countDocuments(topExpiredQuery);
      console.log("🔍 Total expired items in monthly range:", totalExpired);
      
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
      } else {
        console.log("⚠️ No expired foods found in monthly range");
      }
    } catch (err) {
      console.error("🔥 Error in monthly topExpired aggregation:", err);
      topExpired = [];
    }

    // ====== ✅ TOP 3 CONSUMED FOODS (THIS MONTH, sorted by qty) ======
    // Use the same maxCreatedAt to exclude future dates
    const topConsumedQuery = {
      ...(ownerId && { owner: ownerId }),
      status: "consumed",
      createdAt: { $gte: startUTC, $lte: maxCreatedAt } // Only up to current time, not future
    };
    
    console.log("🔍 Monthly Top Consumed Query:", JSON.stringify(topConsumedQuery, null, 2));
    console.log("🔍 Monthly date range for top consumed - startUTC:", startUTC, "maxCreatedAt:", maxCreatedAt, "endUTC:", endUTC);
    
    let topConsumed = [];
    try {
      // Debug: Check all consumed items first
      if (ownerId) {
        const allConsumed = await Food.find({
          ...(ownerId && { owner: ownerId }),
          status: "consumed"
        }).limit(5).select('name qty createdAt').sort({ createdAt: -1 });
        console.log("🔍 Debug - All consumed items (last 5):", allConsumed);
        
        const consumedInRange = await Food.find(topConsumedQuery).limit(5).select('name qty createdAt');
        console.log("🔍 Debug - Consumed items in monthly range:", consumedInRange);
      }
      
      const totalConsumed = await Food.countDocuments(topConsumedQuery);
      console.log("🔍 Total consumed items in monthly range:", totalConsumed);
      
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
      } else {
        console.log("⚠️ No consumed foods found in monthly range");
      }
    } catch (err) {
      console.error("🔥 Error in monthly topConsumed aggregation:", err);
      topConsumed = [];
    }

    // ====== ✅ TOP 3 DONATED FOODS (THIS MONTH, sorted by qty) ======
    const topDonatedQuery = {
      ...(ownerId && { owner: ownerId }),
      createdAt: { $gte: startUTC, $lte: endUTC }
    };
    
    console.log("🔍 Monthly Top Donated Query:", JSON.stringify(topDonatedQuery, null, 2));
    
    let topDonated = [];
    try {
      const totalDonations = await DonationList.countDocuments(topDonatedQuery);
      console.log("🔍 Total donations in monthly range:", totalDonations);
      
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
      } else {
        console.log("⚠️ No donations found in monthly range");
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
