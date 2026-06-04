const User = require('../models/User');
const crypto = require('crypto');
const { sendActivationEmail } = require('../services/emailService');

/**
 * Invite an HR user
 * POST /api/admin/hr
 */
const inviteHR = async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Please provide name and email' });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const hrUser = new User({
      name,
      email,
      role: 'HR',
      status: 'Pending',
      activationToken,
      activationTokenExpires
    });

    await hrUser.save();

    try {
      await sendActivationEmail(email, name, 'HR', activationToken);
    } catch (emailError) {
      console.error('Nodemailer Error: Failed to send HR invitation email:', emailError.message);
      // Rollback DB creation so they can try again
      await User.findByIdAndDelete(hrUser._id);
      return res.status(500).json({ 
        success: false, 
        message: 'Could not send activation email. HR invitation cancelled.' 
      });
    }

    res.status(201).json({
      success: true,
      message: 'HR invited successfully. Activation email sent.',
      hr: {
        id: hrUser._id,
        name: hrUser.name,
        email: hrUser.email,
        role: hrUser.role,
        status: hrUser.status
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all HR profiles
 * GET /api/admin/hrs
 */
const getHRProfiles = async (req, res) => {
  try {
    const hrs = await User.find({ role: 'HR' }).select('-password');
    res.status(200).json({
      success: true,
      hrs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  inviteHR,
  getHRProfiles
};
