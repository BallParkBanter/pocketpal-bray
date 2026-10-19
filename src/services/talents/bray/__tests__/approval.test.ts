import {Alert} from 'react-native';
import {askApproval} from '../approval';

describe('askApproval', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert');
  });
  afterEach(() => alertSpy.mockRestore());

  function press(label: string) {
    const buttons = alertSpy.mock.calls[0][2] as Array<{
      text: string;
      onPress: () => void;
    }>;
    buttons.find(b => b.text === label)!.onPress();
  }

  it('shows Deny / Allow and resolves true on Allow', async () => {
    const p = askApproval('Set brightness', 'Set brightness to 40%?');
    expect(alertSpy).toHaveBeenCalledWith(
      'Set brightness',
      'Set brightness to 40%?',
      expect.any(Array),
      expect.objectContaining({cancelable: true}),
    );
    const texts = (alertSpy.mock.calls[0][2] as Array<{text: string}>).map(
      b => b.text,
    );
    expect(texts).toEqual(['Deny', 'Allow']);
    press('Allow');
    await expect(p).resolves.toBe(true);
  });

  it('resolves false on Deny', async () => {
    const p = askApproval('t', 'd');
    press('Deny');
    await expect(p).resolves.toBe(false);
  });

  it('resolves false when dismissed', async () => {
    const p = askApproval('t', 'd');
    (alertSpy.mock.calls[0][3] as {onDismiss: () => void}).onDismiss();
    await expect(p).resolves.toBe(false);
  });
});
