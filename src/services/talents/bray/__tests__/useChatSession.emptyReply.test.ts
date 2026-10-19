// Bray fork: the empty-reply fallback wired into src/hooks/useChatSession.ts.
import {LlamaContext} from 'llama.rn';
import {renderHook, act} from '@testing-library/react-native';

import {textMessage} from '../../../../../jest/fixtures';
import {
  mockLlamaContextParams,
  modelsList,
} from '../../../../../jest/fixtures/models';
import {useChatSession} from '../../../../hooks/useChatSession';
import {chatSessionStore, modelStore, palStore} from '../../../../store';
import {talentRegistry} from '../../index';
import type {TalentEngine} from '../../types';

const SUMMARY =
  'Done: the screen brightness is now 40% (it was 100%). Auto-brightness is off.';

jest
  .spyOn(require('../../../../utils/chat'), 'applyChatTemplate')
  .mockImplementation(async () => 'mocked prompt');

function setup(finalStep: (onData: (d: any) => void) => any, result: any) {
  const fake: TalentEngine = {
    name: 'bray_fake_tool',
    execute: async () => result,
    toToolDefinition: () => ({
      type: 'function',
      function: {
        name: 'bray_fake_tool',
        description: '',
        parameters: {},
      },
    }),
  };
  talentRegistry.register(fake);
  palStore.pals = [
    {
      id: 'pal-1',
      type: 'local',
      name: 'Tablet Pal',
      systemPrompt: '',
      parameters: {},
      parameterSchema: [],
      isSystemPromptChanged: false,
      useAIPrompt: false,
      source: 'local',
      pact: {talents: [{name: 'bray_fake_tool', necessity: 'optional'}]},
    } as any,
  ];
  chatSessionStore.sessions = [
    {
      id: 'session-1',
      title: '',
      date: '',
      messages: [],
      completionSettings: {},
      settingsSource: 'pal',
      activePalId: 'pal-1',
    } as any,
  ];
  chatSessionStore.activeSessionId = 'session-1';
  chatSessionStore.agentUiState = {
    status: 'idle',
    pendingTalentNames: [],
    hitMaxTurns: false,
  } as any;
  modelStore.models = modelsList as any;
  modelStore.activeModelId = undefined;
  modelStore.context = new LlamaContext(mockLlamaContextParams);
  modelStore.engine = {
    completion: jest.fn((params, onData) =>
      modelStore.context!.completion(params, onData),
    ),
    stopCompletion: jest.fn(async () => {}),
  };
  let turn = 0;
  modelStore.context!.completion = jest
    .fn()
    .mockImplementation(async (_p: any, onData: (d: any) => void) => {
      turn += 1;
      if (turn === 1) {
        return {
          text: '',
          content: '',
          tool_calls: [
            {
              id: 'c0',
              type: 'function',
              function: {
                name: 'bray_fake_tool',
                arguments: '{"level":40}',
              },
            },
          ],
        };
      }
      return finalStep(onData);
    });
}

const contentWrites = () =>
  (chatSessionStore.updateActiveStepStreaming as jest.Mock).mock.calls
    .map(c => c[2]?.content)
    .filter(Boolean);

async function send() {
  const {result} = renderHook(() =>
    useChatSession({current: null}, textMessage.author, {id: 'a'}),
  );
  await act(async () => {
    await result.current.handleSendPress(textMessage);
  });
}

describe('useChatSession empty-reply fallback (Bray)', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => (talentRegistry as any).engines.delete('bray_fake_tool'));

  it('shows the tool summary when the model ends with zero tokens', async () => {
    setup(() => ({text: '', content: ''}), {type: 'text', summary: SUMMARY});
    await send();
    expect(contentWrites()).toContain(SUMMARY);
  });

  it('leaves a real reply alone', async () => {
    setup(
      onData => {
        onData({token: 'Done.', content: 'Done.'});
        return {text: 'Done.', content: 'Done.'};
      },
      {type: 'text', summary: SUMMARY},
    );
    await send();
    expect(contentWrites()).not.toContain(SUMMARY);
  });

  it('does not cover for a declined tool', async () => {
    setup(() => ({text: '', content: ''}), {
      type: 'error',
      summary: 'Bo declined: set brightness to 40%',
      errorMessage: 'x',
    });
    await send();
    expect(contentWrites()).toEqual([]);
  });
});
