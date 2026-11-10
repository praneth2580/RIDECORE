/*
 * RIDECORE handlebar module
 * =========================
 * Reads the bike's handlebar buttons, a wheel speed sensor and an IMU (lean angle), and
 * sends them to the RIDECORE app over USB, one line of JSON per reading. The phone is
 * the USB host; a powered USB-C hub between them charges the phone at the same time.
 * Full guide, wiring and protocol: module/README.md, or in the app under
 * Settings > Handlebar module > Build guide.
 *
 * Boards: this sketch picks its pins from the board chosen in the Arduino IDE.
 *   ESP32-S3 DevKitC-1      "ESP32S3 Dev Module"   USB CDC On Boot: Enabled
 *   ESP32-C3 (SuperMini)    "ESP32C3 Dev Module"   USB CDC On Boot: Enabled
 *   ESP32 DevKit V1         "ESP32 Dev Module"
 *   Arduino Uno R3 / R4     "Arduino Uno" / "Arduino UNO R4 Minima" or "WiFi"
 *   Arduino Nano            "Arduino Nano" (clones: Processor "ATmega328P (Old Bootloader)")
 *   Arduino Mega 2560       "Arduino Mega or Mega 2560"
 *   Leonardo / Micro / Pro Micro  "Arduino Leonardo" / "Arduino Micro" / "SparkFun Pro Micro"
 *   Raspberry Pi Pico       "Raspberry Pi Pico" (Earle Philhower's RP2040 core)
 * Another board: uncomment RIDECORE_CUSTOM_PINS below and set its pins there.
 *
 * Wiring, every board: each button between its pin and GND (the pin's own pull-up holds
 * it high); the wheel sensor's output pulls its pin to GND once per magnet; the IMU
 * (MPU-6050 / GY-521, MPU-6500, MPU-9250, ICM-20602...) on the board's I2C pins.
 */
#include <Arduino.h>
#include <Wire.h>
#include <math.h>
#include <stdarg.h>
#include <string.h>

static const char FIRMWARE[] = "1.1.0";
static const int PROTOCOL = 1;

// ── Your board ───────────────────────────────────────────────────────────────
// Buttons in the order the app names them: up, down, left, right, ok.
// The wheel pin must take an interrupt. I2C -1: the board's own SDA and SCL pins.

// #define RIDECORE_CUSTOM_PINS

#if defined(RIDECORE_CUSTOM_PINS)
  #define BOARD_NAME "Custom board"
  const uint8_t BUTTON_PINS[] = {4, 5, 6, 7, 8};
  const uint8_t WHEEL_PIN = 2;
  const int I2C_SDA = -1, I2C_SCL = -1;

#elif defined(ARDUINO_ARCH_ESP32) && defined(CONFIG_IDF_TARGET_ESP32S3)  // board: esp32-s3
  #define BOARD_NAME "ESP32-S3"
  #define NATIVE_USB_ESP32 1
  const uint8_t BUTTON_PINS[] = {4, 5, 6, 7, 15};
  const uint8_t WHEEL_PIN = 16;
  const int I2C_SDA = 8, I2C_SCL = 9;

#elif defined(ARDUINO_ARCH_ESP32) && defined(CONFIG_IDF_TARGET_ESP32C3)  // board: esp32-c3
  #define BOARD_NAME "ESP32-C3"
  #define NATIVE_USB_ESP32 1
  const uint8_t BUTTON_PINS[] = {0, 1, 3, 4, 10};
  const uint8_t WHEEL_PIN = 5;
  const int I2C_SDA = 8, I2C_SCL = 9;

#elif defined(ARDUINO_ARCH_ESP32) && defined(CONFIG_IDF_TARGET_ESP32)  // board: esp32
  #define BOARD_NAME "ESP32"
  const uint8_t BUTTON_PINS[] = {25, 26, 27, 32, 33};
  const uint8_t WHEEL_PIN = 19;
  const int I2C_SDA = 21, I2C_SCL = 22;

