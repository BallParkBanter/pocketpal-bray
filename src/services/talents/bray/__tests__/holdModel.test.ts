import {AppState} from 'react-native';
import {holdModelWhileAway, releaseHold} from '../holdModel';

const mockStore = {
  disableAutoRelease: jest.fn(),
  enableAutoRelease: jest.fn(),
};
jest.mock('../../../../store/ModelStore', () => ({modelStore: mockStore}));

describe('holdModelWhileAway', () => {
  let handler: (s: string) => void;
  const remove = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      h: (s: string) => void,
    ) => {
      handler = h;
      return {remove};
    }) as any);
  });

  it('disables auto-release until the app has left and come back', () => {
    holdModelWhileAway('t');
    expect(mockStore.disableAutoRelease).toHaveBeenCalledWith('t');
    handler('active'); // never left yet: keep holding
    expect(mockStore.enableAutoRelease).not.toHaveBeenCalled();
    handler('background');
    handler('active');
    expect(mockStore.enableAutoRelease).toHaveBeenCalledWith('t');
    expect(remove).toHaveBeenCalled();
  });

  it('releaseHold ends it at once', () => {
    holdModelWhileAway('u');
    releaseHold('u');
    expect(mockStore.enableAutoRelease).toHaveBeenCalledWith('u');
    releaseHold('u'); // idempotent
    expect(mockStore.enableAutoRelease).toHaveBeenCalledTimes(1);
  });
});
