import {
  levenshtein,
  parseQueryActivities,
  resolveApp,
  TabletOpenAppEngine,
} from '../TabletOpenAppEngine';
import {listApps, runShell, ShizukuNotRunningError} from '../shell';
import {askApproval} from '../approval';

jest.mock('../shell', () => {
  const actual = jest.requireActual('../shell');
  return {...actual, runShell: jest.fn(), listApps: jest.fn()};
});
jest.mock('../approval', () => ({askApproval: jest.fn()}));

const mockRun = runShell as jest.Mock;
const mockList = listApps as jest.Mock;

const APPS = [
  {label: 'Contacts', package: 'com.android.contacts'},
  {label: 'Clock', package: 'com.android.deskclock'},
  {label: 'LibreTube', package: 'com.github.libretube'},
  {label: 'Tailscale', package: 'com.tailscale.ipn'},
  {label: 'Settings', package: 'com.android.settings'},
  {label: 'PocketPal Bray', package: 'com.pocketpalai.bray'},
];

const QUERY = `3 activities found:
  Activity #0:
    ActivityInfo:
      name=com.android.contacts.activities.PeopleActivity
      packageName=com.android.contacts
      ApplicationInfo:
        packageName=com.android.contacts
        labelRes=0x7f110035 nonLocalizedLabel=null icon=0x7f0f0000 banner=0x0
  Activity #1:
    ActivityInfo:
      name=com.tailscale.ipn.MainActivity
      packageName=com.tailscale.ipn
      ApplicationInfo:
        packageName=com.tailscale.ipn
        labelRes=0x0 nonLocalizedLabel=Tailscale icon=0x7f0d0001 banner=0x7f0800b0
  Activity #2:
    ActivityInfo:
      name=com.github.libretube.ui.activities.MainActivity
      packageName=com.github.libretube
      ApplicationInfo:
        packageName=com.github.libretube
        labelRes=0x7f130047 nonLocalizedLabel=null icon=0x7f0f0000 banner=0x0
`;

describe('levenshtein', () => {
  it('counts edits', () => {
    expect(levenshtein('libretub', 'libretube')).toBe(1);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('resolveApp', () => {
  it('matches labels case-insensitively', () => {
    expect(resolveApp('libretube', APPS).app?.package).toBe(
      'com.github.libretube',
    );
  });

  it('resolves "libretub" to com.github.libretube', () => {
    expect(resolveApp('libretub', APPS).app?.package).toBe(
      'com.github.libretube',
    );
  });

  it('accepts a package name', () => {
    expect(resolveApp('com.tailscale.ipn', APPS).app?.label).toBe('Tailscale');
  });

  it('gives up beyond distance 3 and lists the 3 nearest labels', () => {
    const r = resolveApp('Clocks app', APPS);
    expect(r.app).toBeNull();
    expect(r.nearest).toHaveLength(3);
    expect(r.nearest[0]).toBe('Clock');
  });
});

describe('parseQueryActivities', () => {
  it('uses nonLocalizedLabel or the package name tail', () => {
    expect(parseQueryActivities(QUERY)).toEqual([
      {label: 'contacts', package: 'com.android.contacts'},
      {label: 'Tailscale', package: 'com.tailscale.ipn'},
      {label: 'libretube', package: 'com.github.libretube'},
    ]);
  });
});

describe('TabletOpenAppEngine', () => {
  const engine = new TabletOpenAppEngine();
  beforeEach(() => {
    mockRun.mockReset();
    mockList.mockReset();
    mockList.mockResolvedValue(APPS);
    mockRun.mockResolvedValue({
      exitCode: 0,
      stdout: 'Events injected: 1\n',
      stderr: '',
      timedOut: false,
    });
  });

  it('launches the resolved package with monkey and never asks approval', async () => {
    const r = await engine.execute({name: 'libretub'});
    expect(mockRun).toHaveBeenCalledWith(
      'monkey -p com.github.libretube -c android.intent.category.LAUNCHER 1',
    );
    expect(askApproval).not.toHaveBeenCalled();
    expect(r).toEqual({
      type: 'text',
      summary: 'Opened LibreTube (com.github.libretube)',
    });
  });

  it('unknown app -> error listing 3 nearest labels', async () => {
    const r = await engine.execute({name: 'Spotify'});
    expect(r.type).toBe('error');
    expect(r.summary).toMatch(
      /^No app called "Spotify"\. Closest: [^,]+, [^,]+, [^,]+$/,
    );
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('falls back to query-activities when the label list is unavailable', async () => {
    mockList.mockRejectedValue(new Error('no context'));
    mockRun.mockImplementation(async (cmd: string) => ({
      exitCode: 0,
      stdout: cmd.startsWith('cmd package') ? QUERY : 'Events injected: 1\n',
      stderr: '',
      timedOut: false,
    }));
    const r = await engine.execute({name: 'LibreTube'});
    expect(r.summary).toBe('Opened libretube (com.github.libretube)');
  });

  it('requires a name', async () => {
    const r = await engine.execute({});
    expect(r.type).toBe('error');
  });

  it('reports Shizuku not running', async () => {
    mockList.mockRejectedValue(new ShizukuNotRunningError());
    const r = await engine.execute({name: 'LibreTube'});
    expect(r.summary).toBe(
      "Shizuku isn't running — open Shizuku and tap Start",
    );
  });

  it('reports a launch that injected no events', async () => {
    mockRun.mockResolvedValue({
      exitCode: 0,
      stdout: '** No activities found to run, monkey aborted.\n',
      stderr: '',
      timedOut: false,
    });
    const r = await engine.execute({name: 'LibreTube'});
    expect(r.type).toBe('error');
  });
});
