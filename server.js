const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// Connect DB
mongoose.connect('mongodb://localhost:27017/billiard');

// Simple Table model
const Table = mongoose.model('Table', new mongoose.Schema({
  name: String,
  status: { type: String, enum: ['available', 'playing', 'occupied', 'maintenance'], default: 'available' },
  tableType: {
    name: String,
    hourlyRate: Number
  },
  currentSession: {
    startTime: Date
  }
}));

// Simple route
app.get('/api/v1/tables', async (req, res) => {
  try {
    const tables = await Table.find();
    res.json({ success: true, data: tables });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('🚀 Server running on http://192.168.1.6:3000');
});