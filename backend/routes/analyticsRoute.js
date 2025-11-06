const router = require("express").Router();
const FoodHistory = require("../models/FoodHistory");

// ✅ /api/analytics/month or /api/analytics/year
router.get("/:range", async (req, res) => {
  try {
    const range = req.params.range; // 'month' or 'year'
    const userId = req.user?._id || req.headers['x-user-id']; // adjust based on auth

    const now = new Date();
    const startDate = range === "month"
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), 0, 1);

    const result = await FoodHistory.aggregate([
      { $match: { owner: userId, createdAt: { $gte: startDate } } },
      { $group: { _id: "$action", total: { $sum: "$qty" } } }
    ]);

    res.json({
      header: {
        consumed: result.find(r => r._id === "consumed")?.total || 0,
        expired:  result.find(r => r._id === "expired")?.total  || 0,
        donation: result.find(r => r._id === "donated")?.total  || 0,
      },
      pie: {
        labels: ["Consumed", "Expired", "Donated"],
        values: [
          result.find(r => r._id === "consumed")?.total || 0,
          result.find(r => r._id === "expired")?.total  || 0,
          result.find(r => r._id === "donated")?.total  || 0,
        ]
      },
      topExpired: [] // later we handle this
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analytics error" });
  }
});

module.exports = router;
