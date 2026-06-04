const express = require('express');
const router = express.Router();
const { 
  login, 
  verifyActivationToken, 
  activateAccount, 
  getCurrentUser 
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.get('/activate/:token', verifyActivationToken);
router.post('/activate', activateAccount);
router.get('/me', protect, getCurrentUser);

module.exports = router;
