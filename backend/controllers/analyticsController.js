// backend/controllers/analyticsController.js
console.log("📌 analyticsController loaded");
const Food = require('../models/Food');
const DonationList = require('../models/DonationList');

exports.getDaily = async (req, res) => {
  try {
    // ✅ owner filter (later will use JWT)
    const ownerId = req.user?.userId;

    // ✅ Malaysia time (+8) "today" range
    const now = new Date();
    const MYT_OFFSET = 8 * 60 * 60000; // +8 hours in ms

    const startMY = new Date(now.getTime() + MYT_OFFSET);
    startMY.setHours(0, 0, 0, 0);

    const endMY = new Date(now.getTime() + MYT_OFFSET);
    endMY.setHours(23, 59, 59, 999);

    // ✅ Convert MY local → UTC for Mongo query
    const startUTC = new Date(startMY.getTime() - MYT_OFFSET);
    const endUTC = new Date(endMY.getTime() - MYT_OFFSET);

    // ====== ✅ DAILY DONATION (donationList.createdAt is today) ======
    const donationToday = await DonationList.aggregate([
      {
        $match: {
          ...(ownerId && { owner: ownerId }),
          createdAt: { $gte: startUTC, $lte: endUTC }
        }
      },
      {
        $group: {
          _id: null,
          totalQty: { $sum: "$qty" }
        }
      }
    ]);

    const donationCount = donationToday[0]?.totalQty ?? 0;


    // ====== ✅ DAILY CONSUMED (status changed to consumed today) ======
    const consumedCount = await Food.countDocuments({
      ...(ownerId && { owner: ownerId }),
      status: "consumed",
      updatedAt: { $gte: startUTC, $lte: endUTC }
    });


    // ====== ✅ DAILY EXPIRED (status changed to expired today) ======
    // 🟢 FIX: you said status must be 'expired', not expiry < today
    const expiredCount = await Food.countDocuments({
      ...(ownerId && { owner: ownerId }),
      status: "expired",
      updatedAt: { $gte: startUTC, $lte: endUTC } // ✅ only today expired items
    });


    return res.json({
      header: {
        consumed: consumedCount,
        donation: donationCount,
        expired: expiredCount
      },
      pie: {
        labels: ["Consumed", "Donation", "Expired"],
        values: [consumedCount, donationCount, expiredCount]
      },
      topExpired: [] // next feature
    });

  } catch (err) {
    console.error("🔥 analytics/daily error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
