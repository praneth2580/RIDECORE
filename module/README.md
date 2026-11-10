# RIDECORE handlebar module

A small board on the bike reads **handlebar buttons**, a **wheel speed sensor** and an
**IMU** (for lean angle), and sends them to the phone over **USB**. The same USB cable run
also **charges the phone**, through a powered USB-C hub. Wireless can come later; this is
the wired version.

```
 bike 12 V ──fuse──► USB-C PD car charger ──► [PD IN]  USB-C hub  [USB-C] ──► phone (RIDECORE)
                                                       [USB-A] ◄── the board's USB
                                                                   ├─ 5 buttons ─► GND
                                                                   ├─ wheel sensor
                                                                   └─ IMU (I2C)
```

The phone is the USB host and talks to the board through the hub. The hub passes the
charger's power through to the phone, and powers the board from its USB-A port.

**In the app:** Settings → Handlebar module → **Build one** has all of this per board:
the wiring drawn for it, its pins, the Arduino IDE steps, and the sketch. **Copy code**
puts the sketch on the clipboard. **Send code** shares the `.ino` file, so you can email
it or save it to Drive for the Arduino IDE on a computer.

- The sketch: [`ridecore_module/ridecore_module.ino`](ridecore_module/ridecore_module.ino).
  One file for every board below: it picks its pins from the board chosen in the Arduino IDE.
- The app's side: [`src/ridecore/module/`](../src/ridecore/module/) (protocol, wheel speed,
  lean, buttons, boards) and `RideCoreModulePlugin.java`, `RideCoreUsbLink.java` and
  `RideCoreButtons.java` in `android/app/src/main/java/com/praneth2580/ridecore/`.

## Boards

