const express = require('express');
const router = express.Router();
const analytics = require('../controllers/analyticsController');
const auth = require('../middleware/auth');

// ✅ Protect route with JWT
router.get('/daily', auth, analytics.getDaily);

module.exports = router;
