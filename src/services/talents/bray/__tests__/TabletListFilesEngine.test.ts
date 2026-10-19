import {resolveListPath, TabletListFilesEngine} from '../TabletListFilesEngine';
import {MAX_TOOL_CHARS, TRUNCATION_MARKER} from '../common';
import {runShell, ShizukuNotRunningError} from '../shell';

jest.mock('../shell', () => {
  const actual = jest.requireActual('../shell');
  return {...actual, runShell: jest.fn()};
});
const mockRun = runShell as jest.Mock;

const LS = `total 14250
-rwxrwx--- 1 u0_a159 media_rw  2554692 2026-10-15 01:18 Sd54f5ab8ce834cf58721ac559b387936P.pdf
drwxrws--- 2 u0_a159 media_rw     3452 2026-08-31 11:24 Silo
-rwxrwx--- 1 u0_a159 media_rw 11507122 2026-08-15 23:33 NewPipe v0.29.1.apk
`;

function ok(stdout: string) {
  return {exitCode: 0, stdout, stderr: '', timedOut: false};
}

describe('resolveListPath', () => {
  it.each([
    [undefined, '/sdcard/Download'],
    ['', '/sdcard/Download'],
    ['/sdcard/Download', '/sdcard/Download'],
    ['/sdcard/Download/', '/sdcard/Download'],
    ['/sdcard', '/sdcard'],
    ['/storage/6238-3662/AI-Models', '/storage/6238-3662/AI-Models'],
    ['Documents', '/sdcard/Documents'],
  ])('%p -> %p', (input, expected) => {
    expect(resolveListPath(input)).toBe(expected);
  });

  it.each([
    ['/data/data'],
    ['/system'],
    ['/'],
    ['/sdcard/../data'],
    ['/sdcardx'],
    ['/storage/../data'],
    [42],
  ])('rejects %p', input => {
    expect(resolveListPath(input)).toBeNull();
  });
});

describe('TabletListFilesEngine', () => {
  const engine = new TabletListFilesEngine();
  beforeEach(() => mockRun.mockReset());

  it('lists the downloads folder newest first by default', async () => {
    mockRun.mockResolvedValue(ok(LS));
    const r = await engine.execute({});
    expect(mockRun).toHaveBeenCalledWith("ls -la -t '/sdcard/Download/'");
    expect(r.type).toBe('text');
    expect(r.summary.split('\n')).toEqual([
      'Files in /sdcard/Download (newest first):',
      '2026-10-15 01:18  2.4 MB  Sd54f5ab8ce834cf58721ac559b387936P.pdf',
      '2026-08-31 11:24  folder  Silo/',
      '2026-08-15 23:33  11.0 MB  NewPipe v0.29.1.apk',
    ]);
  });

  it('refuses paths outside /sdcard and /storage without running anything', async () => {
    const r = await engine.execute({path: '/data/data'});
    expect(r.type).toBe('error');
    expect(r.summary).toMatch(/only .*\/sdcard\/.*\/storage\//);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('quotes paths so they cannot inject commands', async () => {
    mockRun.mockResolvedValue(ok('total 0\n'));
    await engine.execute({path: "/sdcard/it's; reboot"});
    expect(mockRun).toHaveBeenCalledWith(
      "ls -la -t '/sdcard/it'\\''s; reboot/'",
    );
  });

  it(`truncates to MAX_TOOL_CHARS with ${TRUNCATION_MARKER}`, async () => {
    const many = Array.from(
      {length: 200},
      (_, i) =>
        `-rw-rw---- 1 u0_a159 media_rw 1000 2026-10-01 10:${String(
          i % 60,
        ).padStart(2, '0')} file-${i}.txt`,
    ).join('\n');
    mockRun.mockResolvedValue(ok('total 1\n' + many));
    const r = await engine.execute({path: '/sdcard/Download'});
    expect(r.summary.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    expect(r.summary.endsWith('…(truncated)')).toBe(true);
  });

  it('says when the folder is empty', async () => {
    mockRun.mockResolvedValue(ok('total 0\n'));
    const r = await engine.execute({path: '/sdcard/Empty'});
    expect(r.summary).toBe('/sdcard/Empty is empty.');
  });

  it('reports a missing folder', async () => {
    mockRun.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'ls: /sdcard/Nope: No such file or directory',
      timedOut: false,
    });
    const r = await engine.execute({path: '/sdcard/Nope'});
    expect(r.type).toBe('error');
    expect(r.summary).toMatch(/No such file/);
  });

  it('reports Shizuku not running', async () => {
    mockRun.mockRejectedValue(new ShizukuNotRunningError());
    const r = await engine.execute({});
    expect(r.summary).toBe(
      "Shizuku isn't running — open Shizuku and tap Start",
    );
  });
});
