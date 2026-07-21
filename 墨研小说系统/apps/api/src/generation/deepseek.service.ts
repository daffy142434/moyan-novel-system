import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class DeepSeekService {
  private readonly apiKey: string;
  private readonly baseURL: string;
  readonly primaryModel: string;
  readonly fastModel: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.apiKey = config.get<string>('DEEPSEEK_API_KEY', '').trim();
    this.baseURL = config.get<string>('DEEPSEEK_BASE_URL', 'https://api.deepseek.com');
    this.primaryModel = config.get<string>('DEEPSEEK_PRIMARY_MODEL', 'deepseek-v4-pro');
    this.fastModel = config.get<string>('DEEPSEEK_FAST_MODEL', 'deepseek-v4-flash');
  }

  isConfigured() {
    return this.apiKey.length > 0;
  }

  async generateJson(systemPrompt: string, userPrompt: string, signal: AbortSignal, model = this.primaryModel) {
    return this.generateJsonStream(systemPrompt, userPrompt, signal, {}, model);
  }

  async generateJsonStream(
    systemPrompt: string,
    userPrompt: string,
    signal: AbortSignal,
    callbacks: { reasoning?: (delta: string) => void; content?: (delta: string) => void },
    model = this.primaryModel,
  ) {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'DEEPSEEK_NOT_CONFIGURED',
        message: '请在服务端本地环境变量中配置新生成的 DEEPSEEK_API_KEY',
      });
    }
    const client = new OpenAI({ apiKey: this.apiKey, baseURL: this.baseURL });
    const stream = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 12_000,
        temperature: 0.8,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal },
    );
    let content = '';
    let resolvedModel = model;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    for await (const chunk of stream) {
      resolvedModel = chunk.model || resolvedModel;
      const delta = chunk.choices[0]?.delta as { content?: string | null; reasoning_content?: string | null } | undefined;
      if (delta?.reasoning_content) callbacks.reasoning?.(delta.reasoning_content);
      if (delta?.content) {
        content += delta.content;
        callbacks.content?.(delta.content);
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }
    if (!content) throw new Error('DeepSeek returned an empty response');
    return {
      content,
      model: resolvedModel,
      inputTokens,
      outputTokens,
    };
  }
}
