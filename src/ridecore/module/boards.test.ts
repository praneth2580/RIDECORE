import { describe, expect, it } from 'vitest';
import sketch from '../../../module/ridecore_module/ridecore_module.ino?raw';
import { MODULE_BOARDS } from './boards';

/** The sketch's block for a board: from its "// board: id" line to the next #elif or #else. */
function block(id: string): string {
  const start = sketch.indexOf(`// board: ${id}\n`);
  expect(start, `the sketch has no block for ${id}`).toBeGreaterThan(0);
  const rest = sketch.slice(start);
  const end = rest.search(/\n#(elif|else)/);
  return rest.slice(0, end);
}

const number = (text: string, pattern: RegExp) => Number(pattern.exec(text)?.[1]);

describe('the build guide’s boards', () => {
  it('has a block in the sketch for every board, and a board for every block', () => {
    const blocks = [...sketch.matchAll(/\/\/ board: ([\w-]+)/g)].map((m) => m[1]);
    expect(blocks.sort()).toEqual(MODULE_BOARDS.map((b) => b.id).sort());
  });

  for (const board of MODULE_BOARDS) {
    it(`gives the sketch’s pins for ${board.name}`, () => {
      const text = block(board.id);
      const buttons = /BUTTON_PINS\[\] = \{([^}]+)\}/.exec(text)?.[1].split(',').map(Number);
      expect(buttons).toEqual(board.buttons);
      expect(number(text, /WHEEL_PIN = (\d+)/)).toBe(board.wheel);
      const sda = number(text, /I2C_SDA = (-?\d+)/);
      const scl = number(text, /I2C_SCL = (-?\d+)/);
      // A number in the guide is a pin the sketch sets; a name is the board's own (-1).
      expect(sda).toBe(typeof board.sda === 'number' ? board.sda : -1);
      expect(scl).toBe(typeof board.scl === 'number' ? board.scl : -1);
      expect(/#define BOARD_NAME "([^"]+)"/.exec(text)?.[1]).toBe(board.sketchName);
    });
  }

  it('never puts a pin to two uses', () => {
    for (const board of MODULE_BOARDS) {
      const pins = [...board.buttons, board.wheel, board.sda, board.scl].filter((p) => typeof p === 'number');
      expect(new Set(pins).size, board.name).toBe(pins.length);
    }
  });
});
