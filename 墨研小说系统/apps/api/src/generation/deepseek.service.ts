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
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'DEEPSEEK_NOT_CONFIGURED',
        message: '请在服务端本地环境变量中配置新生成的 DEEPSEEK_API_KEY',
      });
    }
    const client = new OpenAI({ apiKey: this.apiKey, baseURL: this.baseURL });
    const completion = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 12_000,
        temperature: 0.8,
      },
      { signal },
    );
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('DeepSeek returned an empty response');
    return {
      content,
      model: completion.model || this.primaryModel,
      inputTokens: completion.usage?.prompt_tokens ?? null,
      outputTokens: completion.usage?.completion_tokens ?? null,
    };
  }
}
