import {
  coerceBrightness,
  TabletBrightnessEngine,
} from '../TabletBrightnessEngine';
import {askApproval} from '../approval';
import {runShell, ShizukuNotRunningError} from '../shell';

jest.mock('../shell', () => {
  const actual = jest.requireActual('../shell');
  return {...actual, runShell: jest.fn()};
});
jest.mock('../approval', () => ({askApproval: jest.fn()}));

const mockRun = runShell as jest.Mock;
const mockAsk = askApproval as jest.Mock;

describe('coerceBrightness', () => {
  it.each([
    [50, 50],
    [40, 40],
    ['50%', 50],
    ['50', 50],
    [' 75 % ', 75],
    ['max', 100],
    ['maximum', 100],
    ['full', 100],
    ['low', 20],
    ['medium', 50],
    ['half', 50],
    ['high', 80],
    ['min', 0],
    [150, 100],
    [-5, 0],
    ['120%', 100],
    [33.6, 34],
  ])('%p -> %p', (input, expected) => {
    expect(coerceBrightness(input)).toBe(expected);
  });

  it.each([['bright'], [''], [null], [undefined], [{}], [NaN]])(
    'rejects %p',
    input => {
      expect(coerceBrightness(input)).toBeNull();
    },
  );
});

describe('TabletBrightnessEngine', () => {
  const engine = new TabletBrightnessEngine();
  beforeEach(() => {
    mockRun.mockReset();
    mockAsk.mockReset();
    mockRun.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
    });
  });

  it('asks first, then sets manual mode and maps 40% to 102', async () => {
    mockAsk.mockResolvedValue(true);
    const r = await engine.execute({level: '40%'});
    expect(mockAsk).toHaveBeenCalledWith(
      'Set brightness',
      expect.stringContaining('40%'),
    );
    expect(mockRun).toHaveBeenCalledWith(
      'settings put system screen_brightness_mode 0; settings put system screen_brightness 102',
    );
    expect(r).toEqual({type: 'text', summary: 'Brightness set to 40%'});
  });

  it('maps max to 255', async () => {
    mockAsk.mockResolvedValue(true);
    await engine.execute({level: 'max'});
    expect(mockRun.mock.calls[0][0]).toMatch(/screen_brightness 255$/);
  });

  it('on Deny returns the declined error and runs nothing', async () => {
    mockAsk.mockResolvedValue(false);
    const r = await engine.execute({level: 50});
    expect(r.type).toBe('error');
    expect(r.summary).toBe('Bo declined: set brightness to 50%');
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('rejects an unusable level without asking', async () => {
    const r = await engine.execute({level: 'bright'});
    expect(r.type).toBe('error');
    expect(r.summary).toMatch(/0-100/);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('reports Shizuku not running', async () => {
    mockAsk.mockResolvedValue(true);
    mockRun.mockRejectedValue(new ShizukuNotRunningError());
    const r = await engine.execute({level: 50});
    expect(r.summary).toBe(
      "Shizuku isn't running — open Shizuku and tap Start",
    );
  });

  it('reports a failing command', async () => {
    mockAsk.mockResolvedValue(true);
    mockRun.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'nope',
      timedOut: false,
    });
    const r = await engine.execute({level: 50});
    expect(r.type).toBe('error');
    expect(r.summary).toMatch(/nope/);
  });
});
