import {EmptyReplyFallback} from '../emptyReplyFallback';

const ok = (summary: string) =>
  ({
    callId: 'c',
    toolName: 't',
    responseContent: summary,
    result: {type: 'text', summary},
  }) as any;
const err = () =>
  ({
    callId: 'c',
    toolName: 't',
    responseContent: 'x',
    result: {type: 'error', summary: 'Bo declined: x', errorMessage: 'x'},
  }) as any;

function run(steps: Array<{tools?: any[]; text?: string}>) {
  const f = new EmptyReplyFallback();
  let out: string | null = null;
  for (const s of steps) {
    f.onStepStarted();
    if (s.text !== undefined) {
      f.onToken({content: s.text});
    }
    const calls = s.tools ?? [];
    out = f.fallbackFor(calls.length ? calls : undefined);
    calls.forEach(o => f.onToolFinished(o));
  }
  return out;
}

describe('EmptyReplyFallback', () => {
  it('uses the tool summary when the final step is empty', () => {
    expect(run([{tools: [ok('Brightness is now 40%')]}, {text: ''}])).toBe(
      'Brightness is now 40%',
    );
  });

  it('keeps the model text when there is any', () => {
    expect(run([{tools: [ok('s')]}, {text: 'All set.'}])).toBeNull();
  });

  it('treats whitespace-only output as empty', () => {
    expect(run([{tools: [ok('s')]}, {text: '  \n'}])).toBe('s');
  });

  it('never covers for a failed or declined tool', () => {
    expect(run([{tools: [err()]}, {}])).toBeNull();
    expect(run([{tools: [ok('a'), err()]}, {}])).toBeNull();
  });

  it('does nothing for a plain chat with no tools', () => {
    expect(run([{text: ''}])).toBeNull();
  });

  it('ignores non-text results (html / search have their own UI)', () => {
    const html = {
      callId: 'c',
      toolName: 'render_html',
      responseContent: 's',
      result: {type: 'html', html: '<p/>', summary: 's'},
    } as any;
    expect(run([{tools: [html]}, {}])).toBeNull();
  });

  it('joins several successful summaries', () => {
    expect(run([{tools: [ok('a'), ok('b')]}, {}])).toBe('a\nb');
  });
});
