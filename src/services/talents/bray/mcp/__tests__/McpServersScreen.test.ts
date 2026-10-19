import {statusText} from '../McpServersScreen';

describe('statusText', () => {
  it('does not claim a cache when there is none', () => {
    expect(statusText({state: 'unreachable', toolCount: 0})).toBe(
      'not reachable · no tools yet',
    );
    expect(statusText({state: 'unreachable', toolCount: 2})).toBe(
      'not reachable · 2 tools (cached)',
    );
    expect(statusText({state: 'ok', toolCount: 2})).toBe('connected · 2 tools');
  });
});