#elif defined(ARDUINO_AVR_UNO) || defined(ARDUINO_UNOR4_MINIMA) || defined(ARDUINO_UNOR4_WIFI)  // board: uno
  #define BOARD_NAME "Arduino Uno"
  const uint8_t BUTTON_PINS[] = {4, 5, 6, 7, 8};
  const uint8_t WHEEL_PIN = 2;  // An interrupt pin: 2 or 3.
  const int I2C_SDA = -1, I2C_SCL = -1;  // A4, A5

#elif defined(ARDUINO_AVR_NANO)  // board: nano
  #define BOARD_NAME "Arduino Nano"
  const uint8_t BUTTON_PINS[] = {4, 5, 6, 7, 8};
  const uint8_t WHEEL_PIN = 2;  // An interrupt pin: 2 or 3.
  const int I2C_SDA = -1, I2C_SCL = -1;  // A4, A5

#elif defined(ARDUINO_AVR_MEGA2560)  // board: mega
  #define BOARD_NAME "Arduino Mega"
  const uint8_t BUTTON_PINS[] = {22, 24, 26, 28, 30};
  const uint8_t WHEEL_PIN = 2;  // An interrupt pin: 2, 3, 18 or 19.
  const int I2C_SDA = -1, I2C_SCL = -1;  // 20, 21

#elif defined(ARDUINO_AVR_LEONARDO) || defined(ARDUINO_AVR_MICRO) || defined(ARDUINO_AVR_PROMICRO)  // board: leonardo
  #define BOARD_NAME "Arduino Leonardo"
  const uint8_t BUTTON_PINS[] = {4, 5, 6, 8, 9};
  const uint8_t WHEEL_PIN = 7;  // An interrupt pin; 2 and 3 are I2C here.
  const int I2C_SDA = -1, I2C_SCL = -1;  // 2, 3

#elif defined(ARDUINO_ARCH_RP2040) || defined(ARDUINO_ARCH_MBED_RP2040)  // board: pico
  #define BOARD_NAME "Raspberry Pi Pico"
  const uint8_t BUTTON_PINS[] = {10, 11, 12, 13, 14};
  const uint8_t WHEEL_PIN = 15;
  const int I2C_SDA = -1, I2C_SCL = -1;  // GP4, GP5

#else
  #error "RIDECORE: this board isn't one the sketch knows. Uncomment RIDECORE_CUSTOM_PINS above and set its pins."
#endif

#if defined(NATIVE_USB_ESP32) && !ARDUINO_USB_CDC_ON_BOOT
  #error "RIDECORE: set Tools > USB CDC On Boot > Enabled, so the board talks on its own USB port."
#endif

static const size_t BUTTON_COUNT = sizeof(BUTTON_PINS) / sizeof(BUTTON_PINS[0]);

// ── Timing ───────────────────────────────────────────────────────────────────

static const uint32_t DEBOUNCE_MS = 25;
static const uint32_t WHEEL_EVERY_MS = 100;
static const uint32_t IMU_EVERY_US = 20000;  // 50 samples a second
static const uint32_t IMU_HZ = 1000000UL / IMU_EVERY_US;
static const uint32_t HEARTBEAT_MS = 1000;
static const uint32_t IMU_RETRY_MS = 2000;
// Closer pulses than this are bounce: 300 km/h on a 2 m wheel with 4 magnets is 6 ms.
static const uint32_t MIN_PULSE_US = 2000;
// The pulse period is averaged over the pulses in this window, at least the last one.
static const uint32_t PERIOD_WINDOW_US = 500000;
// A gap longer than this between pulses is a stop, not a period.
static const uint32_t PERIOD_MAX_US = 3000000;

// ── What differs between chips ───────────────────────────────────────────────

#ifndef IRAM_ATTR
  #define IRAM_ATTR
#endif

