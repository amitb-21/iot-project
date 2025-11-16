#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <WiFi.h>
#include <PubSubClient.h>

// WiFi credentials
const char *ssid = "Wokwi-GUEST";
const char *password = "";

// MQTT Broker settings
const char *mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char *mqtt_topic_alert = "vehicle/accident/alert";
const char *mqtt_topic_status = "vehicle/status";

// MPU6050 object
Adafruit_MPU6050 mpu;

// WiFi and MQTT clients
WiFiClient espClient;
PubSubClient client(espClient);

// Detection Thresholds (Calibrated for real vehicle scenarios)
const float TILT_ANGLE_THRESHOLD = 30.0;    // Vehicle tilted > 30 degrees (rollover risk)
const float SEVERE_TILT_THRESHOLD = 50.0;   // Severe tilt (likely rollover)
const float IMPACT_ACCEL_THRESHOLD = 30.0;  // Sudden acceleration > 3G (collision)
const float SEVERE_IMPACT_THRESHOLD = 50.0; // Severe impact > 5G
const float NORMAL_GRAVITY = 9.81;          // Normal gravity baseline

// LED and Buzzer pins
const int LED_GREEN = 25;
const int LED_RED = 26;
const int BUZZER = 27;

// State tracking
bool alertActive = false;
unsigned long lastMqttPublish = 0;
unsigned long alertCooldown = 0;
const unsigned long MQTT_PUBLISH_INTERVAL = 1000; // Send status every 1 second
const unsigned long ALERT_COOLDOWN_PERIOD = 5000; // 5 seconds between alerts

// Baseline calibration
float baselineAccelMagnitude = 0;
bool calibrated = false;

void setup()
{
    Serial.begin(115200);

    pinMode(LED_GREEN, OUTPUT);
    pinMode(LED_RED, OUTPUT);
    pinMode(BUZZER, OUTPUT);

    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_RED, LOW);
    digitalWrite(BUZZER, LOW);

    Serial.println("\n=== Vehicle Safety System Initializing ===");

    // Initialize MPU6050
    if (!mpu.begin())
    {
        Serial.println("ERROR: MPU6050 not found!");
        while (1)
            delay(10);
    }
    Serial.println("✓ MPU6050 Connected");

    // Configure MPU6050 with appropriate ranges
    mpu.setAccelerometerRange(MPU6050_RANGE_16_G); // Can detect up to 16G
    mpu.setGyroRange(MPU6050_RANGE_250_DEG);       // ±250 deg/s
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);    // Low-pass filter

    // Calibrate baseline (vehicle at rest)
    Serial.println("Calibrating baseline... Keep vehicle still");
    delay(1000);
    calibrateBaseline();

    // Connect to WiFi
    setupWiFi();

    // Setup MQTT
    client.setServer(mqtt_server, mqtt_port);

    Serial.println("=== System Ready ===\n");
}

void calibrateBaseline()
{
    float sumAccel = 0;
    int samples = 50;

    for (int i = 0; i < samples; i++)
    {
        sensors_event_t a, g, temp;
        mpu.getEvent(&a, &g, &temp);
        float mag = sqrt(pow(a.acceleration.x, 2) +
                         pow(a.acceleration.y, 2) +
                         pow(a.acceleration.z, 2));
        sumAccel += mag;
        delay(20);
    }

    baselineAccelMagnitude = sumAccel / samples;
    calibrated = true;
    Serial.printf("✓ Baseline calibrated: %.2f m/s²\n", baselineAccelMagnitude);
}

void setupWiFi()
{
    Serial.print("Connecting to WiFi");
    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.println("\n✓ WiFi Connected");
    Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
}

void reconnectMQTT()
{
    while (!client.connected())
    {
        Serial.print("Connecting to MQTT...");
        String clientId = "VehicleSafety-" + String(random(0xffff), HEX);

        if (client.connect(clientId.c_str()))
        {
            Serial.println("✓ MQTT Connected");
            client.publish(mqtt_topic_status, "{\"status\":\"online\"}");
        }
        else
        {
            Serial.printf("✗ Failed (rc=%d). Retry in 5s\n", client.state());
            delay(5000);
        }
    }
}

