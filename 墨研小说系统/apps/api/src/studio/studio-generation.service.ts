import { Injectable, NotFoundException } from '@nestjs/common';
import type { StudioGenerationRunDto, StudioGenerationScope } from '@moyan/contracts';
import { randomUUID } from 'node:crypto';

export interface GenerationObserver {
  signal: AbortSignal;
  reasoning(delta: string): void;
  content(delta: string): void;
}

export interface StudioRunEvent {
  type: 'run.started' | 'reasoning.delta' | 'content.delta' | 'run.completed' | 'run.failed' | 'run.cancelled';
  data: Record<string, unknown>;
}

interface RunRecord extends StudioGenerationRunDto {
  userId: string;
  controller: AbortController;
  listeners: Set<(event: StudioRunEvent) => void>;
}

@Injectable()
export class StudioGenerationService {
  private readonly runs = new Map<string, RunRecord>();

  start(userId: string, scope: StudioGenerationScope, execute: (observer: GenerationObserver) => Promise<unknown>) {
    const run: RunRecord = {
      id: randomUUID(), userId, scope, status: 'queued', reasoning: '', content: '',
      controller: new AbortController(), listeners: new Set(),
    };
    this.runs.set(run.id, run);
    queueMicrotask(() => void this.execute(run, execute));
    return this.toDto(run);
  }

  get(userId: string, runId: string) {
    return this.toDto(this.find(userId, runId));
  }

  cancel(userId: string, runId: string) {
    const run = this.find(userId, runId);
    if (run.status === 'queued' || run.status === 'streaming') run.controller.abort();
    return { cancelled: true };
  }

  subscribe(userId: string, runId: string, listener: (event: StudioRunEvent) => void) {
    const run = this.find(userId, runId);
    if (this.isTerminal(run.status)) {
      const type = run.status === 'completed' ? 'run.completed' : run.status === 'cancelled' ? 'run.cancelled' : 'run.failed';
      listener({ type, data: this.toDto(run) as unknown as Record<string, unknown> });
      return () => undefined;
    }
    listener({ type: 'run.started', data: this.toDto(run) as unknown as Record<string, unknown> });
    run.listeners.add(listener);
    return () => run.listeners.delete(listener);
  }

  private async execute(run: RunRecord, execute: (observer: GenerationObserver) => Promise<unknown>) {
    run.status = 'streaming';
    this.emit(run, { type: 'run.started', data: { status: run.status } });
    try {
      const result = await execute({
        signal: run.controller.signal,
        reasoning: (delta) => {
          if (!delta) return;
          run.reasoning += delta;
          this.emit(run, { type: 'reasoning.delta', data: { delta } });
        },
        content: (delta) => {
          if (!delta) return;
          run.content += delta;
          this.emit(run, { type: 'content.delta', data: { delta } });
        },
      });
      if (run.controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      run.status = 'completed';
      run.result = result;
      this.emit(run, { type: 'run.completed', data: { result } });
    } catch (error) {
      if (run.controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        run.status = 'cancelled';
        this.emit(run, { type: 'run.cancelled', data: {} });
        return;
      }
      const response = typeof (error as { getResponse?: () => unknown })?.getResponse === 'function'
        ? (error as { getResponse: () => unknown }).getResponse()
        : null;
      const detail = response && typeof response === 'object' ? response as Record<string, unknown> : {};
      run.status = 'failed';
      run.errorCode = String(detail.code ?? 'GENERATION_FAILED');
      run.errorMessage = String(detail.message ?? (error instanceof Error ? error.message : '生成失败'));
      this.emit(run, { type: 'run.failed', data: { code: run.errorCode, message: run.errorMessage } });
    }
  }

  private emit(run: RunRecord, event: StudioRunEvent) {
    for (const listener of run.listeners) listener(event);
  }

  private find(userId: string, runId: string) {
    const run = this.runs.get(runId);
    if (!run || run.userId !== userId) throw new NotFoundException({ code: 'GENERATION_RUN_NOT_FOUND' });
    return run;
  }

  private isTerminal(status: StudioGenerationRunDto['status']) {
    return status === 'completed' || status === 'failed' || status === 'cancelled';
  }

  private toDto(run: RunRecord): StudioGenerationRunDto {
    return {
      id: run.id, scope: run.scope, status: run.status, reasoning: run.reasoning, content: run.content,
      result: run.result, errorCode: run.errorCode, errorMessage: run.errorMessage,
    };
  }
}
