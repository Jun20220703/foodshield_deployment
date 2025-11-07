// routes/analyticsRoute.js
const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');
const auth = require('../middleware/auth');

router.get('/monthly', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const stats = await analyticsService.getMonthlyStats(userId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/yearly', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const stats = await analyticsService.getYearlyStats(userId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;
