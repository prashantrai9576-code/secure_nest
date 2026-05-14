#include <WiFi.h>
#include <FirebaseESP32.h>
#include "secrets.h"

// --- PIN DEFINITIONS ---
#define RELAY_PIN     21  // Your verified relay pin
#define VIBRATION_PIN 13  // Tamper sensor
#define MAGNETIC_PIN  14  // Door sensor
#define BUZZER_PIN    15  // Alert buzzer

// --- GLOBAL STATE ---
FirebaseData firebaseData;
FirebaseAuth auth;
FirebaseConfig config;

bool isSystemUnlocked = false;
bool pendingAutoLock = false;
bool isTampering = false;
String lastStatus = "";
unsigned long unlockTime = 0;
bool doorWasOpened = false;
bool prevDoorState = false;

// --- CORE FUNCTIONS ---

// Optimized Relay Triggering (Floating-Logic for 5V Relay Compatibility)
void setLockState(bool isUnlocked) {
  isSystemUnlocked = isUnlocked;
  
  if (isUnlocked) {
    // To turn ON: Pull to GND
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW); 
    Serial.println(">>> [HARDWARE] GATE OPENED (Relay ON) - GND Pulled");
  } else {
    // To turn OFF: Let it float (High Impedance)
    // This allows the relay's internal 5V to take over and properly turn OFF
    pinMode(RELAY_PIN, INPUT); 
    Serial.println(">>> [HARDWARE] GATE SECURED (Relay OFF) - Floating");
  }
}

void triggerBuzzer(int duration, int count) {
  for(int i=0; i<count; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(duration);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < count - 1) delay(100);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(VIBRATION_PIN, INPUT_PULLDOWN); // Prevents false alarms if sensor is floating/disconnected
  pinMode(MAGNETIC_PIN, INPUT_PULLUP);
  
  // Initial state: SECURED
  setLockState(false);

  Serial.print("📡 Connecting to WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { 
    delay(500); 
    Serial.print("."); 
  }
  Serial.println("\n✅ WiFi Connected: " + WiFi.localIP().toString());

  // Firebase Config
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Boot Notification
  triggerBuzzer(100, 2);
  Firebase.setString(firebaseData, "/status/system", "Online");
  
  FirebaseJson bootAlert;
  bootAlert.set("title", "Secure Nest System Active");
  bootAlert.set("type", "system_status");
  bootAlert.set("timestamp", "ESP32_" + String(millis()));
  Firebase.pushJSON(firebaseData, "/alerts", bootAlert);
  
  Serial.println("🛡️ SECURE NEST [HARDWARE CORE] IS ACTIVE");
}

