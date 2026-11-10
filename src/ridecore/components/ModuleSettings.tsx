import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  ACTION_GROUPS,
  ACTION_NAMES,
  allowModuleCalls,
  BUTTON_KEYS,
  CALL_ACTIONS,
  connectModule,
  DEFAULT_BUTTONS,
  formatLean,
  getButtonSettings,
  getModuleSettings,
  levelLean,
  MODULE_BOARDS,
  PHONE_ACTIONS,
  PICO_BOARDS_URL,
  pinLabel,
  saveModuleSettings,
  setButtonSettings,
  useModule,
  WHEEL_CIRCUMFERENCES,
  WHEEL_PULSES,
  type ButtonAction,
  type ButtonKey,
  type ModuleBoard,
  type ModuleSnapshot,
} from '../module';
import { CallIcon, ChipIcon, CopyIcon, LeanIcon, PadIcon, ResetIcon, ShareIcon, UsbIcon, WheelIcon } from './Icons';
import { Key } from './Key';
import { WiringDiagram } from './WiringDiagram';

/**
 * Settings → Handlebar module: the module on USB (module/README.md), what its buttons do,
 * and how to build one. Keys as the rest of Settings has them; what opens (an action
 * list, the build guide) opens in place, a scroll further down, never over the page.
 */
export function ModuleSettings() {
  const module = useModule();
  const phone = module.link !== 'unsupported';
  return (
    <>
      <ModuleKeys module={module} />
      <h3 className="rc-section">Handlebar buttons</h3>
      <ButtonKeys phone={phone} calls={module.calls} />
      <h3 className="rc-section">Build one</h3>
      <BuildGuide connectedBoard={module.hello?.board} />
    </>
  );
}

/** In a word: where the module's line is at. */
function moduleState(module: ModuleSnapshot): string {
  switch (module.link) {
    case 'unsupported':
      return 'Phone only';
    case 'none':
      return 'Not plugged in';
    case 'allow':
      return 'Tap to allow';
    case 'asking':
      return 'Allow on screen';
    case 'error':
      return module.error ?? "Won't open";
    case 'open':
      if (module.outdated) return 'Flash new firmware';
      if (!module.hello) return 'Starting…';
      return module.live ? 'Connected' : 'Not sending';
  }
}

/**
 * Whether it's there, the wheel its sensor is on, and levelling the lean. A line under
 * the keys says what it sends, live, for setting it up.
 */
function ModuleKeys({ module }: { module: ModuleSnapshot }) {
  const [setup, setSetup] = useState(getModuleSettings);
  const [levelled, setLevelled] = useState<'yes' | 'no' | null>(null);

  useEffect(() => {
    if (!levelled) return;
    const id = window.setTimeout(() => setLevelled(null), 2500);
    return () => window.clearTimeout(id);
  }, [levelled]);

  const change = (next: typeof setup) => {
    saveModuleSettings(next);
    setSetup(next);
  };
  const step = (list: number[], value: number) => list[(list.indexOf(value) + 1) % list.length] ?? list[0]!;
  const connected = module.link === 'open' && module.live;
  const hello = module.hello;
  const facts =
    connected && hello
      ? [
          hello.board ?? module.name,
          `firmware ${hello.fw}`,
          hello.imu ?? 'no IMU',
          module.wheelKmh != null ? `wheel ${Math.round(module.wheelKmh)} km/h` : 'no wheel pulses yet',
          module.lean ? `lean ${formatLean(module.lean.deg)}` : null,
        ].filter(Boolean)
      : null;

  return (
    <>
      <div className="rc-keys">
        <Key icon={<UsbIcon />} label="Module" state={moduleState(module)} on={connected} onClick={connectModule} />
        <Key
          icon={<WheelIcon />}
          label="Wheel"
          state={`${setup.circumferenceM.toFixed(2)} m round`}
          onClick={() => change({ ...setup, circumferenceM: step(WHEEL_CIRCUMFERENCES, setup.circumferenceM) })}
        />
        <Key
          icon={<WheelIcon />}
          label="Pulses a turn"
          state={String(setup.pulsesPerRev)}
          onClick={() => change({ ...setup, pulsesPerRev: step(WHEEL_PULSES, setup.pulsesPerRev) })}
        />
        <Key
          icon={<LeanIcon />}
          label="Level lean"
          state={levelled === 'yes' ? 'Levelled' : levelled === 'no' ? 'No IMU readings' : hello?.imu ? 'Upright, tap' : 'Needs an IMU'}
          onClick={() => {
            setLevelled(levelLean() ? 'yes' : 'no');
            setSetup(getModuleSettings());
          }}
        />
      </div>
      <p className="rc-note">
        {facts
          ? facts.join(' · ')
          : onPhone(module)
            ? 'Plug the module into the phone (through the charging hub) to use its buttons, wheel speed and lean.'
            : 'A board on USB adds handlebar buttons, wheel speed and lean. Build one below.'}
      </p>
    </>
  );
}

