/**
 * The boards the module's sketch knows (module/ridecore_module/ridecore_module.ino): its
 * pins for each, and how to set one up, for the build guide in Settings. boards.test.ts
 * checks these pins against the sketch's, so the guide and the code can't drift apart.
 */

export interface ModuleBoard {
  /** As the sketch marks its block: "// board: nano". */
  id: 'esp32-s3' | 'esp32-c3' | 'esp32' | 'uno' | 'nano' | 'mega' | 'leonardo' | 'pico';
  name: string;
  /** On its key, in a word or two. */
  short: string;
  /** As the sketch's BOARD_NAME, which the module says in its hello: to pick this board from it. */
  sketchName: string;
  /** How the board prints a pin: "GPIO 4", "D4", "GP10". */
  prefix: string;
  /** Up, down, left, right, OK. */
  buttons: [number, number, number, number, number];
  wheel: number;
  /** A number when the sketch sets the pin; else the board's own I2C pin, by its name. */
  sda: number | string;
  scl: number | string;
  /** What its pins take. 3.3 V pins must never see 5 V. */
  volts: 3.3 | 5;
  /** The IMU's VCC, and the wheel sensor's (an A3144 needs 4.5 V or more). */
  imuPower: string;
  sensorPower: string;
  /** How it talks USB; the app reads both kinds. */
  usb: string;
  /** Arduino IDE: the Boards Manager entry, the board under Tools, and other Tools settings. */
  core: string;
  ideBoard: string;
  ideSettings: string[];
  note?: string;
}

export const MODULE_BOARDS: ModuleBoard[] = [
  {
    id: 'esp32-s3',
    name: 'ESP32-S3 DevKitC-1',
    short: 'ESP32-S3',
    sketchName: 'ESP32-S3',
    prefix: 'GPIO ',
    buttons: [4, 5, 6, 7, 15],
    wheel: 16,
    sda: 8,
    scl: 9,
    volts: 3.3,
    imuPower: '3V3',
    sensorPower: '5V',
    usb: 'Its own USB: plug in the port marked USB, not UART.',
    core: 'esp32 by Espressif Systems',
    ideBoard: 'ESP32S3 Dev Module',
    ideSettings: ['USB CDC On Boot: Enabled', 'USB Mode: Hardware CDC and JTAG'],
    note: 'The one to pick if you are buying: fast, its own USB, and Bluetooth for later.',
  },
  {
    id: 'esp32-c3',
    name: 'ESP32-C3 SuperMini',
    short: 'ESP32-C3',
    sketchName: 'ESP32-C3',
    prefix: 'GPIO ',
    buttons: [0, 1, 3, 4, 10],
    wheel: 5,
    sda: 8,
    scl: 9,
    volts: 3.3,
    imuPower: '3V3',
    sensorPower: '5V',
    usb: 'Its own USB (the USB-C on the board).',
    core: 'esp32 by Espressif Systems',
    ideBoard: 'ESP32C3 Dev Module',
    ideSettings: ['USB CDC On Boot: Enabled'],
    note: 'GPIO 8 and 9 also decide how the chip starts: the IMU board’s pull-up resistors keep them right.',
  },
  {
    id: 'esp32',
    name: 'ESP32 DevKit V1',
    short: 'ESP32',
    sketchName: 'ESP32',
    prefix: 'GPIO ',
    buttons: [25, 26, 27, 32, 33],
    wheel: 19,
    sda: 21,
    scl: 22,
    volts: 3.3,
    imuPower: '3V3',
    sensorPower: 'VIN',
    usb: 'A CP2102 or CH340 USB chip: works as it is.',
    core: 'esp32 by Espressif Systems',
    ideBoard: 'ESP32 Dev Module',
    ideSettings: [],
    note: 'If the upload won’t connect, hold BOOT as it starts.',
  },
  {
    id: 'uno',
    name: 'Arduino Uno (R3 or R4)',
    short: 'Uno',
    sketchName: 'Arduino Uno',
    prefix: 'D',
    buttons: [4, 5, 6, 7, 8],
    wheel: 2,
    sda: 'A4',
    scl: 'A5',
    volts: 5,
    imuPower: '5V',
    sensorPower: '5V',
    usb: 'A genuine one has its own USB; clones a CH340 chip. Both work.',
    core: 'Arduino AVR Boards (built in); an R4: Arduino UNO R4 Boards',
    ideBoard: 'Arduino Uno (or UNO R4 Minima / WiFi)',
    ideSettings: [],
  },
  {
    id: 'nano',
    name: 'Arduino Nano',
    short: 'Nano',
    sketchName: 'Arduino Nano',
    prefix: 'D',
    buttons: [4, 5, 6, 7, 8],
    wheel: 2,
    sda: 'A4',
    scl: 'A5',
    volts: 5,
    imuPower: '5V',
    sensorPower: '5V',
    usb: 'A CH340 or FTDI USB chip: works as it is.',
    core: 'Arduino AVR Boards (built in)',
    ideBoard: 'Arduino Nano',
    ideSettings: ['Processor: ATmega328P (a clone that won’t upload: Old Bootloader)'],
  },
  {
    id: 'mega',
    name: 'Arduino Mega 2560',
    short: 'Mega',
    sketchName: 'Arduino Mega',
    prefix: 'D',
    buttons: [22, 24, 26, 28, 30],
    wheel: 2,
    sda: 'D20 (SDA)',
    scl: 'D21 (SCL)',
    volts: 5,
    imuPower: '5V',
    sensorPower: '5V',
    usb: 'A genuine one has its own USB; clones a CH340 chip. Both work.',
    core: 'Arduino AVR Boards (built in)',
    ideBoard: 'Arduino Mega or Mega 2560',
    ideSettings: [],
  },
  {
    id: 'leonardo',
    name: 'Arduino Leonardo, Micro or Pro Micro',
    short: 'Pro Micro',
    sketchName: 'Arduino Leonardo',
    prefix: 'D',
    buttons: [4, 5, 6, 8, 9],
    wheel: 7,
    sda: 'D2',
    scl: 'D3',
    volts: 5,
    imuPower: 'VCC',
    sensorPower: 'RAW',
    usb: 'Its own USB.',
    core: 'Arduino AVR Boards (built in)',
    ideBoard: 'Arduino Leonardo (a Pro Micro clone too)',
    ideSettings: [],
    note: 'D2 and D3 are its I2C pins, so the wheel is on D7. A 3.3 V Pro Micro: pick SparkFun Pro Micro, 3.3V 8MHz.',
  },
  {
    id: 'pico',
    name: 'Raspberry Pi Pico',
    short: 'Pico',
    sketchName: 'Raspberry Pi Pico',
    prefix: 'GP',
    buttons: [10, 11, 12, 13, 14],
    wheel: 15,
    sda: 'GP4',
    scl: 'GP5',
    volts: 3.3,
    imuPower: '3V3(OUT)',
    sensorPower: 'VBUS',
    usb: 'Its own USB.',
    core: 'Raspberry Pi Pico/RP2040 by Earle F. Philhower (add its board URL in Preferences first)',
    ideBoard: 'Raspberry Pi Pico',
    ideSettings: [],
  },
];

/** A pin as the board prints it. */
export function pinLabel(board: ModuleBoard, pin: number | string): string {
  return typeof pin === 'number' ? `${board.prefix}${pin}` : pin;
}

/** Where the Pico core's boards come from (Arduino IDE → Preferences → Additional boards manager URLs). */
export const PICO_BOARDS_URL = 'https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json';