void loop()
{
    if (!client.connected())
    {
        reconnectMQTT();
    }
    client.loop();

    // Read sensor data
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    // Calculate orientation angles (in degrees)
    // Pitch: Forward/Backward tilt
    // Roll: Left/Right tilt
    float pitch = atan2(a.acceleration.y, sqrt(pow(a.acceleration.x, 2) + pow(a.acceleration.z, 2))) * 180.0 / PI;
    float roll = atan2(-a.acceleration.x, sqrt(pow(a.acceleration.y, 2) + pow(a.acceleration.z, 2))) * 180.0 / PI;

    // Calculate total acceleration magnitude
    float accelMagnitude = sqrt(pow(a.acceleration.x, 2) +
                                pow(a.acceleration.y, 2) +
                                pow(a.acceleration.z, 2));

    // Calculate deviation from baseline (detect impact/collision)
    float accelDeviation = abs(accelMagnitude - baselineAccelMagnitude);

    // Gyroscope magnitude (detect rapid rotation)
    float gyroMagnitude = sqrt(pow(g.gyro.x, 2) +
                               pow(g.gyro.y, 2) +
                               pow(g.gyro.z, 2)) *
                          180.0 / PI;

    // DETECTION LOGIC
    String alertType = "";
    int severity = 0; // 0: Normal, 1: Warning, 2: Critical

    // 1. Check for IMPACT/COLLISION (sudden acceleration change)
    if (accelDeviation > SEVERE_IMPACT_THRESHOLD)
    {
        alertType = "SEVERE COLLISION DETECTED";
        severity = 2;
    }
    else if (accelDeviation > IMPACT_ACCEL_THRESHOLD)
    {
        alertType = "IMPACT DETECTED";
        severity = 2;
    }

    // 2. Check for TILT/ROLLOVER (angle beyond safe threshold)
    else if (abs(pitch) > SEVERE_TILT_THRESHOLD || abs(roll) > SEVERE_TILT_THRESHOLD)
    {
        alertType = "CRITICAL ROLLOVER - VEHICLE OVERTURNED";
        severity = 2;
    }
    else if (abs(pitch) > TILT_ANGLE_THRESHOLD || abs(roll) > TILT_ANGLE_THRESHOLD)
    {
        alertType = "ROLLOVER WARNING - EXCESSIVE TILT";
        severity = 1;
    }

    // Trigger alert if detected and not in cooldown
    if (severity > 0 && millis() - alertCooldown > ALERT_COOLDOWN_PERIOD)
    {
        triggerAlert(alertType, severity, pitch, roll, accelMagnitude, accelDeviation, gyroMagnitude);
        alertCooldown = millis();
        alertActive = true;
    }

    // Normal operation
    if (severity == 0)
    {
        digitalWrite(LED_GREEN, HIGH);
        digitalWrite(LED_RED, LOW);
        digitalWrite(BUZZER, LOW);
        alertActive = false;
    }

    // Periodic status update
    if (millis() - lastMqttPublish > MQTT_PUBLISH_INTERVAL)
    {
        lastMqttPublish = millis();

        Serial.println("┌─────────────────────────────┐");
        Serial.printf("│ Pitch: %7.2f° Roll: %7.2f°\n", pitch, roll);
        Serial.printf("│ Accel: %6.2f m/s² (Δ%.2f)\n", accelMagnitude, accelDeviation);
        Serial.printf("│ Gyro: %7.2f deg/s\n", gyroMagnitude);
        Serial.printf("│ Status: %s\n", alertActive ? "⚠ ALERT" : "✓ Normal");
        Serial.println("└─────────────────────────────┘\n");

        // Publish status to MQTT
        if (!alertActive)
        {
            String statusMsg = "{\"pitch\":" + String(pitch, 2) +
                               ",\"roll\":" + String(roll, 2) +
                               ",\"acceleration\":" + String(accelMagnitude, 2) +
                               ",\"gyro\":" + String(gyroMagnitude, 2) +
                               ",\"status\":\"normal\"}";
            client.publish(mqtt_topic_status, statusMsg.c_str());
        }
    }

    delay(100);
}

void triggerAlert(String alertType, int severity, float pitch, float roll,
                  float accel, float accelDelta, float gyro)
{

    Serial.println("\n╔═══════════════════════════════════════╗");
    Serial.println("║          ⚠️  ALERT TRIGGERED  ⚠️         ║");
    Serial.println("╠═══════════════════════════════════════╣");
    Serial.printf("║ %s\n", alertType.c_str());
    Serial.println("╠═══════════════════════════════════════╣");
    Serial.printf("║ Pitch: %.2f° | Roll: %.2f°\n", pitch, roll);
    Serial.printf("║ Impact Force: %.2f m/s² (Δ%.2f)\n", accel, accelDelta);
    Serial.printf("║ Rotation: %.2f deg/s\n", gyro);
    Serial.printf("║ Severity: %s\n", severity == 2 ? "CRITICAL" : "WARNING");
    Serial.println("╚═══════════════════════════════════════╝\n");

    // Visual/Audio alert
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_RED, HIGH);

    // Different buzzer patterns based on severity
    int beepCount = severity == 2 ? 5 : 3;
    int beepDelay = severity == 2 ? 150 : 250;

    for (int i = 0; i < beepCount; i++)
    {
        digitalWrite(BUZZER, HIGH);
        delay(beepDelay);
        digitalWrite(BUZZER, LOW);
        delay(beepDelay);
    }

    // Publish MQTT alert
    String jsonPayload = "{";
    jsonPayload += "\"alert\":\"" + alertType + "\",";
    jsonPayload += "\"severity\":" + String(severity) + ",";
    jsonPayload += "\"pitch\":" + String(pitch, 2) + ",";
    jsonPayload += "\"roll\":" + String(roll, 2) + ",";
    jsonPayload += "\"acceleration\":" + String(accel, 2) + ",";
    jsonPayload += "\"accelDelta\":" + String(accelDelta, 2) + ",";
    jsonPayload += "\"gyro\":" + String(gyro, 2) + ",";
    jsonPayload += "\"timestamp\":" + String(millis()) + ",";
    jsonPayload += "\"location\":\"Simulated Location\"";
    jsonPayload += "}";

    client.publish(mqtt_topic_alert, jsonPayload.c_str());
    Serial.println("📡 Alert sent via MQTT");
}