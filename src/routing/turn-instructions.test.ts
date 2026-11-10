import { describe, expect, it } from 'vitest';
import type { TurnInstruction } from './routing-adapter';
import {
  formatManeuverDistance,
  maneuverKind,
  signalAhead,
  signalWarningLabel,
  structureSign,
  selectNextInstruction,
  selectNextInstructionIndex,
} from './turn-instructions';

describe('selectNextInstructionIndex', () => {
  // Two identical steps: the old text+distance lookup always found the first.
  const instructions: TurnInstruction[] = [
    { text: 'Turn right', distanceMeters: 100, maneuver: 'right' },
    { text: 'Turn right', distanceMeters: 100, maneuver: 'right' },
    { text: 'Arrive at destination', distanceMeters: 50, maneuver: 'arrive' },
  ];

  it('tells identical instructions apart by position', () => {
    const next = selectNextInstructionIndex(instructions, 150)!;
    expect(next.index).toBe(1);
    expect(next.endAlongMeters - 150).toBe(50);
  });

  it('returns the first instruction at the start', () => {
    expect(selectNextInstructionIndex(instructions, 0)).toEqual({
      index: 0,
      endAlongMeters: 100,
    });
  });

  it('stays on the last instruction past the end', () => {
    expect(selectNextInstructionIndex(instructions, 999)?.index).toBe(2);
  });

  it('handles an empty list', () => {
    expect(selectNextInstructionIndex([], 10)).toBeUndefined();
    expect(selectNextInstruction([], 10)).toBeUndefined();
  });
});

describe('formatManeuverDistance', () => {
  it('steps by 10 m up close, so the figure does not tick every metre', () => {
    expect(formatManeuverDistance(143)).toBe('140 m');
    expect(formatManeuverDistance(147)).toBe('150 m');
    expect(formatManeuverDistance(296)).toBe('300 m');
  });

  it('says Now at the turn', () => {
    expect(formatManeuverDistance(3)).toBe('Now');
  });

  it('steps by 50 m further out', () => {
    expect(formatManeuverDistance(312)).toBe('300 m');
    expect(formatManeuverDistance(640)).toBe('650 m');
  });

  it('switches to kilometres', () => {
    expect(formatManeuverDistance(980)).toBe('1.0 km');
    expect(formatManeuverDistance(4_260)).toBe('4.3 km');
    expect(formatManeuverDistance(23_400)).toBe('23 km');
  });
});

describe('maneuverKind', () => {
  const kind = (text: string, maneuver = 'maneuver') =>
    maneuverKind({ text, maneuver, distanceMeters: 100 });

  it("reads the offline engine's maneuvers", () => {
    expect(kind('Turn right', 'right')).toBe('right');
    expect(kind('Make a sharp left', 'sharp left')).toBe('sharp-left');
    expect(kind('Arrive at destination', 'arrive')).toBe('arrive');
  });

  it('takes the first leg\'s turn from its text', () => {
    expect(kind('Turn left', 'depart')).toBe('left');
    expect(kind('Head toward destination', 'depart')).toBe('straight');
  });

  it('reads other engines from the text', () => {
    expect(kind('Bear right onto NH 48.', '9')).toBe('slight-right');
    expect(kind('Keep left at the fork.', '24')).toBe('slight-left');
    expect(kind('Make a U-turn.', '13')).toBe('uturn');
    expect(kind('Your destination is on the right.', '5')).toBe('arrive');
    expect(kind('Continue on SV Road.', '8')).toBe('straight');
  });

  it('uses the first side named', () => {
    expect(kind('Turn right, then turn left')).toBe('right');
  });
});

describe('structureSign', () => {
  const at = (structure: unknown): TurnInstruction => ({
    text: 'Keep right',
    distanceMeters: 100,
    maneuver: 'slight right',
    structure: structure as TurnInstruction['structure'],
  });

  it('says whether to go up onto the flyover or along the road below', () => {
    expect(structureSign(at({ kind: 'bridge', action: 'take', term: 'flyover' }))?.label).toBe('Take flyover');
    expect(structureSign(at({ kind: 'bridge', action: 'below', term: 'flyover' }))?.label).toBe('Go below flyover');
    expect(structureSign(at({ kind: 'bridge', action: 'avoid', term: 'bridge' }))?.label).toBe('Skip bridge');
    expect(structureSign(at({ kind: 'bridge', action: 'stay', term: 'flyover' }))?.label).toBe('Stay on flyover');
    expect(structureSign(at({ kind: 'bridge', action: 'exit', term: 'flyover' }))?.label).toBe('Exit flyover');
  });

  it('and into the underpass or past it', () => {
    expect(structureSign(at({ kind: 'tunnel', action: 'take', term: 'underpass' }))).toEqual({
      kind: 'tunnel',
      action: 'take',
      label: 'Enter underpass',
    });
    expect(structureSign(at({ kind: 'tunnel', action: 'avoid', term: 'underpass' }))?.label).toBe('Skip underpass');
    expect(structureSign(at({ kind: 'tunnel', action: 'stay', term: 'tunnel' }))?.label).toBe('Stay in tunnel');
  });

  it('shows nothing for other turns or what a file got wrong', () => {
    expect(structureSign(undefined)).toBeNull();
    expect(structureSign(at(undefined))).toBeNull();
    expect(structureSign(at({ kind: 'ferry', action: 'take', term: 'ferry' }))).toBeNull();
    expect(structureSign(at({ kind: 'bridge', action: 'constructor', term: 'flyover' }))).toBeNull();
    expect(structureSign(at({ kind: 'bridge', action: 'take' }))?.label).toBe('Take bridge');
  });
});

describe('signalAhead', () => {
  const signals = [
    { coordinate: [0, 0] as [number, number], alongMeters: 1_000 },
    { coordinate: [0, 0] as [number, number], alongMeters: 1_600 },
  ];

  it('warns of the next signal once it is within 400 m', () => {
    expect(signalAhead(signals, 500)).toBeNull();
    expect(signalAhead(signals, 650)).toEqual({ distanceMeters: 350, atManeuver: false });
    expect(signalAhead(signals, 1_000)).toEqual({ distanceMeters: 0, atManeuver: false });
  });

  it('keeps it while waiting at the stop line, then moves on', () => {
    expect(signalAhead(signals, 1_005)?.distanceMeters).toBe(0);
    expect(signalAhead(signals, 1_010)).toBeNull();
    expect(signalAhead(signals, 1_300)).toEqual({ distanceMeters: 300, atManeuver: false });
    expect(signalAhead(signals, 1_700)).toBeNull();
    expect(signalAhead(undefined, 0)).toBeNull();
  });

  it('knows a signal at the next turn', () => {
    expect(signalAhead(signals, 800, 1_020)?.atManeuver).toBe(true);
    // Across a wide junction, the turn 40 m past its signal.
    expect(signalAhead(signals, 800, 1_040)?.atManeuver).toBe(true);
    expect(signalAhead(signals, 800, 1_200)?.atManeuver).toBe(false);
  });

  it('labels it for the banner', () => {
    expect(signalWarningLabel({ distanceMeters: 183, atManeuver: false })).toBe('Signal in 180 m');
    expect(signalWarningLabel({ distanceMeters: 3, atManeuver: false })).toBe('Signal here');
    expect(signalWarningLabel({ distanceMeters: 120, atManeuver: true })).toBe('Signal at the turn');
  });
});
