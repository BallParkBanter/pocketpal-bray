import {autoLoadLastUsedModel} from '../autoLoadModel';

const gemma = {id: 'gemma'};
const store = (over = {}) => ({
  activeModelId: undefined as string | undefined,
  isContextLoading: false,
  lastUsedModel: gemma as {id: string} | undefined,
  selectModel: jest.fn(async () => {}),
  ...over,
});

describe('autoLoadLastUsedModel', () => {
  it('loads the last-used model when nothing is loaded', async () => {
    const s = store();
    expect(await autoLoadLastUsedModel(s)).toBe('gemma');
    expect(s.selectModel).toHaveBeenCalledWith(gemma);
  });

  it('does nothing when a model is active or loading, or none was used', async () => {
    for (const over of [
      {activeModelId: 'x'},
      {isContextLoading: true},
      {lastUsedModel: undefined},
    ]) {
      const s = store(over);
      expect(await autoLoadLastUsedModel(s)).toBeUndefined();
      expect(s.selectModel).not.toHaveBeenCalled();
    }
  });

  it('never throws', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const s = store({
      selectModel: jest.fn().mockRejectedValue(new Error('oom')),
    });
    expect(await autoLoadLastUsedModel(s)).toBeUndefined();
    spy.mockRestore();
  });
});
