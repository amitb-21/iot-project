import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./App.css";

const socket = io("http://localhost:3001");

function App() {
  const [vehicleData, setVehicleData] = useState({
    pitch: 0,
    roll: 0,
    acceleration: 9.8,
    gyro: 0,
    status: "normal",
  });

  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalAlerts: 0,
    accidents: 0,
    tilts: 0,
  });

  const [connected, setConnected] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    // Create audio element for alerts
    audioRef.current = new Audio();

    socket.on("connect", () => {
      setConnected(true);
      console.log("Connected to server");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      console.log("Disconnected from server");
    });

    socket.on("vehicleData", (data) => {
      setVehicleData(data);

      // Update chart (keep last 30 data points)
      setChartData((prev) => {
        const newData = [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            pitch: Math.abs(data.pitch),
            roll: Math.abs(data.roll),
            acceleration: data.acceleration,
          },
        ];
        return newData.slice(-30);
      });
    });

    socket.on("alert", (alert) => {
      setAlerts((prev) => [alert, ...prev]);

      // Show full-screen alert popup
      setActiveAlert(alert);

      // Play alert sound
      playAlertSound(alert.data.severity || 2);

      // Browser notification
      if (Notification.permission === "granted") {
        const notification = new Notification(`🚨 ${alert.type}`, {
          body: `Pitch: ${alert.data.pitch}° | Roll: ${alert.data.roll}°\nAcceleration: ${alert.data.acceleration} m/s²`,
          icon: "🚗",
          requireInteraction: true,
          tag: "vehicle-alert",
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        setActiveAlert(null);
      }, 10000);
    });

    socket.on("alerts", (alertsList) => {
      setAlerts(alertsList);
    });

    socket.on("stats", (statsData) => {
      setStats(statsData);
    });

    // Request notification permission
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("vehicleData");
      socket.off("alert");
      socket.off("alerts");
      socket.off("stats");
    };
  }, []);

  const playAlertSound = (severity) => {
    // Create beep sound using Web Audio API
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const beepCount = severity === 2 ? 5 : 3;

    for (let i = 0; i < beepCount; i++) {
      setTimeout(() => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + 0.2
        );

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      }, i * 300);
    }
  };

  const dismissAlert = () => {
    setActiveAlert(null);
  };

  const clearAlerts = async () => {
    try {
      await fetch("http://localhost:3001/api/alerts/clear", { method: "POST" });
    } catch (error) {
      console.error("Error clearing alerts:", error);
    }
  };

  const getSeverityClass = (severity) => {
    return severity === 2 ? "critical" : severity === 1 ? "warning" : "normal";
  };

  const isWarning =
    Math.abs(vehicleData.pitch) > 30 || Math.abs(vehicleData.roll) > 30;
  const isCritical =
    Math.abs(vehicleData.pitch) > 50 || Math.abs(vehicleData.roll) > 50;

  return (
    <div className="app">
      {/* Full-Screen Alert Popup */}
      {activeAlert && (
        <div
          className={`alert-overlay ${getSeverityClass(
            activeAlert.data.severity
          )}`}
        >
          <div className="alert-popup">
            <div className="alert-icon">
              {activeAlert.data.severity === 2 ? "🚨" : "⚠️"}
            </div>
            <h1>{activeAlert.type}</h1>
            <div className="alert-details-popup">
              <div className="detail-item">
                <span className="detail-label">Pitch Angle:</span>
                <span className="detail-value">{activeAlert.data.pitch}°</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Roll Angle:</span>
                <span className="detail-value">{activeAlert.data.roll}°</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Impact Force:</span>
                <span className="detail-value">
                  {activeAlert.data.acceleration} m/s²
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Time:</span>
                <span className="detail-value">{activeAlert.timestamp}</span>
              </div>
            </div>
            <button onClick={dismissAlert} className="dismiss-btn">
              Acknowledge Alert
            </button>
          </div>
        </div>
      )}

      <header className="header">
        <div>
          <h1>🚗 Vehicle Safety Monitor</h1>
          <p>Real-time Collision & Rollover Detection System</p>
        </div>
        <div className={`status ${connected ? "connected" : "disconnected"}`}>
          <span className="status-dot"></span>
          {connected ? "Connected" : "Disconnected"}
        </div>
      </header>

      {/* Vehicle Status Indicator */}
      <div
        className={`vehicle-status ${
          isCritical ? "critical" : isWarning ? "warning" : "normal"
        }`}
      >
        <div className="vehicle-icon">🚙</div>
        <div className="status-text">
          <h2>
            {isCritical
              ? "CRITICAL ALERT"
              : isWarning
              ? "WARNING"
              : "NORMAL OPERATION"}
          </h2>
          <p>
            {isCritical
              ? "Immediate attention required!"
              : isWarning
              ? "Vehicle instability detected"
              : "All systems normal"}
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <h3>Total Alerts</h3>
          <div className="stat-value">{stats.totalAlerts}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💥</div>
          <h3>Collisions</h3>
          <div className="stat-value">{stats.accidents}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <h3>Tilt Events</h3>
          <div className="stat-value">{stats.tilts}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🕐</div>
          <h3>Uptime</h3>
          <div className="stat-value">{connected ? "Active" : "Offline"}</div>
        </div>
      </div>

      <div className="readings-grid">
        <div
          className={`reading-card ${
            Math.abs(vehicleData.pitch) > 30 ? "danger" : ""
          }`}
        >
          <h3>Pitch Angle</h3>
          <div className="reading-value">{vehicleData.pitch.toFixed(1)}°</div>
          <div className="reading-status">
            {Math.abs(vehicleData.pitch) > 50
              ? "CRITICAL"
              : Math.abs(vehicleData.pitch) > 30
              ? "WARNING"
              : "NORMAL"}
          </div>
          <div className="threshold-bar">
            <div className="threshold-marker" style={{ left: "33%" }}>
              30°
            </div>
            <div className="threshold-marker" style={{ left: "66%" }}>
              50°
            </div>
          </div>
        </div>

        <div
          className={`reading-card ${
            Math.abs(vehicleData.roll) > 30 ? "danger" : ""
          }`}
        >
          <h3>Roll Angle</h3>
          <div className="reading-value">{vehicleData.roll.toFixed(1)}°</div>
          <div className="reading-status">
            {Math.abs(vehicleData.roll) > 50
              ? "CRITICAL"
              : Math.abs(vehicleData.roll) > 30
              ? "WARNING"
              : "NORMAL"}
          </div>
          <div className="threshold-bar">
            <div className="threshold-marker" style={{ left: "33%" }}>
              30°
            </div>
            <div className="threshold-marker" style={{ left: "66%" }}>
              50°
            </div>
          </div>
        </div>

        <div className="reading-card">
          <h3>Acceleration</h3>
          <div className="reading-value">
            {vehicleData.acceleration.toFixed(2)}
          </div>
          <div className="reading-unit">m/s²</div>
        </div>

        <div className="reading-card">
          <h3>Rotation Rate</h3>
          <div className="reading-value">{vehicleData.gyro.toFixed(1)}</div>
          <div className="reading-unit">deg/s</div>
        </div>
      </div>

      <div className="chart-section">
        <h2>📈 Real-time Sensor Data</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="time" stroke="#888" />
            <YAxis
              stroke="#888"
              label={{
                value: "Degrees / m/s²",
                angle: -90,
                position: "insideLeft",
                fill: "#888",
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #444",
                borderRadius: "8px",
              }}
            />
            <Line
              type="monotone"
              dataKey="pitch"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Pitch (°)"
            />
            <Line
              type="monotone"
              dataKey="roll"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="Roll (°)"
            />
            <Line
              type="monotone"
              dataKey="acceleration"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="Accel (m/s²)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="alerts-section">
        <div className="alerts-header">
          <h2>🔔 Alert History</h2>
          <button onClick={clearAlerts} className="clear-btn">
            Clear All
          </button>
        </div>
        <div className="alerts-list">
          {alerts.length === 0 ? (
            <div className="no-alerts">
              <div className="no-alerts-icon">✅</div>
              <p>No alerts recorded</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-item ${
                  alert.type.toLowerCase().includes("collision")
                    ? "accident"
                    : "tilt"
                } ${getSeverityClass(alert.data.severity)}`}
              >
                <div className="alert-header-item">
                  <span className="alert-type-badge">
                    {alert.type.toLowerCase().includes("collision")
                      ? "💥 COLLISION"
                      : "⚠️ TILT"}
                  </span>
                  <span className="alert-time">{alert.timestamp}</span>
                </div>
                <div className="alert-type">{alert.type}</div>
                <div className="alert-details">
                  <span>Pitch: {alert.data.pitch}°</span>
                  <span>Roll: {alert.data.roll}°</span>
                  <span>Force: {alert.data.acceleration.toFixed(2)} m/s²</span>
                  {alert.data.severity && (
                    <span
                      className={`severity-badge ${getSeverityClass(
                        alert.data.severity
                      )}`}
                    >
                      {alert.data.severity === 2 ? "CRITICAL" : "WARNING"}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
