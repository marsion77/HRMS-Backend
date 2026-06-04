const express = require('express');
const router = express.Router();
const { inviteHR, getHRProfiles } = require('../controllers/adminController');
const { protect, checkRole } = require('../middleware/auth');

// All admin routes require authentication and Super Admin role
router.use(protect);
router.use(checkRole(['Super Admin']));

router.post('/hr', inviteHR);
router.get('/hrs', getHRProfiles);

module.exports = router;