| Board | Arduino IDE board | USB | Pins |
|---|---|---|---|
| **ESP32-S3 DevKitC-1** (recommended) | ESP32S3 Dev Module, *USB CDC On Boot: Enabled* | its own (the port marked **USB**) | 3.3 V |
| ESP32-C3 SuperMini | ESP32C3 Dev Module, *USB CDC On Boot: Enabled* | its own | 3.3 V |
| ESP32 DevKit V1 | ESP32 Dev Module | CP2102 or CH340 chip | 3.3 V |
| Arduino Uno R3 / R4 | Arduino Uno / UNO R4 Minima or WiFi | its own, or CH340 on clones | 5 V |
| Arduino Nano | Arduino Nano (clones: *Old Bootloader*) | CH340 or FTDI chip | 5 V |
| Arduino Mega 2560 | Arduino Mega or Mega 2560 | its own, or CH340 on clones | 5 V |
| Leonardo / Micro / Pro Micro | Arduino Leonardo (or Micro, SparkFun Pro Micro) | its own | 5 V |
| Raspberry Pi Pico | Raspberry Pi Pico (Earle Philhower's core) | its own | 3.3 V |

The app reads both kinds of USB (usb-serial-for-android: CDC, CH340, CP210x, FTDI). No
driver is needed on the phone. A computer may need the CH340 driver to upload.

### Pins

| | Up | Down | Left | Right | OK | Wheel | IMU SDA | IMU SCL |
|---|---|---|---|---|---|---|---|---|
| ESP32-S3 | GPIO 4 | GPIO 5 | GPIO 6 | GPIO 7 | GPIO 15 | GPIO 16 | GPIO 8 | GPIO 9 |
| ESP32-C3 | GPIO 0 | GPIO 1 | GPIO 3 | GPIO 4 | GPIO 10 | GPIO 5 | GPIO 8 | GPIO 9 |
| ESP32 | GPIO 25 | GPIO 26 | GPIO 27 | GPIO 32 | GPIO 33 | GPIO 19 | GPIO 21 | GPIO 22 |
| Uno, Nano | D4 | D5 | D6 | D7 | D8 | D2 | A4 | A5 |
| Mega | D22 | D24 | D26 | D28 | D30 | D2 | D20 | D21 |
| Leonardo, Pro Micro | D4 | D5 | D6 | D8 | D9 | D7 | D2 | D3 |
| Pico | GP10 | GP11 | GP12 | GP13 | GP14 | GP15 | GP4 | GP5 |

- **Every button** goes between its pin and **GND**. The pin's own pull-up holds it high.
- **The wheel sensor's OUT** goes to its pin, with a **4.7 kΩ** resistor from that pin to
  3V3 (5V on a 5 V board) and 100 nF to GND, against noise on a long wire.
- **The IMU:** VCC to 3V3 (a GY-521 also takes 5V), GND to GND, and SDA and SCL as above.

The app's guide draws this for each board; a test (`src/ridecore/module/boards.test.ts`)
keeps its pins and the sketch's the same. Another board: uncomment
`RIDECORE_CUSTOM_PINS` near the top of the sketch and set its pins there.

**3.3 V boards (the ESP32s, the Pico) must never see 5 V or 12 V on a pin.**

## Parts

| Part | Notes |
|---|---|
| A board from the list | An ESP32-S3 if you're buying: fast, its own USB, and Bluetooth for later. |
| **USB-C hub with PD pass-through charging** | It needs a USB-C cable to the phone, a "PD IN" port and a USB-A data port. Test it with your phone first (see [Charging](#charging-and-power)). |
| **USB-C PD car charger, 12 V in** | 30 W or more, on switched 12 V through a 2–3 A inline fuse. |
| **5 momentary buttons**, waterproof, or a 5-way handlebar switch | |
| **Wheel sensor** | An A3144 hall sensor and a magnet on the brake disc; an NJK-5002C proximity switch; or the bike's own speed signal through a PC817 optocoupler. |
| **IMU**: GY-521 (MPU-6050) | MPU-6500, MPU-9250 and ICM-20602/20689 boards work too: they share its registers. |
| 4.7 kΩ resistor, 100 nF capacitor | For the wheel input. |

**Wheel sensor options:**
- **A3144 hall sensor:** VCC to 5V (it needs 4.5 V or more), GND to GND, OUT to the
  wheel pin. Its output only pulls down, so the pin never sees 5 V. Glue a small magnet
  to the brake disc or rim, 2–5 mm from the sensor. Ready-made "hall sensor modules"
  often pull their output up to their own VCC: on a 3.3 V board, power those from 3V3.
- **NJK-5002C (NPN, normally open):** brown to 5–12 V, blue to GND, black to the wheel
  pin. It senses the magnet; its output also only pulls down.
- **The bike's speed signal:** into a PC817 optocoupler's LED through 1 kΩ (5 V signal)
  or 2.2 kΩ (12 V). The opto's collector goes to the wheel pin, its emitter to GND.

Then in RIDECORE, Settings → Handlebar module:
- set **Pulses a turn** (magnets on the wheel, or the speed signal's pulses per turn);
- set **Wheel**, how far the wheel rolls in one turn. To measure it, chalk the tyre, roll
  the bike one turn with you on it, and measure. A 120/80-17 rear is about 1.95 m.

**IMU mounting:** on the **frame**, not the handlebar, which turns with the steering.
Mount it flat, chip side up, with the **X arrow pointing to the front wheel**, on foam
tape. Then, with the bike upright on a stand, tap **Level lean**.

## Charging and power

The phone's one USB-C port carries the module's data and the charge, so a hub with
**PD pass-through** sits in between. Most recent phones charge through one while acting
as USB host; some don't. **Test it at home first:** hub into the phone, charger into the
hub's PD IN, any USB stick into the hub. The phone should show "Charging" and see the stick.

- Some phones (realme, OPPO, vivo, Xiaomi) switch "OTG" off after a few idle minutes.
  Turn it on and set it to stay on, or the module drops off.
- The board draws under 100 mA. Nearly all the charger's power goes to the phone.
- Use a fused, ignition-switched 12 V feed, so nothing drains the battery with the bike off.

## Putting the sketch on the board

**Arduino IDE 2** (the app's guide has the same steps, per board):
1. Tools → Board → Boards Manager: install the board's core.
   - ESP32 boards: *esp32 by Espressif Systems*.
   - Pico: first add `https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json`
     in Preferences → Additional boards manager URLs, then install *Raspberry Pi Pico/RP2040*.
   - Uno R4: *Arduino UNO R4 Boards*. The other Arduinos are built in.
2. Tools → Board: the board from the table, with its settings (ESP32-S3 and C3:
   **USB CDC On Boot: Enabled**).
3. A new sketch named `ridecore_module`: paste the code, and **Upload**.

**PlatformIO:** `cd module && pio run -e <board> -t upload`, with `<board>` one of
`esp32-s3`, `esp32-c3`, `esp32`, `uno`, `nano`, `mega`, `leonardo`, `promicro`, `pico`.
`pio device monitor` shows its lines. Type `{"t":"hi"}` and it answers with its hello.

## Using it

Plug the hub into the phone. Android asks whether to open RIDECORE for the board: tick
**Always** and tap OK. From then on it connects by itself. Settings → Handlebar module
shows **Module: Connected**, with a live line: the board, firmware, IMU, the wheel's
speed and the lean.

### The buttons: set them as you like

Settings → **Handlebar buttons**: a key for each button tapped and held (ten in all),
each showing what it does. Tap one, then pick its action from the list under the keys.

| Actions | |
|---|---|
| Screens | screen above / below / left / right (as a swipe), Dash (Home), Back |
| Music | play / pause, next track, previous track, volume up, volume down |
| Calls | answer call, end / reject call |
| Dash | next dial view, voice on / off, nothing |

As they come:

| Button | Tap | Hold (0.6 s) |
|---|---|---|
| Up / Down | screen above / below (Settings; Apps, All apps) | volume up / down |
| Left / Right | screen left / right (Music; Where to, Rides) | previous / next track |
| OK | play / pause | Dash (Home) |

**Reset buttons** puts them back.

**Calls on OK:** while the phone rings, tap OK to answer, or hold it to reject. In a call,
hold OK to hang up. This works whatever OK is otherwise set to. Turning it on, or setting
a button to answer or end calls, asks for Android's phone permission once (answering
needs Android 8, ending calls Android 9).

Taps and holds are read on the phone's native side (`RideCoreButtons.java`), not in the
page. What the phone does itself works even with another app in front:
- calls and volume, always;
- music, as a headset's buttons work it, when RIDECORE is behind another app;
- a screen action brings RIDECORE back to the dash.

With RIDECORE in front, the page does the screens and the music, including RIDECORE's
own radio. Screen actions go only where a swipe would.

- **Speed:** the speedometer reads the wheel sensor once it has pulsed, instant and on
  through tunnels. GPS takes over again if the module is unplugged.
- **Lean:** a view on the dash's right dial, showing the lean now, a tilted line, and
  the most each way this ride.

## How the lean is worked out

An accelerometer alone reads "upright" in a steady turn: the bike leans so the pull it
feels goes straight down through it. So the gyro's roll rate carries the lean. The
estimate is pulled slowly toward a reference that's right for the moment:
- **riding:** the lean a steady turn needs, `tan(lean) = speed × turn rate / g`;
- **stopped:** the accelerometer.

Standing still, the gyro's drift is learned and taken off
([`lean.ts`](../src/ridecore/module/lean.ts), tested on a steady 37° turn, a quick lean
in, the side stand, and gyro drift).

## Protocol

USB serial at 115200 baud (boards on their own USB ignore the rate), one JSON object per
line. **Board → phone:**

| Line | When | Means |
|---|---|---|
| `{"t":"hello","v":1,"fw":"1.1.0","board":"Arduino Nano","btn":5,"whl":true,"imu":"MPU-6050","hz":50}` | at start, on `hi`, when the IMU comes or goes | what it has (`imu` is `null` without one) |
| `{"t":"btn","b":2,"s":1}` | a button changes (debounced 25 ms) | button `b` (0 up, 1 down, 2 left, 3 right, 4 ok) down (`s` 1) or up (0) |
| `{"t":"whl","n":812,"p":117000,"age":40}` | 10× a second | `n` pulses so far, `p` µs per pulse lately (0 before two), `age` ms since the last pulse |
| `{"t":"imu","ms":51230,"a":[12,301,955],"g":[-40,210,-1180]}` | 50× a second | accelerometer in mg, gyro in 0.01 °/s, sensor axes |
| `{"t":"hb","up":42}` | every second | still there; `up` is seconds since the board started |

**Phone → board:** `{"t":"hi"}` asks for the hello.

The board sends only button edges; taps, holds and what they do are the phone's, so
changing a button never means reflashing. When the phone falls behind, readings are
dropped, while button presses and the hello wait their turn.

## Developing without the hardware

In a development build (`npm run dev`), open RIDECORE with **`?module`** in the address.
A simulated module weaves left and right at 30–60 km/h, and the keyboard's **arrows** and
**Enter** are the five buttons, through the same button settings
(`src/ridecore/module/sim.ts`). The simulator is left out of release builds.
