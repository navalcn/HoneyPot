import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import morgan from 'morgan'

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health Check Route
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED';
  res.status(200).json({
    status: 'UP',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});


export default app;
