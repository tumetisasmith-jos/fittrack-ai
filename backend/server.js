require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initializeDatabase } = require('./database');

// routes
const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const workoutRoutes      = require('./routes/workouts');
const dailyLogRoutes     = require('./routes/dailylogs');
const goalRoutes         = require('./routes/goals');
const bmiRoutes          = require('./routes/bmi');
const achievementRoutes  = require('./routes/achievements');
const notificationRoutes = require('./routes/notifications');
const adminRoutes        = require('./routes/admin');
const mealRoutes         = require('./routes/meals');
const exerciseRoutes     = require('./routes/exercises');
const scheduleRoutes     = require('./routes/schedules');
const heartRateRoutes    = require('./routes/heartrate');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/workouts',      workoutRoutes);
app.use('/api/daily-logs',    dailyLogRoutes);
app.use('/api/goals',         goalRoutes);
app.use('/api/bmi',           bmiRoutes);
app.use('/api/achievements',  achievementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/meals',         mealRoutes);
app.use('/api/exercises',     exerciseRoutes);
app.use('/api/schedules',     scheduleRoutes);
app.use('/api/heart-rate',    heartRateRoutes);

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

const PORT = process.env.PORT || 3000;

initializeDatabase();

app.listen(PORT, () => {
  console.log(`🚀 FitTrack AI Server running at http://localhost:${PORT}`);
  console.log(`📊 Admin: admin@fittrack.ai / admin123`);
  console.log(`👤 Demo: demo@fittrack.ai / demo123`);
});