#if defined(ARDUINO_ARCH_ESP32)
  static portMUX_TYPE wheelMux = portMUX_INITIALIZER_UNLOCKED;
  #define WHEEL_LOCK_ISR() portENTER_CRITICAL_ISR(&wheelMux)
  #define WHEEL_UNLOCK_ISR() portEXIT_CRITICAL_ISR(&wheelMux)
  #define WHEEL_LOCK() portENTER_CRITICAL(&wheelMux)
  #define WHEEL_UNLOCK() portEXIT_CRITICAL(&wheelMux)
  // A big send buffer (setup()): a reading goes only if all of it fits, so a phone
  // that isn't reading never holds up the buttons.
  #define ROOM_FOR(length) (length)
#else
  #define WHEEL_LOCK_ISR()
  #define WHEEL_UNLOCK_ISR()
  #define WHEEL_LOCK() noInterrupts()
  #define WHEEL_UNLOCK() interrupts()
  // Small send buffers: any room at all, and the rest goes as it drains.
  #define ROOM_FOR(length) 1
#endif

// ── Sending ──────────────────────────────────────────────────────────────────

static char outbox[192];

// One line to the phone. A reading (`must` false) is dropped when the phone has fallen
// behind; a button or hello waits its turn.
static void sendf(bool must, const char *format, ...) {
  if (!Serial) return;  // Nothing listening (boards on their own USB).
  va_list args;
  va_start(args, format);
  int length = vsnprintf(outbox, sizeof(outbox) - 1, format, args);
  va_end(args);
  if (length <= 0 || length >= (int)sizeof(outbox) - 1) return;
  outbox[length++] = '\n';
  if (!must && Serial.availableForWrite() < ROOM_FOR(length)) return;
  Serial.write(reinterpret_cast<const uint8_t *>(outbox), length);
}

// ── IMU: the MPU-6050 family (MPU-6500, MPU-9250, ICM-206xx share its registers) ──

static uint8_t imuAddress = 0;  // 0: none found
static const char *imuName = nullptr;
static uint8_t imuFailures = 0;
static uint32_t imuRetryAt = 0;
static uint32_t lastImuUs = 0;

static const char *imuNameFor(uint8_t whoAmI) {
  switch (whoAmI) {
    case 0x68: return "MPU-6050";
    case 0x72: return "MPU-6050 (clone)";
    case 0x70: return "MPU-6500";
    case 0x71: return "MPU-9250";
    case 0x73: return "MPU-9255";
    case 0x11: return "ICM-20600";
    case 0x12: return "ICM-20602";
    case 0x98: return "ICM-20689";
    case 0x19: return "MPU-6886";
    default: return nullptr;
  }
}

static bool imuWrite(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(imuAddress);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

static bool imuRead(uint8_t reg, uint8_t *out, uint8_t length) {
  Wire.beginTransmission(imuAddress);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(imuAddress, length) != length) return false;
  for (uint8_t i = 0; i < length; i++) out[i] = Wire.read();
  return true;
}

static void sendHello();

// Looks for the IMU at both its addresses, and sets it up: ±8 g, ±500 °/s, ~44 Hz filter.
static void findImu() {
  static const uint8_t ADDRESSES[] = {0x68, 0x69};
  for (uint8_t i = 0; i < sizeof(ADDRESSES); i++) {
    imuAddress = ADDRESSES[i];
    uint8_t whoAmI = 0;
    if (!imuRead(0x75, &whoAmI, 1)) continue;
    const char *name = imuNameFor(whoAmI);
    if (!name) continue;
    imuWrite(0x6B, 0x80);  // Reset.
    delay(100);
    bool ok = imuWrite(0x6B, 0x01)     // Awake, clocked from the gyro.
              && imuWrite(0x1A, 0x03)  // Low-pass filter, ~44 Hz: engine buzz out.
              && imuWrite(0x1B, 0x08)  // Gyro ±500 °/s: 65.5 per °/s.
              && imuWrite(0x1C, 0x10); // Accelerometer ±8 g: 4096 per g.
    if (!ok) continue;
    imuName = name;
    imuFailures = 0;
    return;
  }
  imuAddress = 0;
  imuName = nullptr;
}

