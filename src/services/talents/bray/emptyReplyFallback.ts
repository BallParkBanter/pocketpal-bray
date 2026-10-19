import type {AgentToolOutcome} from '../../../utils/types';

/**
 * Small models sometimes end their turn with zero tokens right after a tool
 * succeeded (seen with Gemma 4 E2B after tablet_set_brightness and
 * tablet_open_app): the chat then shows only the tool chip. Ruling: show the
 * tool's own result summary as the reply instead. Tracks one run's events;
 * only plain-text results count (html / search tools have their own UI), and
 * only when every tool in the step succeeded.
 */
export class EmptyReplyFallback {
  private stepSummaries: string[] = [];
  private stepFailed = false;
  private prevStepSummaries: string[] = [];
  private stepHasText = false;

  onStepStarted(): void {
    this.prevStepSummaries = this.stepFailed ? [] : this.stepSummaries;
    this.stepSummaries = [];
    this.stepFailed = false;
    this.stepHasText = false;
  }

  onToken(delta: {content?: string | null}): void {
    if (delta.content && delta.content.trim()) {
      this.stepHasText = true;
    }
  }

  onToolFinished(outcome: AgentToolOutcome): void {
    const r = outcome.result;
    if (r.type === 'text' && r.summary.trim()) {
      this.stepSummaries.push(r.summary.trim());
    } else {
      this.stepFailed = true;
    }
  }

  /**
   * At step_finished: the text to show when this is the final step (no tool
   * calls), it produced no text, and the previous step's tools all
   * succeeded. Otherwise null.
   */
  fallbackFor(toolCalls?: unknown[]): string | null {
    if ((toolCalls && toolCalls.length > 0) || this.stepHasText) {
      return null;
    }
    return this.prevStepSummaries.length
      ? this.prevStepSummaries.join('\n')
      : null;
  }
}
