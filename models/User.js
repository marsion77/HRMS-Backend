const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  profileImage: {
    type: String,
    default: null  // base64 encoded image string
  },
  password: {
    type: String,
    required: function () {
      // Password is only required once the account is active
      return this.status === 'Active';
    }
  },
  role: {
    type: String,
    enum: ['Super Admin', 'HR', 'Employee'],
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Active'],
    default: 'Pending'
  },
  activationToken: {
    type: String,
    select: false
  },
  activationTokenExpires: {
    type: Date
  },
  leaveAllocations: {
    sick: { type: Number, default: 12 },
    casual: { type: Number, default: 10 },
    other: { type: Number, default: 8 }
  },
  leaveUsed: {
    sick: { type: Number, default: 0 },
    casual: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Pre-save middleware to hash the password
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to verify password
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