// One sample: accelerometer in mg, gyro in hundredths of a degree a second.
static void readImu() {
  uint8_t raw[14];
  if (!imuRead(0x3B, raw, sizeof(raw))) {
    // Unplugged or the bus upset: look for it again in a while, and say so.
    if (++imuFailures >= 10) {
      imuAddress = 0;
      imuName = nullptr;
      imuRetryAt = millis() + IMU_RETRY_MS;
      sendHello();
    }
    return;
  }
  imuFailures = 0;
  int16_t v[7];
  for (int i = 0; i < 7; i++) v[i] = (int16_t)(((uint16_t)raw[2 * i] << 8) | raw[2 * i + 1]);
  long ax = lround(v[0] / 4.096), ay = lround(v[1] / 4.096), az = lround(v[2] / 4.096);
  long gx = lround(v[4] * 100.0 / 65.5), gy = lround(v[5] * 100.0 / 65.5), gz = lround(v[6] * 100.0 / 65.5);
  sendf(false, "{\"t\":\"imu\",\"ms\":%lu,\"a\":[%ld,%ld,%ld],\"g\":[%ld,%ld,%ld]}", (unsigned long)millis(), ax, ay, az, gx, gy, gz);
}

// ── Wheel: pulses counted on an interrupt ────────────────────────────────────

static volatile uint32_t wheelPulses = 0;
static volatile uint32_t wheelTimes[8];  // The last pulses' micros(), a ring.
static volatile uint8_t wheelHead = 0;   // The next slot.

static void IRAM_ATTR onWheelPulse() {
  uint32_t now = micros();
  WHEEL_LOCK_ISR();
  uint32_t last = wheelTimes[(wheelHead + 7) & 7];
  if (wheelPulses == 0 || now - last >= MIN_PULSE_US) {
    wheelTimes[wheelHead] = now;
    wheelHead = (wheelHead + 1) & 7;
    wheelPulses = wheelPulses + 1;
  }
  WHEEL_UNLOCK_ISR();
}

// Pulses so far, the period lately (µs, 0 before two), and ms since the last.
static void sendWheel() {
  uint32_t times[8];
  uint32_t pulses;
  uint8_t head;
  WHEEL_LOCK();
  pulses = wheelPulses;
  head = wheelHead;
  for (int i = 0; i < 8; i++) times[i] = wheelTimes[i];
  WHEEL_UNLOCK();

  uint32_t period = 0;
  uint32_t age = 65535;
  if (pulses > 0) {
    uint32_t newest = times[(head + 7) & 7];
    uint32_t sinceUs = micros() - newest;
    age = sinceUs / 1000 > 65535 ? 65535 : sinceUs / 1000;
    uint32_t stored = pulses < 8 ? pulses : 8;
    uint32_t span = 0;
    uint32_t gaps = 0;
    for (uint32_t k = 1; k < stored; k++) {
      uint32_t older = times[(head + 7 - k) & 7];
      if (k > 1 && newest - older > PERIOD_WINDOW_US) break;
      span = newest - older;
      gaps = k;
    }
    if (gaps > 0 && span / gaps <= PERIOD_MAX_US) period = span / gaps;
  }
  sendf(false, "{\"t\":\"whl\",\"n\":%lu,\"p\":%lu,\"age\":%lu}", (unsigned long)pulses, (unsigned long)period, (unsigned long)age);
}

// ── Buttons: debounced edges ─────────────────────────────────────────────────

struct Button {
  bool down;
  bool raw;
  uint32_t changedAt;
};
static Button buttons[BUTTON_COUNT];

static void readButtons() {
  uint32_t now = millis();
  for (size_t i = 0; i < BUTTON_COUNT; i++) {
    bool raw = digitalRead(BUTTON_PINS[i]) == LOW;
    Button &button = buttons[i];
    if (raw != button.raw) {
      button.raw = raw;
      button.changedAt = now;
    } else if (raw != button.down && now - button.changedAt >= DEBOUNCE_MS) {
      button.down = raw;
      sendf(true, "{\"t\":\"btn\",\"b\":%u,\"s\":%d}", (unsigned)i, raw ? 1 : 0);
    }
  }
}

