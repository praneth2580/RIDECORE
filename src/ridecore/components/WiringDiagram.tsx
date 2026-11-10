import { BUTTONS, pinLabel, type ModuleBoard } from '../module';

const BUTTON_WORDS = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', ok: 'OK' } as const;

/** The board's box, and where each side's pins sit on it. */
const BOARD = { x: 132, y: 22, w: 104, h: 262 };
const BUTTON_Y = [72, 106, 140, 174, 208];
const GND_Y = 262;
const IMU = { x: 282, y: 52, pins: [72, 96, 120, 144] };
const SENSOR = { x: 282, y: 178, pins: [198, 222, 246] };
const GND_BUS_X = 20;

/**
 * How to wire the module to a board, drawn for that board: each button from its pin to
 * GND, the IMU on the I2C pins, the wheel sensor on its interrupt pin, and the board on
 * USB to the hub and phone. Colours as on the guide's key: lime buttons, red power, grey
 * ground, blue SDA, violet SCL, amber the wheel's pulses.
 */
export function WiringDiagram({ board }: { board: ModuleBoard }) {
  const pin = (p: number | string) => pinLabel(board, p);
  const pullUp = board.volts === 3.3 ? '3V3' : '5V';
  return (
    <svg className="rc-wiring" viewBox="0 0 360 340" role="img" aria-label={`Wiring for ${board.name}`}>
      {/* The board, its name at the top. */}
      <rect className="rc-wiring-board" x={BOARD.x} y={BOARD.y} width={BOARD.w} height={BOARD.h} rx="10" />
      <text className="rc-wiring-title" x={BOARD.x + BOARD.w / 2} y={BOARD.y + 22} textAnchor="middle">
        {board.short}
      </text>
      <text className="rc-wiring-small" x={BOARD.x + BOARD.w / 2} y={BOARD.y + 36} textAnchor="middle">
        {board.volts} V pins
      </text>

      {/* Buttons: pin → switch → the ground rail down the left, to a GND pin. */}
      <path className="rc-wire" data-kind="gnd" d={`M${GND_BUS_X} ${BUTTON_Y[0]}V${GND_Y}H${BOARD.x}`} />
      {BUTTONS.map((button, i) => {
        const y = BUTTON_Y[i]!;
        return (
          <g key={button}>
            <path className="rc-wire" data-kind="button" d={`M${BOARD.x} ${y}H84`} />
            <circle className="rc-wiring-contact" cx="80" cy={y} r="3" />
            <path className="rc-wiring-lever" d={`M52 ${y}L77 ${y - 9}`} />
            <circle className="rc-wiring-contact" cx="52" cy={y} r="3" />
            <path className="rc-wire" data-kind="gnd" d={`M49 ${y}H${GND_BUS_X}`} />
            <text className="rc-wiring-label" x="66" y={y - 13} textAnchor="middle">
              {BUTTON_WORDS[button]}
            </text>
            <text className="rc-wiring-pin" x={BOARD.x + 6} y={y + 4}>
              {pin(board.buttons[i]!)}
            </text>
          </g>
        );
      })}
      <text className="rc-wiring-pin" x={BOARD.x + 6} y={GND_Y + 4}>
        GND
      </text>
      <text className="rc-wiring-small" x={GND_BUS_X + 4} y={GND_Y + 16}>
        GND
      </text>

      {/* The IMU on I2C. */}
      <rect className="rc-wiring-part" x={IMU.x} y={IMU.y} width="70" height="108" rx="8" />
      <text className="rc-wiring-label" x={IMU.x + 35} y={IMU.y - 6} textAnchor="middle">
        IMU · GY-521
      </text>
      {(
        [
          ['power', board.imuPower, 'VCC'],
          ['gnd', 'GND', 'GND'],
          ['sda', pin(board.sda), 'SDA'],
          ['scl', pin(board.scl), 'SCL'],
        ] as const
      ).map(([kind, from, to], i) => {
        const y = IMU.pins[i]!;
        return (
          <g key={to}>
            <path className="rc-wire" data-kind={kind} d={`M${BOARD.x + BOARD.w} ${y}H${IMU.x}`} />
            <text className="rc-wiring-pin" x={BOARD.x + BOARD.w - 6} y={y + 4} textAnchor="end">
              {from}
            </text>
            <text className="rc-wiring-pin" x={IMU.x + 8} y={y + 4}>
              {to}
            </text>
          </g>
        );
      })}

      {/* The wheel sensor: its output pulls the pin down once per magnet. */}
      <rect className="rc-wiring-part" x={SENSOR.x} y={SENSOR.y} width="70" height="84" rx="8" />
      <text className="rc-wiring-label" x={SENSOR.x + 35} y={SENSOR.y - 6} textAnchor="middle">
        Wheel sensor
      </text>
      {(
        [
          ['power', board.sensorPower, 'VCC'],
          ['gnd', 'GND', 'GND'],
          ['wheel', pin(board.wheel), 'OUT'],
        ] as const
      ).map(([kind, from, to], i) => {
        const y = SENSOR.pins[i]!;
        return (
          <g key={to}>
            <path className="rc-wire" data-kind={kind} d={`M${BOARD.x + BOARD.w} ${y}H${SENSOR.x}`} />
            <text className="rc-wiring-pin" x={BOARD.x + BOARD.w - 6} y={y + 4} textAnchor="end">
              {from}
            </text>
            <text className="rc-wiring-pin" x={SENSOR.x + 8} y={y + 4}>
              {to}
            </text>
          </g>
        );
      })}
      <text className="rc-wiring-small" x={SENSOR.x + 70} y={SENSOR.y + 100} textAnchor="end">
        + 4.7 kΩ OUT to {pullUp}
      </text>

      {/* USB down to the hub, which charges the phone. */}
      <path className="rc-wire" data-kind="usb" d={`M${BOARD.x + BOARD.w / 2} ${BOARD.y + BOARD.h}V310`} />
      <text className="rc-wiring-label" x={BOARD.x + BOARD.w / 2} y="326" textAnchor="middle">
        USB → hub (PD pass-through) → phone
      </text>
      <text className="rc-wiring-small" x={BOARD.x + BOARD.w / 2} y="338" textAnchor="middle">
        12 V → PD charger → the hub’s PD IN
      </text>
    </svg>
  );
}
