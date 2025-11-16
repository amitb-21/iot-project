# 🚗 Vehicle Safety Monitor

A real-time collision and rollover detection system using ESP32, MPU6050 accelerometer/gyroscope, MQTT protocol, and a React-based web dashboard.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Hardware Requirements](#hardware-requirements)
- [Software Requirements](#software-requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Detection Thresholds](#detection-thresholds)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## 🎯 Overview

The Vehicle Safety Monitor is an IoT-based safety system that detects vehicle accidents (collisions) and rollover events in real-time using sensor data. It provides instant alerts through visual indicators, audio alarms, web notifications, and MQTT messaging.

### Key Capabilities

- **Collision Detection**: Identifies sudden impact forces (>20 m/s² deviation)
- **Rollover Detection**: Monitors vehicle tilt angles (>30° threshold)
- **Real-time Monitoring**: Live sensor data visualization
- **Alert System**: Multi-channel notifications (LED, buzzer, web, MQTT)
- **Historical Tracking**: Complete alert history with severity levels

## ✨ Features

### Hardware Features
- ✅ MPU6050 6-axis motion sensor integration
- ✅ Visual indicators (Green/Red LEDs)
- ✅ Audio alerts (Active buzzer)
- ✅ WiFi connectivity (ESP32)
- ✅ MQTT protocol support

### Software Features
- ✅ Real-time web dashboard
- ✅ Live sensor data charts
- ✅ Full-screen critical alerts
- ✅ Browser notifications
- ✅ Alert history with filtering
- ✅ Statistics tracking
- ✅ WebSocket communication
- ✅ RESTful API

## 🏗️ System Architecture

### Data Flow

**1. Sensor Reading**
   - ESP32 reads MPU6050 data via I2C (100ms intervals)
   - Calculates pitch, roll, acceleration, gyroscope values

**2. Event Detection**
   - Algorithm detects collision (acceleration deviation > 20 m/s²)
   - Or rollover (tilt angle > 30°)

**3. Alert Publishing**
   - ESP32 publishes to MQTT topics:
     - `vehicle/accident/alert` - Critical events
     - `vehicle/status` - Normal status updates

**4. Backend Processing**
   - Node.js subscribes to MQTT broker (HiveMQ)
   - Receives and processes messages
   - Stores alert history and statistics

**5. Real-time Display**
   - Backend broadcasts via Socket.IO to connected clients
   - React dashboard updates in real-time
   - Shows alerts, charts, and vehicle status

## 🔧 Hardware Requirements

| Component | Specification | Quantity |
|-----------|--------------|----------|
| ESP32 DevKit v1 | Main microcontroller | 1 |
| MPU6050 | 6-axis accelerometer + gyroscope | 1 |
| LED (Green) | Status indicator | 1 |
| LED (Red) | Alert indicator | 1 |
| Buzzer | Active buzzer (5V) | 1 |
| Resistor | 220Ω | 2 |
| Breadboard | Half-size or full-size | 1 |
| Jumper Wires | Male-to-male | 10+ |

### Pin Connections

```
MPU6050 → ESP32
├─ VCC  → 3.3V
├─ GND  → GND
├─ SCL  → GPIO 22
└─ SDA  → GPIO 21

LEDs & Buzzer → ESP32
├─ Green LED → GPIO 25 (via 220Ω resistor)
├─ Red LED   → GPIO 26 (via 220Ω resistor)
└─ Buzzer    → GPIO 27
```

## 💻 Software Requirements

### ESP32 (Wokwi Simulator)
- Wokwi ESP32 Simulator
- Arduino Libraries:
  - `Adafruit MPU6050`
  - `Adafruit Unified Sensor`
  - `PubSubClient` (MQTT)

### Backend
- Node.js v16+
- npm or yarn
- Dependencies:
  - `express` ^4.18.2
  - `socket.io` ^4.7.5
  - `mqtt` ^5.0.0
  - `cors` ^2.8.5

### Frontend
- Node.js v16+
- Vite
- React 18+
- Dependencies:
  - `socket.io-client`
  - `recharts` (charts)

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/vehicle-safety-monitor.git
cd vehicle-safety-monitor
```

### 2. Backend Setup

```bash
cd backend
npm install
npm start
```

The backend server runs on `http://localhost:3001`

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`

### 4. ESP32 Setup (Wokwi)

1. Go to [Wokwi.com](https://wokwi.com)
2. Create a new ESP32 project
3. Copy `esp32/sketch.ino` to the code editor
4. Copy `esp32/diagram.json` to setup hardware connections
5. Add libraries listed in `esp32/libraries.txt`
6. Click "Start Simulation"

## 🚀 Usage

### Starting the System

1. **Start Backend Server**
   ```bash
   cd backend
   npm start
   ```

2. **Start Frontend Dashboard**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Run ESP32 Simulation**
   - Open Wokwi project
   - Click "Start Simulation"
   - Wait for "System Ready" message

### Testing Collision Detection

1. In Wokwi, click on the MPU6050 sensor
2. Modify acceleration values:
   - **Collision Test**: Set Y-axis to `30` or `-10` m/s²
   - **Rollover Test**: Set X-axis to `15` m/s² (creates ~60° tilt)
3. Observe alerts on dashboard

### Dashboard Features

- **Vehicle Status Banner**: Shows current system state
- **Statistics Cards**: Total alerts, collisions, tilt events
- **Sensor Readings**: Real-time pitch, roll, acceleration, gyro
- **Live Chart**: Historical sensor data (last 30 points)
- **Alert History**: Scrollable list of all detected events

## ⚙️ Detection Thresholds

### Collision Detection
| Severity | Threshold | Description |
|----------|-----------|-------------|
| Normal | < 20 m/s² | No impact detected |
| Impact | ≥ 20 m/s² | Moderate collision (2G change) |
| Severe | ≥ 40 m/s² | High-impact collision (4G change) |

### Rollover Detection
| Severity | Threshold | Description |
|----------|-----------|-------------|
| Normal | < 30° | Stable operation |
| Warning | ≥ 30° | Excessive tilt detected |
| Critical | ≥ 50° | Vehicle likely overturned |

### Detection Priority
1. **Collision** (highest priority) - checks acceleration deviation
2. **Rollover** (secondary) - checks tilt angles when gyro < 150°/s

## 📡 API Endpoints

### GET `/api/vehicle/current`
Returns current vehicle sensor data
```json
{
  "pitch": 2.5,
  "roll": -1.2,
  "acceleration": 9.81,
  "gyro": 5.3,
  "status": "normal",
  "timestamp": 1234567890
}
```

### GET `/api/alerts`
Returns alert history and statistics
```json
{
  "alerts": [...],
  "stats": {
    "totalAlerts": 15,
    "accidents": 8,
    "tilts": 7
  }
}
```

### POST `/api/alerts/clear`
Clears all alert history
```json
{
  "message": "Alerts cleared successfully",
  "cleared": 15
}
```

### GET `/api/health`
System health check
```json
{
  "status": "online",
  "mqtt": "connected",
  "clients": 2,
  "uptime": 3600.5
}
```

## 🔍 Troubleshooting

### ESP32 Not Connecting to WiFi
- Verify Wokwi is using `Wokwi-GUEST` network
- Check serial monitor for connection status
- Restart simulation

### MQTT Connection Failed
- Ensure `broker.hivemq.com` is accessible
- Check firewall settings
- Verify port 1883 is not blocked

### Frontend Not Receiving Data
- Check backend is running on port 3001
- Verify Socket.IO connection in browser console
- Check CORS settings in `server.js`

### False Collision Alerts
- Recalibrate baseline (keep sensor still during startup)
- Adjust `IMPACT_ACCEL_THRESHOLD` in `sketch.ino`
- Check sensor mounting stability

### No Tilt Detection
- Verify gyro magnitude is below 150°/s for static tilt
- Check `TILT_ANGLE_THRESHOLD` value
- Ensure sensor orientation is correct

## 🛠️ Configuration

### Adjusting Thresholds (sketch.ino)
```cpp
const float TILT_ANGLE_THRESHOLD = 30.0;      // Adjust tilt sensitivity
const float SEVERE_TILT_THRESHOLD = 50.0;     // Critical tilt angle
const float IMPACT_ACCEL_THRESHOLD = 20.0;    // Impact detection
const float SEVERE_IMPACT_THRESHOLD = 40.0;   // Severe impact
```

### Changing MQTT Broker (sketch.ino & server.js)
```cpp
// ESP32
const char* mqtt_server = "your-broker.com";
```
```javascript
// Backend
const mqttClient = mqtt.connect('mqtt://your-broker.com:1883');
```

### Modifying Alert Cooldown
```cpp
const unsigned long ALERT_COOLDOWN_PERIOD = 5000; // 5 seconds
```

## 📊 Project Structure

```
vehicle-safety-monitor/
├── backend/
│   ├── server.js           # Node.js + MQTT + Socket.IO
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   ├── App.css        # Styling
│   │   └── main.jsx
│   └── package.json
├── esp32/
│   ├── sketch.ino         # ESP32 firmware
│   ├── diagram.json       # Wokwi circuit diagram
│   └── libraries.txt      # Required libraries
└── README.md
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Adafruit for MPU6050 libraries
- HiveMQ for free MQTT broker
- Wokwi for ESP32 simulation platform
- Recharts for data visualization

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Made with ❤️ for Vehicle Safety**
