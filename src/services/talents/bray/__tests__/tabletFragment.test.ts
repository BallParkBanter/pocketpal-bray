import {collectSystemPromptFragments, resetRegisteredFlag} from '../../index';
import {talentRegistry} from '../../TalentRegistry';
import {TABLET_FRAGMENT, tabletFragment} from '../common';

describe('tabletFragment', () => {
  it('only the alphabetically first active tablet talent emits it', () => {
    const active = new Set(['tablet_shell', 'tablet_status', 'calculate']);
    expect(tabletFragment('tablet_shell', active)).toBe(TABLET_FRAGMENT);
    expect(tabletFragment('tablet_status', active)).toBeNull();
  });

  it('appears exactly once in the system prompt for a Pal with all five', () => {
    talentRegistry.reset();
    resetRegisteredFlag();
    const frags = collectSystemPromptFragments(
      [
        'tablet_status',
        'tablet_set_brightness',
        'tablet_open_app',
        'tablet_list_files',
        'tablet_shell',
      ],
      {now: new Date(0), maxToolTurns: 3},
    );
    expect(frags.filter(f => f === TABLET_FRAGMENT)).toHaveLength(1);
  });
});
