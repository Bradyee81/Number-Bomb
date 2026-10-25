// Number Bomb popper: classic ESP32 only. Drives a timer TRIGGER, never a heater.
#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <esp_timer.h>
#include <atomic>

constexpr int TRIGGER_PIN = 25;
constexpr uint32_t LEASE_MS = 5000;
constexpr uint32_t CHALLENGE_MS = 1200;
const char *FIRMWARE_TAG __attribute__((used)) = "NB_FW_VERSION=1";
Preferences prefs;
WebServer server(80);
String key, ssid, password, bootId, challenge, armedRound, firedRound, serialLine;
uint32_t challengeAt = 0, leaseAt = 0, joinAt = 0;
bool joining = false;
std::atomic<bool> pulse{false};
esp_timer_handle_t pulseTimer;

String randomId() {
  char buffer[33];
  snprintf(buffer, sizeof(buffer), "%08lx%08lx%08lx%08lx",
    (unsigned long)esp_random(), (unsigned long)esp_random(),
    (unsigned long)esp_random(), (unsigned long)esp_random());
  return String(buffer);
}

void endPulse(void *) {
  // Idle is high impedance with pulldown, NEVER OUTPUT LOW: the existing
  // manual button also sources 3.3V onto Trigger. A 1k series resistor is required.
  pinMode(TRIGGER_PIN, INPUT_PULLDOWN);
  pulse = false;
}

void disarm() { armedRound = ""; }

void maintain() {
  if (WiFi.status() != WL_CONNECTED || (uint32_t)(millis() - leaseAt) > LEASE_MS) disarm();
}

bool authenticated() {
  if (key.length() == 32 && server.header("X-Popper-Key") == key) return true;
  server.send(403, "text/plain", "Not paired");
  return false;
}

bool fresh() {
  maintain();
  if (!authenticated()) return false;
  bool valid = challenge.length() && server.arg("boot") == bootId &&
    server.arg("challenge") == challenge && (uint32_t)(millis() - challengeAt) <= CHALLENGE_MS;
  challenge = ""; // Single-use, including rejected requests. Never retry a shot.
  if (!valid) server.send(409, "text/plain", "Expired command; re-arm manually");
  return valid;
}

void status() {
  if (!authenticated()) return;
  maintain();
  challenge = randomId();
  challengeAt = millis();
  JsonDocument doc;
  doc["firmware"] = 1;
  doc["boot"] = bootId;
  doc["challenge"] = challenge;
  doc["armed_round"] = armedRound;
  String body;
  serializeJson(doc, body);
  server.send(200, "application/json", body);
}

void action() {
  if (!fresh()) return;
  String command = server.arg("action"), round = server.arg("round");
  if (command == "disarm") {
    disarm();
  } else if (command == "arm") {
    if (!round.length() || round.length() > 80 || round == firedRound || pulse) {
      server.send(409, "text/plain", "Round already used or output busy"); return;
    }
    armedRound = round;
    leaseAt = millis();
  } else if (command == "lease") {
    if (!round.length() || armedRound != round) {
      server.send(409, "text/plain", "Disarmed; arm manually"); return;
    }
    leaseAt = millis();
  } else if (command == "fire") {
    if (!round.length() || armedRound != round || pulse) {
      server.send(409, "text/plain", "Not armed for this round"); return;
    }
    firedRound = round;
    disarm(); // Consume before driving output; duplicate requests cannot re-fire.
    // Don't trigger on top of a manual press.
    if (digitalRead(TRIGGER_PIN) == HIGH) {
      server.send(409, "text/plain", "Manual button held; round consumed"); return;
    }
    digitalWrite(TRIGGER_PIN, HIGH);
    pinMode(TRIGGER_PIN, OUTPUT);
    pulse = true;
    // Independent of HTTP processing, release the trigger after 100ms.
    if (esp_timer_start_once(pulseTimer, 100000) != ESP_OK) {
      endPulse(nullptr);
      server.send(500, "text/plain", "Pulse timer unavailable"); return;
    }
  } else {
    server.send(400, "text/plain", "Unknown action"); return;
  }
  server.send(200, "application/json", "{\"ok\":true}");
}

void provision(const String &line) {
  if (line == "NB_HELLO") { Serial.println("NB_POPPER:1"); return; }
  JsonDocument doc;
  if (deserializeJson(doc, line) || doc["command"] != "provision") return;
  String newSsid = doc["ssid"] | "", newPassword = doc["password"] | "", newKey = doc["key"] | "";
  if (!newSsid.length() || newSsid.length() > 32 || newPassword.length() > 63 || newKey.length() != 32) {
    Serial.println("NB_ERROR:Invalid WiFi details"); return;
  }
  disarm(); endPulse(nullptr); esp_timer_stop(pulseTimer);
  key = newKey; ssid = newSsid; password = newPassword;
  prefs.putString("ssid", ssid); prefs.putString("password", password); prefs.putString("key", key);
  WiFi.disconnect();
  WiFi.begin(ssid.c_str(), password.c_str());
  joinAt = millis(); joining = true;
  Serial.println("NB_ACCEPTED"); // Never echo password or pairing key.
}

void setup() {
  pinMode(TRIGGER_PIN, INPUT_PULLDOWN);
  Serial.begin(115200);
  bootId = randomId();
  esp_timer_create_args_t args = {};
  args.callback = &endPulse;
  args.name = "trigger-off";
  ESP_ERROR_CHECK(esp_timer_create(&args, &pulseTimer));
  prefs.begin("nb-popper", false);
  ssid = prefs.getString("ssid", ""); password = prefs.getString("password", ""); key = prefs.getString("key", "");
  WiFi.mode(WIFI_STA);
  // Modem sleep delays incoming packets until the next beacon (100–300ms),
  // which makes status checks miss the app's short timeouts. Stay awake.
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  if (ssid.length()) WiFi.begin(ssid.c_str(), password.c_str());
  const char *headers[] = {"X-Popper-Key"};
  server.collectHeaders(headers, 1);
  server.on("/status", HTTP_GET, status);
  server.on("/action", HTTP_POST, action);
  server.begin();
  Serial.println("NB_POPPER:1");
  Serial.println(FIRMWARE_TAG);
}

void loop() {
  maintain();
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') { provision(serialLine); serialLine = ""; }
    else if (c != '\r') { if (serialLine.length() < 1024) serialLine += c; else serialLine = ""; }
  }
  if (joining && WiFi.status() == WL_CONNECTED) {
    joining = false; Serial.println("NB_CONNECTED:" + WiFi.localIP().toString());
  } else if (joining && (uint32_t)(millis() - joinAt) > 20000) {
    joining = false; Serial.println("NB_ERROR:Could not join 2.4GHz WiFi");
  }
  if (WiFi.status() == WL_CONNECTED) server.handleClient();
  delay(1);
}