const onPhone = (module: ModuleSnapshot) => module.link !== 'unsupported';

const BUTTON_WORDS = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', ok: 'OK' } as const;

function keyParts(key: ButtonKey): { button: keyof typeof BUTTON_WORDS; hold: boolean } {
  const [button, kind] = key.split('.') as [keyof typeof BUTTON_WORDS, 'tap' | 'hold'];
  return { button, hold: kind === 'hold' };
}

/**
 * What each button does, tapped and held: a key each, showing its action. Tapping one
 * lights it and opens the actions under the keys; picking one sets it.
 */
function ButtonKeys({ phone, calls }: { phone: boolean; calls: ModuleSnapshot['calls'] }) {
  const [settings, setSettings] = useState(getButtonSettings);
  const [editing, setEditing] = useState<ButtonKey | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) pickerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [editing]);

  const change = (next: typeof settings) => {
    setButtonSettings(next);
    setSettings(next);
  };

  /** Calls need the phone's permission: asked for the first time a call action is set. */
  const callsAllowed = async (): Promise<boolean> => {
    if (!phone) {
      setNote('Calls are answered on the phone; in a browser this is only kept.');
      return true;
    }
    if (calls === 'granted') return true;
    const granted = await allowModuleCalls();
    setNote(granted ? null : 'Answering calls needs the phone permission. Allow it in Android’s settings for RIDECORE.');
    return granted;
  };

  const pick = async (action: ButtonAction) => {
    if (!editing) return;
    const next = { ...settings, map: { ...settings.map, [editing]: action } };
    setEditing(null);
    change(next);
    if (CALL_ACTIONS.has(action)) await callsAllowed();
    else if (!phone && PHONE_ACTIONS.has(action)) setNote('Volume works on the phone; in a browser this is only kept.');
    else setNote(null);
  };

  const toggleCalls = async () => {
    if (settings.callsOnOk) {
      change({ ...settings, callsOnOk: false });
      return;
    }
    if (await callsAllowed()) change({ ...settings, callsOnOk: true });
  };

  const editingParts = editing ? keyParts(editing) : null;
  return (
    <>
      <div className="rc-keys">
        {BUTTON_KEYS.map((key) => {
          const { button, hold } = keyParts(key);
          return (
            <Key
              key={key}
              icon={<PadIcon button={button} />}
              label={`${BUTTON_WORDS[button]} ${hold ? 'held' : 'tap'}`}
              state={ACTION_NAMES[settings.map[key]]}
              on={editing === key}
              onClick={() => setEditing(editing === key ? null : key)}
            />
          );
        })}
        <Key
          icon={<CallIcon />}
          label="Calls on OK"
          state={settings.callsOnOk ? 'Ringing: OK answers' : 'Off'}
          on={settings.callsOnOk}
          onClick={() => void toggleCalls()}
        />
        <Key
          icon={<ResetIcon />}
          label="Reset buttons"
          state="As they came"
          onClick={() => {
            change(DEFAULT_BUTTONS);
            setEditing(null);
            setNote('Buttons back as they came.');
          }}
        />
      </div>

      {editing && editingParts ? (
        <div ref={pickerRef} className="rc-actions-picker" aria-label="Pick an action">
          <p className="rc-note">
            {BUTTON_WORDS[editingParts.button]} {editingParts.hold ? 'held' : 'tapped'} does:
          </p>
          {ACTION_GROUPS.map((group) => (
            <div key={group.title} className="rc-chip-group">
              <h4 className="rc-subsection">{group.title}</h4>
              <div className="rc-chips">
                {group.actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="rc-chip"
                    aria-pressed={settings.map[editing] === action}
                    onClick={() => void pick(action)}
                  >
                    {ACTION_NAMES[action]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <p className="rc-note">
        {note ??
          (settings.callsOnOk
            ? 'While the phone rings, OK answers and holding OK rejects; in a call, holding OK hangs up.'
            : 'Tap a key to change what that button does. Volume and calls work even with another app in front.')}
      </p>
    </>
  );
}

const BOARD_KEY = 'ridecore.moduleBoard';

function savedBoard(): ModuleBoard['id'] | null {
  try {
    const saved = localStorage.getItem(BOARD_KEY);
    return MODULE_BOARDS.find((b) => b.id === saved)?.id ?? null;
  } catch {
    return null;
  }
}

/** The sketch, loaded when first wanted: it's the module's code, not the app's. */
let sketchText: string | null = null;
async function loadSketch(): Promise<string> {
  sketchText ??= (await import('../../../module/ridecore_module/ridecore_module.ino?raw')).default;
  return sketchText;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // An older WebView: the old way, through a hidden field.
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const done = document.execCommand('copy');
    field.remove();
    return done;
  }
}

/**
 * How to build the module: pick the board, then its wiring (drawn for it), its pins, the
 * Arduino IDE steps, and the sketch to copy or send to a computer.
 */
function BuildGuide({ connectedBoard }: { connectedBoard?: string }) {
  const [open, setOpen] = useState(false);
  /** Picked here this time; else the board plugged in (it says which), else the one picked last. */
  const [picked, setPicked] = useState<ModuleBoard['id'] | null>(null);
  const [saved] = useState(savedBoard);
  const [code, setCode] = useState<string | null>(sketchText);
  const [done, setDone] = useState<'copied' | 'sent' | 'failed' | null>(null);
  const connected = MODULE_BOARDS.find((b) => b.sketchName === connectedBoard)?.id;
  const boardId = picked ?? connected ?? saved ?? 'esp32-s3';
  const board = MODULE_BOARDS.find((b) => b.id === boardId) ?? MODULE_BOARDS[0]!;

  useEffect(() => {
    if (open && code == null) void loadSketch().then(setCode);
  }, [open, code]);

  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setDone(null), 2500);
    return () => window.clearTimeout(id);
  }, [done]);

  const choose = (id: ModuleBoard['id']) => {
    setPicked(id);
    try {
      localStorage.setItem(BOARD_KEY, id);
    } catch {
      // Kept for now.
    }
  };

  const copy = async () => {
    const text = await loadSketch();
    setCode(text);
    setDone((await copyText(text)) ? 'copied' : 'failed');
  };

  /** As a file, to email or save to Drive, for the Arduino IDE on a computer. */
  const send = async () => {
    const text = await loadSketch();
    setCode(text);
    try {
      if (!Capacitor.isNativePlatform()) throw new Error('No share sheet in a browser');
      const { uri } = await Filesystem.writeFile({ path: 'ridecore_module.ino', data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: 'RIDECORE module sketch', files: [uri], dialogTitle: 'Send the sketch to your computer' });
      setDone('sent');
    } catch {
      setDone((await copyText(text)) ? 'copied' : 'failed');
    }
  };

  const pin = (p: number | string) => pinLabel(board, p);
  const pullUp = board.volts === 3.3 ? '3V3' : '5V';

  return (
    <>
      <div className="rc-keys">
        <Key icon={<ChipIcon />} label="Build guide" state={open ? 'Showing below' : 'Parts, wiring, code'} on={open} onClick={() => setOpen(!open)} />
        <Key icon={<CopyIcon />} label="Copy code" state={done === 'copied' ? 'Copied' : done === 'failed' ? 'Couldn’t copy' : 'Arduino sketch'} onClick={() => void copy()} />
        <Key icon={<ShareIcon />} label="Send code" state={done === 'sent' ? 'Sent' : 'To a computer'} onClick={() => void send()} />
      </div>

      {open ? (
        <div className="rc-guide">
          <h4 className="rc-subsection">Board</h4>
          <div className="rc-chips">
            {MODULE_BOARDS.map((b) => (
              <button key={b.id} type="button" className="rc-chip" aria-pressed={b.id === board.id} onClick={() => choose(b.id)}>
                {b.short}
              </button>
            ))}
          </div>
          <p className="rc-note">
            <b>{board.name}</b> · {board.volts} V pins · {board.usb}
            {board.note ? ` ${board.note}` : ''}
          </p>

          <h4 className="rc-subsection">Wiring</h4>
          <WiringDiagram board={board} />
          <ul className="rc-wiring-key" aria-label="Wire colours">
            <li data-kind="button">Buttons</li>
            <li data-kind="power">Power</li>
            <li data-kind="gnd">Ground</li>
            <li data-kind="sda">SDA</li>
            <li data-kind="scl">SCL</li>
            <li data-kind="wheel">Wheel</li>
          </ul>
          <dl className="rc-pins">
            {(['Up', 'Down', 'Left', 'Right', 'OK'] as const).map((word, i) => (
              <div key={word}>
                <dt>{word} button</dt>
                <dd>{pin(board.buttons[i]!)} to GND</dd>
              </div>
            ))}
            <div>
              <dt>Wheel sensor OUT</dt>
              <dd>
                {pin(board.wheel)}, 4.7 kΩ to {pullUp}
              </dd>
            </div>
            <div>
              <dt>Wheel sensor VCC</dt>
              <dd>{board.sensorPower}</dd>
            </div>
            <div>
              <dt>IMU SDA, SCL</dt>
              <dd>
                {pin(board.sda)}, {pin(board.scl)}
              </dd>
            </div>
            <div>
              <dt>IMU VCC</dt>
              <dd>{board.imuPower}</dd>
            </div>
            <div>
              <dt>Every GND</dt>
              <dd>GND</dd>
            </div>
          </dl>
          {board.volts === 3.3 ? <p className="rc-note" data-tone="error">Its pins are 3.3 V: never put 5 V or 12 V on one.</p> : null}

          <h4 className="rc-subsection">Steps</h4>
          <ol className="rc-steps">
            <li>
              <b>Parts:</b> the board, 5 buttons (or a 5-way handlebar switch), a hall sensor and a magnet for the wheel, a GY-521 (MPU-6050) for the
              lean, a USB-C hub with PD pass-through and a 12 V USB-C PD charger.
            </li>
            <li>
              <b>Arduino IDE 2</b> on a computer: Tools → Board → Boards Manager → install <i>{board.core}</i>.
              {board.id === 'pico' ? ` First add this to Preferences → Additional boards manager URLs: ${PICO_BOARDS_URL}` : ''}
            </li>
            <li>
              Tools → Board → <i>{board.ideBoard}</i>
              {board.ideSettings.length ? `; ${board.ideSettings.join('; ')}` : ''}.
            </li>
            <li>
              New sketch named <i>ridecore_module</i>: paste the code (Copy code, or Send code to get the file there), then Upload. It finds the board
              and its pins by itself.
            </li>
            <li>Wire it as drawn. The IMU flat on the frame, chip up, its X arrow to the front wheel; the magnet 2–5 mm from the sensor.</li>
            <li>
              The board into the hub’s USB-A port, the hub into the phone, the charger into the hub’s PD IN. Android asks to open RIDECORE: tick
              Always.
            </li>
            <li>
              Here: Module says Connected, and the line under it the board, the IMU and the wheel’s speed. Set Wheel and Pulses a turn; tap Level lean
              with the bike upright.
            </li>
          </ol>

          <h4 className="rc-subsection">Code</h4>
          <pre className="rc-code" aria-label="The Arduino sketch">
            <code>{code ?? 'Loading…'}</code>
          </pre>
        </div>
      ) : null}
    </>
  );
}
