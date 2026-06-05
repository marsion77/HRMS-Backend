require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const User = require('./models/User');

// Connect to Database
connectDB();

const app = express();

// Middlewares
app.use(cors({
  origin: '*', // Dynamic CORS support for frontend/backend cross-origin hosting
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Seeding Super Admin on startup
const seedSuperAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: 'Super Admin' });
    if (!adminExists) {
      console.log('No Super Admin found. Seeding default Super Admin account...');
      const superAdmin = new User({
        name: 'Super Admin',
        email: 'superadmin@apex-hrms.com',
        password: 'SuperAdminSecure123!', // Automatically hashed by Mongoose pre-save middleware
        role: 'Super Admin',
        status: 'Active'
      });
      await superAdmin.save();
      console.log('=================================================');
      console.log('Super Admin Seeded Successfully!');
      console.log('Email: superadmin@apex-hrms.com');
      console.log('Password: SuperAdminSecure123!');
      console.log('=================================================');
    } else {
      console.log('Super Admin account already seeded.');
    }
  } catch (error) {
    console.error('Error seeding Super Admin:', error.message);
  }
};

// Run Seeding
seedSuperAdmin();

// Routes Mapping
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/hr', require('./routes/hr'));
app.use('/api/employee', require('./routes/employee'));

// Basic health check route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'Apex-HRMS-Backend' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
