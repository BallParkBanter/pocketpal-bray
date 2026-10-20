import {brayPalId, newChatDefaultPalId} from '../defaultPal';
import {BRAY_HIDE_PAL_UI} from '../brayUi';

const pals = [
  {id: 'pip', name: 'Pip', source: 'local'},
  {id: 'bray', name: 'Bray', source: 'local'},
];

describe('Bray default Pal', () => {
  it('finds the local Bray Pal', () => {
    expect(brayPalId(pals)).toBe('bray');
    expect(brayPalId([{id: 'x', name: 'Bray', source: 'palshub'}])).toBe(
      undefined,
    );
    expect(brayPalId(undefined)).toBe(undefined);
  });

  it('every new chat starts on Bray, whatever the last chat used', () => {
    expect(newChatDefaultPalId(pals, 'pip')).toBe('bray');
    expect(newChatDefaultPalId(pals, undefined)).toBe('bray');
  });

  it('falls back to upstream behaviour if Bray was deleted', () => {
    expect(newChatDefaultPalId([pals[0]], 'pip')).toBe('pip');
  });

  it('hides the Pal UI', () => {
    expect(BRAY_HIDE_PAL_UI).toBe(true);
  });
});