// ── What it has, and what the phone says ─────────────────────────────────────

static void sendHello() {
  if (imuName) {
    sendf(true, "{\"t\":\"hello\",\"v\":%d,\"fw\":\"%s\",\"board\":\"%s\",\"btn\":%u,\"whl\":true,\"imu\":\"%s\",\"hz\":%lu}", PROTOCOL, FIRMWARE,
          BOARD_NAME, (unsigned)BUTTON_COUNT, imuName, (unsigned long)IMU_HZ);
  } else {
    sendf(true, "{\"t\":\"hello\",\"v\":%d,\"fw\":\"%s\",\"board\":\"%s\",\"btn\":%u,\"whl\":true,\"imu\":null,\"hz\":%lu}", PROTOCOL, FIRMWARE,
          BOARD_NAME, (unsigned)BUTTON_COUNT, (unsigned long)IMU_HZ);
  }
}

static char inbox[96];
static size_t inboxLength = 0;

// The phone opens the line with {"t":"hi"}: hello back.
static void readCommands() {
  while (Serial.available() > 0) {
    int c = Serial.read();
    if (c == '\n' || c == '\r') {
      inbox[inboxLength] = '\0';
      if (inboxLength > 0 && strstr(inbox, "\"t\":\"hi\"")) sendHello();
      inboxLength = 0;
    } else if (inboxLength < sizeof(inbox) - 1) {
      inbox[inboxLength++] = (char)c;
    } else {
      inboxLength = 0;  // Too long to be ours.
    }
  }
}

// ── Start, and the loop ──────────────────────────────────────────────────────

static uint32_t lastWheelMs = 0;
static uint32_t lastBeatMs = 0;

void setup() {
#if defined(ARDUINO_ARCH_ESP32)
  Serial.setTxBufferSize(1024);
#endif
  Serial.begin(115200);

  for (size_t i = 0; i < BUTTON_COUNT; i++) {
    pinMode(BUTTON_PINS[i], INPUT_PULLUP);
    buttons[i].down = false;
    buttons[i].raw = false;
    buttons[i].changedAt = 0;
  }
  pinMode(WHEEL_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(WHEEL_PIN), onWheelPulse, FALLING);

#if defined(ARDUINO_ARCH_ESP32)
  if (I2C_SDA >= 0 && I2C_SCL >= 0) Wire.begin(I2C_SDA, I2C_SCL);
  else Wire.begin();
  Wire.setTimeOut(20);  // An empty bus mustn't hold up the buttons.
#else
  Wire.begin();
  #if defined(WIRE_HAS_TIMEOUT)
  Wire.setWireTimeout(20000, true);
  #endif
#endif
  Wire.setClock(400000);
  findImu();
  if (!imuAddress) imuRetryAt = millis() + IMU_RETRY_MS;

  sendHello();
}

void loop() {
  uint32_t nowMs = millis();
  uint32_t nowUs = micros();

  readCommands();
  readButtons();

  if (imuAddress) {
    if (nowUs - lastImuUs >= IMU_EVERY_US) {
      // On the beat, unless it fell more than a sample behind.
      lastImuUs = nowUs - lastImuUs > 2 * IMU_EVERY_US ? nowUs : lastImuUs + IMU_EVERY_US;
      readImu();
    }
  } else if ((int32_t)(nowMs - imuRetryAt) >= 0) {
    findImu();
    imuRetryAt = nowMs + IMU_RETRY_MS;
    if (imuAddress) sendHello();
  }

  if (nowMs - lastWheelMs >= WHEEL_EVERY_MS) {
    lastWheelMs = nowMs;
    sendWheel();
  }

  if (nowMs - lastBeatMs >= HEARTBEAT_MS) {
    lastBeatMs = nowMs;
    sendf(false, "{\"t\":\"hb\",\"up\":%lu}", (unsigned long)(nowMs / 1000));
  }

  delay(1);
}
