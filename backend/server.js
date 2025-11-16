// server.js - Backend Server with MQTT and Socket.IO
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store latest data and alerts
let vehicleData = {
  pitch: 0,
  roll: 0,
  acceleration: 9.8,
  gyro: 0,
  status: 'normal',
  timestamp: Date.now()
};

let alerts = [];
let stats = {
  totalAlerts: 0,
  accidents: 0,
  tilts: 0
};

// Connect to MQTT Broker
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com:1883');

mqttClient.on('connect', () => {
  console.log('✓ Connected to MQTT Broker');
  mqttClient.subscribe('vehicle/accident/alert');
  mqttClient.subscribe('vehicle/status');
  console.log('✓ Subscribed to vehicle topics');
});

mqttClient.on('error', (error) => {
  console.error('MQTT Connection Error:', error);
});

mqttClient.on('message', (topic, message) => {
  const data = message.toString();
  console.log(`\n📡 MQTT Message from ${topic}:`);
  console.log(data);

  try {
    if (topic === 'vehicle/accident/alert') {
      // Parse accident/tilt alert
      const alertData = JSON.parse(data);
      
      // Determine alert type based on alert message
      let alertType = 'Tilt';
      if (alertData.alert.includes('COLLISION') || alertData.alert.includes('IMPACT')) {
        alertType = 'Accident';
      }
      
      const alert = {
        id: Date.now(),
        type: alertData.alert,
        timestamp: new Date().toLocaleString(),
        data: {
          pitch: alertData.pitch,
          roll: alertData.roll,
          acceleration: alertData.acceleration,
          gyro: alertData.gyro,
          severity: alertData.severity || 2,
          accelDelta: alertData.accelDelta
        }
      };

      // Store alert
      alerts.unshift(alert);
      if (alerts.length > 100) alerts = alerts.slice(0, 100);

      // Update statistics
      stats.totalAlerts++;
      if (alertType === 'Accident') {
        stats.accidents++;
      } else {
        stats.tilts++;
      }

      console.log(`🚨 ${alertType.toUpperCase()} ALERT DETECTED!`);
      console.log(`   Severity: ${alert.data.severity === 2 ? 'CRITICAL' : 'WARNING'}`);
      console.log(`   Pitch: ${alert.data.pitch}° | Roll: ${alert.data.roll}°`);
      
      // Broadcast alert to all connected clients
      io.emit('alert', alert);
      io.emit('stats', stats);
      
    } else if (topic === 'vehicle/status') {
      // Parse normal status update
      try {
        const statusData = JSON.parse(data);
        
        vehicleData = {
          pitch: statusData.pitch || 0,
          roll: statusData.roll || 0,
          acceleration: statusData.acceleration || 9.8,
          gyro: statusData.gyro || 0,
          status: statusData.status || 'normal',
          timestamp: Date.now()
        };
        
        // Broadcast updated vehicle data
        io.emit('vehicleData', vehicleData);
        
      } catch (e) {
        // If not JSON, try to parse as text
        const statusMatch = data.match(/Pitch: ([-\d.]+)° Roll: ([-\d.]+)°/);
        if (statusMatch) {
          vehicleData.pitch = parseFloat(statusMatch[1]);
          vehicleData.roll = parseFloat(statusMatch[2]);
          vehicleData.timestamp = Date.now();
          io.emit('vehicleData', vehicleData);
        }
      }
    }
  } catch (e) {
    console.error('Error processing message:', e);
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✓ Client connected:', socket.id);
  
  // Send current data to newly connected client
  socket.emit('vehicleData', vehicleData);
  socket.emit('alerts', alerts);
  socket.emit('stats', stats);

  socket.on('disconnect', () => {
    console.log('✗ Client disconnected:', socket.id);
  });
});

// REST API Endpoints
app.get('/api/vehicle/current', (req, res) => {
  res.json(vehicleData);
});

app.get('/api/alerts', (req, res) => {
  res.json({
    alerts: alerts,
    stats: stats
  });
});

app.get('/api/stats', (req, res) => {
  res.json(stats);
});

app.post('/api/alerts/clear', (req, res) => {
  const previousCount = alerts.length;
  alerts = [];
  stats = { totalAlerts: 0, accidents: 0, tilts: 0 };
  
  // Notify all clients
  io.emit('alerts', alerts);
  io.emit('stats', stats);
  
  console.log(`🗑️  Cleared ${previousCount} alerts`);
  res.json({ 
    message: 'Alerts cleared successfully',
    cleared: previousCount 
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    mqtt: mqttClient.connected ? 'connected' : 'disconnected',
    clients: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Vehicle Safety Monitor - Backend    ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🌐 MQTT Broker: broker.hivemq.com`);
  console.log('\n⏳ Waiting for vehicle data...\n');
});