void loop() {
  // 1. HEARTBEAT & SENSOR SYNC (Every 2 seconds)
  static unsigned long lastHeartbeat = 0;
  bool isDoorOpen = (digitalRead(MAGNETIC_PIN) == HIGH); 
  
  if (millis() - lastHeartbeat > 2000) {
    lastHeartbeat = millis();
    
    // Attempt Heartbeat Sync with Error Handling
    if (Firebase.setInt(firebaseData, "/status/heartbeat", millis())) {
        Firebase.setString(firebaseData, "/status/door", isDoorOpen ? "open" : "closed");
        Firebase.setString(firebaseData, "/status/system", "Online");
        Serial.println("----------------------------------------");
        Serial.println("[FIREBASE] ✅ Heartbeat Sent");
        Serial.print("[SENSOR] Door: "); Serial.println(isDoorOpen ? "OPEN" : "CLOSED");
        Serial.print("[SYSTEM] Lock: "); Serial.println(isSystemUnlocked ? "UNLOCKED" : "SECURED");
        Serial.println("----------------------------------------");
    } else {
        Serial.print("[FIREBASE] ❌ Heartbeat Failed: ");
        Serial.println(firebaseData.errorReason());
    }
  }

  // 2. FIREBASE COMMAND POLLING (Every 500ms)
  static unsigned long lastPoll = 0;
  if (millis() - lastPoll > 500) {
    lastPoll = millis();
    if (Firebase.getString(firebaseData, "/locks/front_door/status")) {
      String status = firebaseData.stringData();
      status.replace("\"", ""); 
      status.trim();

      if (status != lastStatus) {
        lastStatus = status;
        Serial.print(">>> [FIREBASE] New Command: "); Serial.println(status);
        
        if (status == "unlocked" || status == "master_key") {
          setLockState(true);
          unlockTime = millis();
          pendingAutoLock = true;
          doorWasOpened = false;
          triggerBuzzer(400, 1);
        } else if (status == "locked") {
          setLockState(false);
          pendingAutoLock = false;
          triggerBuzzer(200, 1);
        } else if (status == "clear_alert") {
          isTampering = false;
          digitalWrite(BUZZER_PIN, LOW);
          Serial.println(">>> [SECURITY] Tamper Alert Cleared.");
          Firebase.setString(firebaseData, "/locks/front_door/status", "locked"); 
        }
      }
    } else if (firebaseData.errorReason() != "") {
        // Log polling errors if they occur
        Serial.print("[FIREBASE] ❌ Polling Error: ");
        Serial.println(firebaseData.errorReason());
    }
  }

  // 3. SMART GATE LOGIC (5-Second Auto-Lock)
  if (isSystemUnlocked && pendingAutoLock) {
    if (isDoorOpen) {
      doorWasOpened = true;
      unlockTime = millis(); 
    } else {
      unsigned long elapsed = millis() - unlockTime;
      if (elapsed >= 5000) {
        Serial.println(">>> [LOGIC] Timeout reached. SECURING GATE.");
        setLockState(false);
        pendingAutoLock = false;
        doorWasOpened = false; 
        lastStatus = "locked"; 
        Firebase.setString(firebaseData, "/locks/front_door/status", "locked");
        triggerBuzzer(100, 1);
      }
    }
  }

  // 4. TAMPER DETECTION (Smart Pulse Counter)
  static unsigned long tamperWindowStart = 0;
  static int tamperPulseCount = 0;
  const int TAMPER_THRESHOLD = 5; // Require 5 pulses within window to trigger (Increase to make less sensitive)
  const unsigned long TAMPER_WINDOW = 1000; // 1 second window
  
  // Reset the pulse counter every second
  if (millis() - tamperWindowStart > TAMPER_WINDOW) {
    tamperPulseCount = 0; 
    tamperWindowStart = millis();
  }

  // Detect the edge of a vibration
  static bool lastVibrationState = LOW;
  bool currentVibrationState = digitalRead(VIBRATION_PIN);
  
  if (currentVibrationState == HIGH && lastVibrationState == LOW) {
    tamperPulseCount++;
    Serial.print(">>> [SECURITY] Minor vibration detected. Pulse intensity: ");
    Serial.println(tamperPulseCount);
  }
  lastVibrationState = currentVibrationState;

  static unsigned long tamperStartTime = 0;

  // Only trigger the massive alarm if it crosses the threshold limit
  if (tamperPulseCount >= TAMPER_THRESHOLD && !isTampering) {
      isTampering = true;
      tamperStartTime = millis(); // Start the 5-second buzzer timer
      Serial.println("🚨 [CRITICAL] HEAVY TAMPER DETECTED! Alarm Activated (5s Timer).");
      FirebaseJson tamperAlert;
      tamperAlert.set("title", "CRITICAL: Gate Tampering Detected!");
      tamperAlert.set("type", "vibration_alert");
      tamperAlert.set("timestamp", "ESP32_" + String(millis()));
      Firebase.pushJSON(firebaseData, "/alerts", tamperAlert);
  }

  // Handle the active alarm buzzing
  if (isTampering) {
    if (millis() - tamperStartTime >= 5000) {
      // Auto-mute after 5 seconds
      isTampering = false; 
      digitalWrite(BUZZER_PIN, LOW); // Force buzzer OFF
      Serial.println(">>> [SECURITY] Tamper Alarm Auto-Muted after 5 seconds.");
    } else {
      // Pulse the buzzer while active
      static unsigned long lastBeep = 0;
      if (millis() - lastBeep > 300) {
        lastBeep = millis();
        digitalWrite(BUZZER_PIN, !digitalRead(BUZZER_PIN)); 
      }
    }
  }
}



